// Imports the original Airtable export into the family directory.
//
//   node scripts/import-airtable.ts private-data/<export>.csv
//
// This is a DRY RUN: it changes nothing online. It writes, into
// private-data/import/ (never committed to git):
//   report.md    what would happen to every record, plus warnings and errors
//   import.sql   the database changes, to apply only after review
//   photos/      downloaded, resized photos, to upload after review
//
// Decisions (fixing a birthday, linking a record to an existing profile) go in
// private-data/import/decisions.json. See docs/import.md.
//
// Safe to run repeatedly: records are matched by a stable import key, so a
// second import updates instead of duplicating, and never overwrites a
// profile someone has already claimed.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Decision = {
  birthday?: string | null; // "M/D/YYYY", "M/D", or null to clear
  profileType?: "adult" | "child";
  mergeInto?: string; // existing profile id to link this record to
  skip?: boolean;
};
export type Decisions = Record<string, Decision>;

export type ExistingProfile = { id: string; full_name: string; aka: string | null; import_key: string | null; claimed: boolean };

export type ImportRecord = {
  key: string;
  id: string;
  row: number;
  fullName: string;
  aka: string | null;
  birthYear: number | null;
  birthMonth: number | null;
  birthDay: number | null;
  profileType: "adult" | "child";
  branch: string | null;
  city: string | null;
  state: string | null;
  contactEmail: string | null;
  phone: string | null;
  instagram: string | null;
  linkedin: string | null;
  website: string | null;
  hobbies: string[];
  photo: { fileName: string; url: string } | null;
  mergeInto: string | null;
  legacy: Record<string, string>;
  warnings: string[];
  errors: string[];
};

const EXPECTED_COLUMNS = [
  "Full Name", "AKA", "Birthday", "Profile Photo", "Family Branch", "City", "State",
  "Contact Email", "Phone Number", "Instagram", "LinkedIn", "Personal Website", "Hobbies", "Can Edit Profile?",
];

// ---------------------------------------------------------------------------
// Parsing and cleaning
// ---------------------------------------------------------------------------

/** Standard CSV: quoted fields may contain commas, quotes ("") and line breaks. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");

  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((value) => value.trim() !== ""));
}

const clean = (value: string | undefined) => {
  const v = (value ?? "").replace(/\s+/g, " ").trim();
  return v === "" ? null : v;
};

export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "9/3/1980" -> {1980, 9, 3}; "9/3" -> {null, 9, 3}. Throws on anything invalid. */
export function parseBirthday(value: string | null, today = new Date()) {
  if (!value) return { year: null, month: null, day: null };
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (!match) throw new Error(`"${value}" is not a date like 9/3/1980`);
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = match[3] ? Number(match[3]) : null;
  const check = new Date(Date.UTC(year ?? 2000, month - 1, day));
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new Error(`"${value}" is not a real date`);
  }
  if (year !== null && check > today) throw new Error(`"${value}" is in the future`);
  if (year !== null && year < 1850) throw new Error(`"${value}" is before 1850`);
  return { year, month, day };
}

export function ageOn(today: Date, year: number, month: number | null, day: number | null) {
  let age = today.getUTCFullYear() - year;
  if (month !== null) {
    const m = today.getUTCMonth() + 1;
    if (m < month || (m === month && day !== null && today.getUTCDate() < day)) age--;
  }
  return age;
}

/** Airtable attachments look like "IMG_1313 (1).png (https://…)". */
export function parsePhoto(value: string | null) {
  if (!value) return null;
  const match = value.match(/^(.*?)\s*\((https?:\/\/[^)\s]+)\)/);
  return match ? { fileName: match[1].trim(), url: match[2] } : null;
}

/** "@name", "name", "instagram.com/name" -> "name". */
export function cleanInstagram(value: string | null) {
  if (!value) return null;
  const handle = value
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "")
    .trim();
  return handle || null;
}

/** Hobbies arrive one per line, comma-separated, or joined with "and". */
export function splitHobbies(value: string | null) {
  if (!value) return [];
  const seen = new Set<string>();
  return value
    .split(/\r?\n|,|;|\s+and\s+|\s*&\s*/i)
    .map((h) => h.replace(/\s+/g, " ").trim())
    .filter((h) => {
      const slug = slugify(h);
      if (!slug || seen.has(slug)) return false;
      seen.add(slug);
      return true;
    })
    .map((h) => h.charAt(0).toUpperCase() + h.slice(1));
}

/** Same import key -> same profile id, run after run (a name-based UUID, v5 style). */
export function stableId(key: string) {
  const hash = createHash("sha1").update(`bryan-family-directory:${key}`).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function buildRecords(
  csvText: string,
  options: { decisions?: Decisions; existing?: ExistingProfile[]; today?: Date } = {},
) {
  const decisions = options.decisions ?? {};
  const existing = options.existing ?? [];
  const today = options.today ?? new Date();
  const fileErrors: string[] = [];

  const [header, ...rows] = parseCsv(csvText);
  const headerNames = (header ?? []).map((h) => h.trim());
  const missing = EXPECTED_COLUMNS.filter((c) => !headerNames.includes(c));
  const extra = headerNames.filter((c) => !EXPECTED_COLUMNS.includes(c));
  if (missing.length) fileErrors.push(`Missing columns: ${missing.join(", ")}`);
  const fileWarnings = extra.length ? [`Columns that will not be imported: ${extra.join(", ")}`] : [];

  const records: ImportRecord[] = [];
  const keys = new Map<string, number>();

  rows.forEach((cells, index) => {
    const get = (column: string) => cells[headerNames.indexOf(column)];
    const rowNumber = index + 2; // header is row 1
    const warnings: string[] = [];
    const errors: string[] = [];

    const fullName = clean(get("Full Name"));
    if (!fullName) {
      fileErrors.push(`Row ${rowNumber}: no name, so it cannot be imported.`);
      return;
    }
    const key = `airtable:${slugify(fullName)}`;
    const decision = decisions[key] ?? {};
    if (decision.skip) return;

    if (keys.has(key)) {
      errors.push(`Same name as row ${keys.get(key)}: possible duplicate. Remove one or rename it.`);
    }
    keys.set(key, rowNumber);

    if (get("Full Name") !== fullName) warnings.push("Extra spaces in the name were tidied.");

    let birthday = { year: null as number | null, month: null as number | null, day: null as number | null };
    const birthdayText = decision.birthday !== undefined ? decision.birthday : clean(get("Birthday"));
    try {
      birthday = parseBirthday(birthdayText, today);
    } catch (e) {
      errors.push(`Birthday ${(e as Error).message}.`);
    }

    const age = birthday.year !== null ? ageOn(today, birthday.year, birthday.month, birthday.day) : null;
    const profileType = decision.profileType ?? (age !== null && age < 18 ? "child" : "adult");
    if (age !== null && age < 2 && decision.birthday === undefined && decision.profileType === undefined) {
      errors.push(
        `Birthday ${birthdayText} makes them ${age} years old. If that's wrong (for example, the date the record was made), add the real birthday to decisions.json.`,
      );
    }

    const contactEmail = clean(get("Contact Email"))?.toLowerCase() ?? null;
    if (contactEmail && !EMAIL.test(contactEmail)) warnings.push(`Contact email "${contactEmail}" doesn't look valid.`);

    let contact = {
      contactEmail,
      phone: clean(get("Phone Number")),
      instagram: cleanInstagram(clean(get("Instagram"))),
      linkedin: clean(get("LinkedIn")),
      website: clean(get("Personal Website")),
    };
    if (profileType === "child") {
      if (Object.values(contact).some(Boolean)) {
        warnings.push("Child profile: contact details are not kept for children, so they were left out.");
      }
      contact = { contactEmail: null, phone: null, instagram: null, linkedin: null, website: null };
      warnings.push("Child profile: no guardian yet. A parent can be added after they join.");
    }

    const photo = parsePhoto(clean(get("Profile Photo")));
    if (clean(get("Profile Photo")) && !photo) warnings.push("The photo entry couldn't be read.");

    // The original values, kept as history. Never a child's contact details.
    const contactColumns = ["Contact Email", "Phone Number", "Instagram", "LinkedIn", "Personal Website"];
    const legacy: Record<string, string> = {};
    for (const column of headerNames) {
      const value = get(column);
      if (column === "Profile Photo" || !value?.trim()) continue;
      if (profileType === "child" && contactColumns.includes(column)) continue;
      legacy[column] = value;
    }
    if (photo) legacy["Profile Photo file"] = photo.fileName;

    const mergeInto = decision.mergeInto ?? null;
    if (!mergeInto) {
      const alreadyImported = existing.find((p) => p.import_key === key);
      if (!alreadyImported) {
        const first = fullName.split(" ")[0].toLowerCase();
        const similar = existing.filter(
          (p) => !p.import_key && (slugify(p.full_name) === slugify(fullName) || p.full_name.trim().toLowerCase() === first),
        );
        for (const p of similar) {
          errors.push(
            `Looks like the existing ${p.claimed ? "claimed " : ""}profile "${p.full_name}". Add "mergeInto": "${p.id}" to decisions.json to fill it in from this record, or "skip": true to leave this record out.`,
          );
        }
      }
    } else if (!existing.some((p) => p.id === mergeInto)) {
      errors.push(`decisions.json links this record to profile ${mergeInto}, which doesn't exist.`);
    }

    records.push({
      key,
      id: mergeInto ?? stableId(key),
      row: rowNumber,
      fullName,
      aka: clean(get("AKA")),
      birthYear: birthday.year,
      birthMonth: birthday.month,
      birthDay: birthday.day,
      profileType,
      branch: clean(get("Family Branch")),
      city: clean(get("City")),
      state: clean(get("State")),
      ...contact,
      hobbies: splitHobbies(get("Hobbies") ?? null),
      photo,
      mergeInto,
      legacy,
      warnings,
      errors,
    });
  });

  return { records, fileErrors, fileWarnings };
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const lit = (value: string | number | boolean | null | undefined) => {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return `'${value.replace(/'/g, "''")}'`;
};

export function buildSql(records: ImportRecord[], meta: { file: string; sha256: string; photos: Set<string> }) {
  const lines: string[] = [
    "-- Generated by scripts/import-airtable.ts. Review report.md before applying.",
    "begin;",
    "",
  ];

  const branches = [...new Set(records.map((r) => r.branch).filter(Boolean))] as string[];
  for (const name of branches) {
    lines.push(`insert into public.family_branches (name) values (${lit(name)}) on conflict (name) do nothing;`);
  }
  const hobbies = new Map(records.flatMap((r) => r.hobbies).map((h) => [slugify(h), h]));
  for (const [slug, name] of hobbies) {
    lines.push(`insert into public.hobbies (name, slug) values (${lit(name)}, ${lit(slug)}) on conflict (slug) do nothing;`);
  }
  lines.push("");

  for (const r of records) {
    const photoPath = meta.photos.has(r.key) ? `${r.id}/airtable.jpg` : null;
    const child = r.profileType === "child";
    lines.push(`-- ${r.fullName} (row ${r.row})`);
    if (r.mergeInto) {
      // An existing profile: fill only what's empty, never overwrite.
      lines.push(
        `update public.profiles set
  import_key = ${lit(r.key)},
  legacy = ${lit(JSON.stringify(r.legacy))}::jsonb,
  aka = coalesce(aka, ${lit(r.aka)}),
  birth_year = coalesce(birth_year, ${lit(r.birthYear)}),
  birth_month = coalesce(birth_month, ${lit(r.birthMonth)}),
  birth_day = coalesce(birth_day, ${lit(r.birthDay)}),
  city = coalesce(city, ${lit(r.city)}),
  state = coalesce(state, ${lit(r.state)}),
  photo_path = coalesce(photo_path, ${lit(photoPath)}),
  contact_email = coalesce(contact_email, ${lit(r.contactEmail)}),
  phone = coalesce(phone, ${lit(r.phone)}),
  instagram = coalesce(instagram, ${lit(r.instagram)}),
  linkedin = coalesce(linkedin, ${lit(r.linkedin)}),
  website = coalesce(website, ${lit(r.website)})
where id = ${lit(r.id)} and (import_key is null or import_key = ${lit(r.key)});`,
      );
    } else {
      const columns = {
        id: lit(r.id),
        import_key: lit(r.key),
        source: lit("import"),
        legacy: `${lit(JSON.stringify(r.legacy))}::jsonb`,
        full_name: lit(r.fullName),
        aka: lit(r.aka),
        profile_type: lit(r.profileType),
        birth_year: lit(r.birthYear),
        birth_month: lit(r.birthMonth),
        birth_day: lit(r.birthDay),
        city: lit(r.city),
        state: lit(r.state),
        photo_path: lit(photoPath),
        contact_email: lit(r.contactEmail),
        phone: lit(r.phone),
        instagram: lit(r.instagram),
        linkedin: lit(r.linkedin),
        website: lit(r.website),
        location_visibility: lit(child ? "private" : "members"),
        birthday_visibility: lit(child ? "private" : "members"),
      };
      const names = Object.keys(columns);
      const updates = names.filter((n) => n !== "id" && n !== "import_key").map((n) => `${n} = excluded.${n}`);
      lines.push(
        `insert into public.profiles (${names.join(", ")})
values (${Object.values(columns).join(", ")})
on conflict (import_key) do update set ${updates.join(", ")}
where public.profiles.account_id is null;`,
      );
    }
    if (r.branch) {
      lines.push(
        `insert into public.profile_branches (profile_id, branch_id, is_primary)
select ${lit(r.id)}, b.id, not exists (select 1 from public.profile_branches where profile_id = ${lit(r.id)} and is_primary)
from public.family_branches b where b.name = ${lit(r.branch)}
on conflict do nothing;`,
      );
    }
    for (const h of r.hobbies) {
      lines.push(
        `insert into public.profile_hobbies (profile_id, hobby_id) select ${lit(r.id)}, id from public.hobbies where slug = ${lit(slugify(h))} on conflict do nothing;`,
      );
    }
    lines.push("");
  }

  lines.push(
    `insert into public.audit_log (action, details) values ('import.airtable', ${lit(
      JSON.stringify({ file: meta.file, sha256: meta.sha256, records: records.length }),
    )}::jsonb);`,
    "",
    "commit;",
  );
  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export function buildReport(
  result: ReturnType<typeof buildRecords>,
  meta: { file: string; photoStatus: Map<string, string> },
) {
  const { records, fileErrors, fileWarnings } = result;
  const errorCount = fileErrors.length + records.reduce((n, r) => n + r.errors.length, 0);
  const warningCount = fileWarnings.length + records.reduce((n, r) => n + r.warnings.length, 0);
  const yesNo = (v: unknown) => (v ? "yes" : "—");

  const out: string[] = [
    "# Airtable import: dry-run report",
    "",
    `File: \`${meta.file}\`  `,
    `Records: **${records.length}** · Errors: **${errorCount}** · Warnings: **${warningCount}**`,
    "",
    errorCount === 0
      ? "✅ No errors. This import can be applied after you've read the warnings."
      : "⛔ Fix the errors below (usually in decisions.json) and run the dry run again before applying.",
    "",
  ];
  if (fileErrors.length || fileWarnings.length) {
    out.push("## File", "", ...fileErrors.map((e) => `- ⛔ ${e}`), ...fileWarnings.map((w) => `- ⚠️ ${w}`), "");
  }

  out.push(
    "## Records",
    "",
    "| Row | Name | AKA | Branch | City, State | Birthday | Type | Photo | Email | Phone | Social | Hobbies | Action |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|",
  );
  for (const r of records) {
    const birthday = r.birthMonth ? `${r.birthMonth}/${r.birthDay}${r.birthYear ? `/${r.birthYear}` : ""}` : "—";
    out.push(
      `| ${r.row} | ${r.fullName} | ${r.aka ?? "—"} | ${r.branch ?? "—"} | ${[r.city, r.state].filter(Boolean).join(", ") || "—"} | ${birthday} | ${r.profileType} | ${meta.photoStatus.get(r.key) ?? "none"} | ${yesNo(r.contactEmail)} | ${yesNo(r.phone)} | ${yesNo(r.instagram || r.linkedin || r.website)} | ${r.hobbies.join(", ") || "—"} | ${r.mergeInto ? "fill in existing profile" : "create or update"} |`,
    );
  }
  out.push("");

  const flagged = records.filter((r) => r.errors.length || r.warnings.length);
  if (flagged.length) {
    out.push("## Needs your attention", "");
    for (const r of flagged) {
      out.push(`### ${r.fullName} (row ${r.row})`, "", `Import key: \`${r.key}\``, "");
      out.push(...r.errors.map((e) => `- ⛔ ${e}`), ...r.warnings.map((w) => `- ⚠️ ${w}`), "");
    }
  }

  out.push(
    "## Privacy after import",
    "",
    "- Imported profiles start **unclaimed**. Email and phone stay hidden from other members (\"private\") until the person claims their profile and chooses what to share.",
    "- Shown to signed-in family: name, nickname, branch, city/state, photo, birthday month/day, hobbies, Instagram/LinkedIn/website.",
    "- Children: no contact details are stored, and their birthday and location are hidden.",
    "- The old \"Can Edit Profile?\" value is kept only as history. It grants nothing.",
    "",
  );
  return { markdown: out.join("\n"), errorCount, warningCount };
}

// ---------------------------------------------------------------------------
// Running it
// ---------------------------------------------------------------------------

function loadExistingProfiles(): ExistingProfile[] {
  const sql =
    "select id, full_name, aka, import_key, account_id is not null as claimed from public.profiles where archived_at is null";
  const output = execFileSync("npx", ["supabase", "db", "query", "--linked", sql, "--output-format", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return JSON.parse(output.slice(output.indexOf("{"))).rows as ExistingProfile[];
}

async function fetchPhoto(record: ImportRecord, dir: string): Promise<string> {
  if (!record.photo) return "none";
  const target = join(dir, `${record.id}.jpg`);
  if (existsSync(target)) return "ready";
  const response = await fetch(record.photo.url);
  if (!response.ok) {
    record.warnings.push(
      `The photo link from Airtable no longer works (HTTP ${response.status}). Export the CSV from Airtable again to get fresh links.`,
    );
    return "link expired";
  }
  const original = join(dir, `${record.id}.original`);
  writeFileSync(original, Buffer.from(await response.arrayBuffer()));
  // Resize to at most 1024px and convert to JPEG with macOS's built-in tool.
  execFileSync("sips", ["-s", "format", "jpeg", "-Z", "1024", original, "--out", target], { stdio: "ignore" });
  return "ready";
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node scripts/import-airtable.ts private-data/<export>.csv");
    process.exit(1);
  }
  const outDir = join("private-data", "import");
  const photoDir = join(outDir, "photos");
  mkdirSync(photoDir, { recursive: true });

  const csv = readFileSync(file, "utf8");
  const decisionsPath = join(outDir, "decisions.json");
  const decisions: Decisions = existsSync(decisionsPath) ? JSON.parse(readFileSync(decisionsPath, "utf8")) : {};
  const existing = loadExistingProfiles();

  const result = buildRecords(csv, { decisions, existing });
  const photoStatus = new Map<string, string>();
  for (const record of result.records) photoStatus.set(record.key, await fetchPhoto(record, photoDir));

  const photos = new Set([...photoStatus].filter(([, status]) => status === "ready").map(([key]) => key));
  const sha256 = createHash("sha256").update(csv).digest("hex");
  writeFileSync(join(outDir, "import.sql"), buildSql(result.records, { file: basename(file), sha256, photos }));
  const report = buildReport(result, { file: basename(file), photoStatus });
  writeFileSync(join(outDir, "report.md"), report.markdown);

  console.log(
    `Dry run finished: ${result.records.length} records, ${report.errorCount} errors, ${report.warningCount} warnings.`,
  );
  console.log(`Report: ${join(outDir, "report.md")}`);
  console.log("Nothing was changed online.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
