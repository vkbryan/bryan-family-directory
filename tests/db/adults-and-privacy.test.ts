import { describe, expect, test } from "vitest";
import { freshDb } from "./helpers";

describe("signed-out visitors and deactivated accounts", () => {
  test("a signed-out visitor cannot read anything", async () => {
    const db = await freshDb();
    await db.member("Pat Example");
    await db.asAnon();
    await expect(db.rows("select * from public.directory_profiles")).rejects.toThrow(/permission denied/);
    await expect(db.rows("select * from public.profiles")).rejects.toThrow(/permission denied/);
    await expect(db.rows("select * from public.family_branches")).rejects.toThrow(/permission denied/);
  });

  test("a deactivated member sees an empty directory and cannot edit, even their own profile", async () => {
    const db = await freshDb();
    await db.member("Pat Example");
    const gone = await db.member("Dana Gone", { deactivated: true });
    await db.as(gone.accountId);
    expect(await db.rows("select * from public.directory_profiles")).toHaveLength(0);
    expect(await db.run("update public.profiles set city = 'Reno' where id = $1", [gone.profileId])).toBe(0);
    await expect(db.value("select public.create_my_profile('Someone')")).rejects.toThrow(/not_signed_in/);
  });
});

describe("adults and their own profiles", () => {
  test("a member can edit their own profile", async () => {
    const db = await freshDb();
    const pat = await db.member("Pat Example");
    await db.as(pat.accountId);
    expect(await db.run("update public.profiles set city = 'Reno', aka = 'P' where id = $1", [pat.profileId])).toBe(1);
  });

  test("a member cannot edit or fully read another adult's profile", async () => {
    const db = await freshDb();
    const pat = await db.member("Pat Example");
    const sam = await db.member("Sam Example");
    await db.as(pat.accountId);
    expect(await db.run("update public.profiles set city = 'Reno' where id = $1", [sam.profileId])).toBe(0);
    const visible = await db.rows<{ id: string }>("select id from public.profiles");
    expect(visible.map((r) => r.id)).toEqual([pat.profileId]);
  });

  test("a member cannot change who owns a profile, its type, or its memorial/archive status", async () => {
    const db = await freshDb();
    const pat = await db.member("Pat Example");
    await db.as(pat.accountId);
    for (const change of ["account_id = null", "profile_type = 'child'", "is_living = false", "archived_at = now()"]) {
      await expect(db.run(`update public.profiles set ${change} where id = $1`, [pat.profileId])).rejects.toThrow(
        /permission denied/,
      );
    }
  });

  test("a member cannot insert profiles directly", async () => {
    const db = await freshDb();
    const pat = await db.member("Pat Example");
    await db.as(pat.accountId);
    await expect(db.run("insert into public.profiles (full_name) values ('Made Up')")).rejects.toThrow(
      /row-level security/,
    );
  });

  test("a newly joined member creates exactly one profile for themselves", async () => {
    const db = await freshDb();
    const branch = await db.branch("Test Branch");
    const newcomer = await db.account();
    await db.as(newcomer);
    const id = await db.value<string>("select public.create_my_profile('Robin Newcomer', 'Rob', 'Austin', 'Texas', $1)", [
      branch,
    ]);
    const mine = await db.one<{ is_me: boolean; can_edit: boolean }>(
      "select is_me, can_edit from public.directory_profiles where id = $1",
      [id],
    );
    expect(mine).toEqual({ is_me: true, can_edit: true });
    await expect(db.value("select public.create_my_profile('Robin Again')")).rejects.toThrow(/already_has_profile/);
  });

  test("an admin can edit any profile", async () => {
    const db = await freshDb();
    const admin = await db.member("Avery Admin", { admin: true });
    const sam = await db.member("Sam Example");
    await db.as(admin.accountId);
    expect(await db.run("update public.profiles set city = 'Reno' where id = $1", [sam.profileId])).toBe(1);
  });
});

describe("the directory view respects privacy settings", () => {
  test("hidden fields are blank for other members but visible to the owner", async () => {
    const db = await freshDb();
    const viewer = await db.member("Viewer Example");
    const ownerAccount = await db.account();
    const owner = await db.profile({
      full_name: "Owner Example",
      account_id: ownerAccount,
      city: "Atlanta",
      contact_email: "owner@example.test",
      phone: "555-0100",
      birth_year: 1980,
      birth_month: 9,
      birth_day: 3,
      email_visibility: "members",
      phone_visibility: "private",
      birth_year_visibility: "private",
    });
    const sql =
      "select city, contact_email, phone, birth_year, birth_month, birth_day from public.directory_profiles where id = $1";

    await db.as(viewer.accountId);
    expect(await db.one(sql, [owner])).toEqual({
      city: "Atlanta",
      contact_email: "owner@example.test",
      phone: null,
      birth_year: null,
      birth_month: 9,
      birth_day: 3,
    });

    await db.as(ownerAccount);
    expect(await db.one(sql, [owner])).toMatchObject({ phone: "555-0100", birth_year: 1980 });
  });

  test("archived profiles disappear from the directory", async () => {
    const db = await freshDb();
    const viewer = await db.member("Viewer Example");
    await db.profile({ full_name: "Archived Example", archived_at: new Date() });
    await db.as(viewer.accountId);
    expect(await db.rows("select full_name from public.directory_profiles")).toEqual([{ full_name: "Viewer Example" }]);
  });

  test("birthdays must be real dates", async () => {
    const db = await freshDb();
    await expect(db.profile({ birth_month: 2, birth_day: 30 })).rejects.toThrow(/profiles_birthday_valid/);
    await expect(db.profile({ birth_day: 5 })).rejects.toThrow(/profiles_birthday_valid/);
    expect(await db.profile({ birth_month: 2, birth_day: 29 })).toBeTruthy(); // year unknown: allowed
  });
});

describe("family relationships grant no permissions", () => {
  test("being recorded as someone's parent does not let you edit their profile", async () => {
    const db = await freshDb();
    const admin = await db.member("Avery Admin", { admin: true });
    const grandparent = await db.member("Grand Example");
    const adultChild = await db.member("Adult Child Example");
    await db.as(admin.accountId);
    await db.run(
      "insert into public.family_relationships (relationship, person_a, person_b, detail) values ('parent', $1, $2, 'biological')",
      [grandparent.profileId, adultChild.profileId],
    );
    await db.as(grandparent.accountId);
    expect(await db.run("update public.profiles set city = 'Reno' where id = $1", [adultChild.profileId])).toBe(0);
  });

  test("only admins record relationships directly", async () => {
    const db = await freshDb();
    const a = await db.member("A Example");
    const b = await db.member("B Example");
    await db.as(a.accountId);
    await expect(
      db.run("insert into public.family_relationships (relationship, person_a, person_b) values ('parent', $1, $2)", [
        a.profileId,
        b.profileId,
      ]),
    ).rejects.toThrow(/row-level security/);
  });
});
