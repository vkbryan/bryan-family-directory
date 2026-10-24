// Tests for the Airtable importer, using made-up people only.

import { describe, expect, test } from "vitest";
import {
  buildRecords,
  buildSql,
  cleanInstagram,
  parseBirthday,
  parseCsv,
  splitHobbies,
  stableId,
} from "../../scripts/import-airtable";
import { freshDb } from "../db/helpers";

const HEADER =
  "Full Name,AKA,Birthday,Profile Photo,Family Branch,City,State,Contact Email,Phone Number,Instagram,LinkedIn,Personal Website,Hobbies,Can Edit Profile?";
const today = new Date(Date.UTC(2026, 9, 24));

function csv(...rows: string[]) {
  return [HEADER, ...rows].join("\n");
}

describe("reading the export", () => {
  test("handles quoted fields with commas and line breaks", () => {
    expect(parseCsv('a,"b, c","line1\nline2"\n1,2,3')).toEqual([
      ["a", "b, c", "line1\nline2"],
      ["1", "2", "3"],
    ]);
  });

  test("validates birthdays", () => {
    expect(parseBirthday("9/3/1980", today)).toEqual({ year: 1980, month: 9, day: 3 });
    expect(parseBirthday("2/29", today)).toEqual({ year: null, month: 2, day: 29 });
    expect(() => parseBirthday("2/30/1990", today)).toThrow(/not a real date/);
    expect(() => parseBirthday("1/1/2030", today)).toThrow(/future/);
    expect(() => parseBirthday("September 3", today)).toThrow(/not a date/);
  });

  test("normalizes hobbies for search but keeps readable names", () => {
    expect(splitHobbies("Gardening\nHiking")).toEqual(["Gardening", "Hiking"]);
    expect(splitHobbies("Sparkling anything, Driving, cooking")).toEqual(["Sparkling anything", "Driving", "Cooking"]);
    expect(splitHobbies("Gardening and cooking ")).toEqual(["Gardening", "Cooking"]);
    expect(splitHobbies("Cooking, cooking")).toEqual(["Cooking"]);
  });

  test("tidies Instagram handles", () => {
    expect(cleanInstagram("@pat")).toBe("pat");
    expect(cleanInstagram("https://www.instagram.com/pat/")).toBe("pat");
  });

  test("the same name always gets the same profile id", () => {
    expect(stableId("airtable:pat-example")).toBe(stableId("airtable:pat-example"));
    expect(stableId("airtable:pat-example")).not.toBe(stableId("airtable:sam-example"));
    expect(stableId("airtable:pat-example")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("checking records", () => {
  test("tidies names, places and contact details", () => {
    const { records } = buildRecords(
      csv('Pat  Example ,Patty,9/3/1980,,Branch One,Reno ,Nevada,PAT@Example.test,(555) 010-0100,@pat,,,"Gardening\nHiking",checked'),
      { today },
    );
    expect(records[0]).toMatchObject({
      fullName: "Pat Example",
      aka: "Patty",
      city: "Reno",
      contactEmail: "pat@example.test",
      instagram: "pat",
      profileType: "adult",
      hobbies: ["Gardening", "Hiking"],
    });
    expect(records[0].legacy["Can Edit Profile?"]).toBe("checked");
  });

  test("a minor becomes a child profile with no contact details anywhere", () => {
    const { records } = buildRecords(csv("Kid Example,,11/7/2022,,Branch One,Atlanta,Georgia,parent@example.test,,,,,,"), {
      today,
    });
    expect(records[0].profileType).toBe("child");
    expect(records[0].contactEmail).toBeNull();
    expect(JSON.stringify(records[0].legacy)).not.toContain("parent@example.test");
    expect(records[0].warnings.join(" ")).toMatch(/contact details are not kept/);
  });

  test("flags a birthday that makes someone a baby, until a decision is made", () => {
    const row = "New Example,,9/5/2025,,Branch One,,,,,,,,,";
    expect(buildRecords(csv(row), { today }).records[0].errors.join(" ")).toMatch(/1 years old|0 years old/);
    const fixed = buildRecords(csv(row), { today, decisions: { "airtable:new-example": { birthday: "9/5/1975" } } });
    expect(fixed.records[0]).toMatchObject({ errors: [], birthYear: 1975, profileType: "adult" });
  });

  test("flags duplicate names in the file", () => {
    const { records } = buildRecords(csv("Pat Example,,,,,,,,,,,,,", "Pat Example,,,,,,,,,,,,,"), { today });
    expect(records[1].errors.join(" ")).toMatch(/duplicate/);
  });

  test("flags a record that matches someone already in the directory", () => {
    const existing = [{ id: "00000000-0000-0000-0000-000000000001", full_name: "Pat", aka: null, import_key: null, claimed: true }];
    const { records } = buildRecords(csv("Pat Example,,,,,,,,,,,,,"), { today, existing });
    expect(records[0].errors.join(" ")).toMatch(/existing claimed profile "Pat"/);

    const merged = buildRecords(csv("Pat Example,,,,,,,,,,,,,"), {
      today,
      existing,
      decisions: { "airtable:pat-example": { mergeInto: existing[0].id } },
    });
    expect(merged.records[0]).toMatchObject({ errors: [], id: existing[0].id, mergeInto: existing[0].id });
  });

  test("reports missing columns", () => {
    expect(buildRecords("Full Name,City\nPat,Reno", { today }).fileErrors.join(" ")).toMatch(/Missing columns/);
  });
});

describe("the generated SQL, run against the real schema", () => {
  const rows = [
    'Pat Example,Patty,9/3/1980,,Branch One,Reno,Nevada,pat@example.test,555-0100,@pat,,,"Gardening\nHiking",checked',
    "Sam O'Example,,5/26/1948,,Branch Two,Freeport,New York,sam@example.test,,,,,Gardening,",
    "Kid Example,,11/7/2022,,Branch One,Atlanta,Georgia,parent@example.test,,,,,,",
  ];
  const meta = { file: "test.csv", sha256: "abc", photos: new Set<string>(["airtable:pat-example"]) };

  test("imports everything, and importing twice changes nothing", async () => {
    const db = await freshDb();
    const { records } = buildRecords(csv(...rows), { today });
    const sql = buildSql(records, meta);

    await db.asSystem();
    await db.script(sql);
    await db.script(sql);

    expect(await db.value("select count(*)::int from public.profiles")).toBe(3);
    expect(await db.value("select count(*)::int from public.family_branches")).toBe(2);
    expect(await db.value("select count(*)::int from public.hobbies")).toBe(2);
    expect(await db.value("select count(*)::int from public.profile_hobbies")).toBe(3);
    expect(await db.value("select count(*)::int from public.profile_branches where is_primary")).toBe(3);
    expect(
      await db.one("select profile_type, contact_email, location_visibility from public.profiles where full_name = 'Kid Example'"),
    ).toEqual({ profile_type: "child", contact_email: null, location_visibility: "private" });
    expect(await db.value("select photo_path from public.profiles where full_name = 'Pat Example'")).toBe(
      `${stableId("airtable:pat-example")}/airtable.jpg`,
    );
    expect(await db.value("select email_visibility from public.profiles where full_name = 'Pat Example'")).toBe("private");
  });

  test("never overwrites a profile someone has claimed", async () => {
    const db = await freshDb();
    const { records } = buildRecords(csv(rows[0]), { today });
    const sql = buildSql(records, meta);
    await db.asSystem();
    await db.script(sql);

    const account = await db.account();
    await db.asSystem();
    await db.run("update public.profiles set account_id = $1, city = 'Chosen City' where import_key = 'airtable:pat-example'", [
      account,
    ]);
    await db.script(sql);
    expect(await db.value("select city from public.profiles where import_key = 'airtable:pat-example'")).toBe("Chosen City");
  });

  test("filling in an existing profile only adds what's missing", async () => {
    const db = await freshDb();
    const me = await db.member("Pat");
    await db.asSystem();
    await db.run("update public.profiles set city = 'My City' where id = $1", [me.profileId]);
    const existing = [{ id: me.profileId, full_name: "Pat", aka: null, import_key: null, claimed: true }];
    const { records } = buildRecords(csv(rows[0]), {
      today,
      existing,
      decisions: { "airtable:pat-example": { mergeInto: me.profileId } },
    });
    await db.script(buildSql(records, meta));
    expect(await db.one("select full_name, city, aka, birth_year, import_key from public.profiles where id = $1", [me.profileId])).toEqual({
      full_name: "Pat",
      city: "My City",
      aka: "Patty",
      birth_year: 1980,
      import_key: "airtable:pat-example",
    });
    expect(await db.value("select count(*)::int from public.profiles")).toBe(1);
  });
});
