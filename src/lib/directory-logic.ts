// Pure directory logic: filtering, birthdays, labels. No database access, so
// it can be tested directly.

export type Person = {
  id: string;
  fullName: string;
  aka: string | null;
  isChild: boolean;
  isClaimed: boolean;
  isMe: boolean;
  canEdit: boolean;
  city: string | null;
  state: string | null;
  birthMonth: number | null;
  birthDay: number | null;
  birthYear: number | null;
  photoUrl: string | null;
  primaryBranch: string | null;
  primaryBranchColor?: number;
  branches: { slug: string; name: string; color?: number }[];
  hobbies: { slug: string; name: string }[];
  /** Recorded parent and child links (genealogy only; they grant no editing rights). */
  parents?: { id: string; name: string }[];
  children?: { id: string; name: string }[];
  contactEmail: string | null;
  phone: string | null;
  instagram: string | null;
  linkedin: string | null;
  website: string | null;
  /** When the profile was added to the directory. */
  addedAt?: string;
};

export type Filters = {
  q: string;
  branch: string; // branch slug
  state: string;
  city: string;
  hobby: string; // hobby slug
  month: string; // "1".."12"
};

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export function readFilters(params: Record<string, string | string[] | undefined>): Filters {
  return {
    q: first(params.q).trim().slice(0, 100),
    branch: first(params.branch),
    state: first(params.state),
    city: first(params.city),
    hobby: first(params.hobby),
    month: first(params.month),
  };
}

export const hasFilters = (f: Filters) => Object.values(f).some(Boolean);

/** Lowercase, no accents, single spaces: "  José " -> "jose". */
export function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** "Joseph Bryan (Joe B.)" -> "joseph-bryan-joe-b", for readable filter links. */
export function slugOf(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Every filter must match. The search box matches full name or nickname, word by word. */
export function filterPeople(people: Person[], f: Filters) {
  const words = normalize(f.q).split(" ").filter(Boolean);
  return people.filter((p) => {
    if (words.length) {
      const haystack = normalize(`${p.fullName} ${p.aka ?? ""}`);
      if (!words.every((w) => haystack.includes(w))) return false;
    }
    if (f.branch && !p.branches.some((b) => b.slug === f.branch)) return false;
    if (f.state && normalize(p.state ?? "") !== normalize(f.state)) return false;
    if (f.city && normalize(p.city ?? "") !== normalize(f.city)) return false;
    if (f.hobby && !p.hobbies.some((h) => h.slug === f.hobby)) return false;
    if (f.month && p.birthMonth !== Number(f.month)) return false;
    return true;
  });
}

/** Sort by name, ignoring case. */
export function byName(a: Person, b: Person) {
  return a.fullName.localeCompare(b.fullName, "en", { sensitivity: "base" });
}

/** Counts for "browse by" lists, most common first, then alphabetical. */
export function tally<T extends { slug: string; name: string }>(items: T[]) {
  const counts = new Map<string, { slug: string; name: string; count: number }>();
  for (const item of items) {
    const entry = counts.get(item.slug) ?? { slug: item.slug, name: item.name, count: 0 };
    entry.count++;
    counts.set(item.slug, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Birthdays coming up within `days` days of `today` (birthday today counts), soonest first. */
export function upcomingBirthdays(people: Person[], today: Date, days = 30) {
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const results: { person: Person; daysAway: number; turning: number | null }[] = [];
  for (const person of people) {
    if (!person.birthMonth || !person.birthDay) continue;
    let year = today.getUTCFullYear();
    let next = birthdayIn(year, person.birthMonth, person.birthDay);
    if (next < start) next = birthdayIn(++year, person.birthMonth, person.birthDay);
    const daysAway = Math.round((next - start) / 86_400_000);
    if (daysAway <= days) {
      results.push({ person, daysAway, turning: person.birthYear ? year - person.birthYear : null });
    }
  }
  return results.sort((a, b) => a.daysAway - b.daysAway || byName(a.person, b.person));
}

// Feb 29 birthdays are celebrated on Feb 28 in non-leap years.
function birthdayIn(year: number, month: number, day: number) {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return Date.UTC(year, month - 1, month === 2 && day === 29 && !leap ? 28 : day);
}

export function whenLabel(daysAway: number) {
  if (daysAway === 0) return "Today";
  if (daysAway === 1) return "Tomorrow";
  return `In ${daysAway} days`;
}

export function birthdayLabel(p: Pick<Person, "birthMonth" | "birthDay" | "birthYear">) {
  if (!p.birthMonth || !p.birthDay) return null;
  return `${MONTHS[p.birthMonth - 1]} ${p.birthDay}${p.birthYear ? `, ${p.birthYear}` : ""}`;
}

export function placeLabel(p: Pick<Person, "city" | "state">) {
  return [p.city, p.state].filter(Boolean).join(", ") || null;
}

/** "Verena Bryan" -> "VB"; "Cher" -> "C". */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Links that keep the other filters, changing just one. */
export function filterHref(current: Filters, change: Partial<Filters>) {
  const next = { ...current, ...change };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `/family?${query}` : "/family";
}

/** A safe link for a personal website (only http/https). */
export function websiteHref(value: string) {
  const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

/** Instagram handle -> profile link. */
export function instagramHref(handle: string) {
  return `https://www.instagram.com/${encodeURIComponent(handle.replace(/^@/, ""))}/`;
}

/** Digits and a leading + only, for tel: links. */
export function phoneHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : null;
}

/** "Vanessa Bryan's child", "Vanessa Bryan and Sam Rivers's child", or "Child" when no parent is recorded. */
export function childOfLabel(parents: { name: string }[] | undefined) {
  const names = (parents ?? []).map((p) => p.name);
  if (names.length === 0) return "Child";
  const joined = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${joined}'s child`;
}

/** The most recently added profiles, newest first. */
export function newestFirst(people: Person[], count: number) {
  return [...people].sort((a, b) => (b.addedAt ?? "").localeCompare(a.addedAt ?? "")).slice(0, count);
}
