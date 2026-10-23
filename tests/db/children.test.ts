import { describe, expect, test } from "vitest";
import { freshDb, TestDb } from "./helpers";

const thisYear = new Date().getFullYear();

async function parentWithChild(db: TestDb, opts: { birthYear?: number; detail?: string | null } = {}) {
  const parent = await db.member("Parent One");
  await db.as(parent.accountId);
  const childId = await db.value<string>(
    "select public.create_child_profile('Kid Example', $1, 6, 15, 'Kiddo', $2)",
    [opts.birthYear ?? thisYear - 4, opts.detail === undefined ? "biological" : opts.detail],
  );
  return { parent, childId };
}

describe("parents add children", () => {
  test("adding a child creates the profile, a guardian permission and a separate parent relationship", async () => {
    const db = await freshDb();
    const { parent, childId } = await parentWithChild(db);
    await db.asSystem();
    expect(await db.one("select profile_type, account_id from public.profiles where id = $1", [childId])).toEqual({
      profile_type: "child",
      account_id: null,
    });
    expect(await db.rows("select account_id from public.profile_managers where profile_id = $1", [childId])).toEqual([
      { account_id: parent.accountId },
    ]);
    expect(
      await db.rows("select person_a, detail from public.family_relationships where person_b = $1", [childId]),
    ).toEqual([{ person_a: parent.profileId, detail: "biological" }]);
  });

  test("a guardian who is not a parent gets permission but no parent relationship", async () => {
    const db = await freshDb();
    const { childId } = await parentWithChild(db, { detail: null });
    await db.asSystem();
    expect(await db.value("select count(*)::int from public.profile_managers where profile_id = $1", [childId])).toBe(1);
    expect(await db.value("select count(*)::int from public.family_relationships where person_b = $1", [childId])).toBe(0);
  });

  test("you need your own profile and the child's birth year", async () => {
    const db = await freshDb();
    const noProfile = await db.account();
    await db.as(noProfile);
    await expect(db.value("select public.create_child_profile('Kid', 2020)")).rejects.toThrow(
      /create_your_profile_first/,
    );
    const parent = await db.member("Parent One");
    await db.as(parent.accountId);
    await expect(db.value("select public.create_child_profile('Kid', null)")).rejects.toThrow(/child_birth_year_required/);
  });

  test("the guardian can edit the child; other members cannot", async () => {
    const db = await freshDb();
    const { childId } = await parentWithChild(db);
    expect(await db.run("update public.profiles set aka = 'Bug' where id = $1", [childId])).toBe(1);
    const other = await db.member("Other Member");
    await db.as(other.accountId);
    expect(await db.run("update public.profiles set aka = 'Hacked' where id = $1", [childId])).toBe(0);
  });

  test("contact details cannot be stored on a child profile, even by a guardian", async () => {
    const db = await freshDb();
    const { childId } = await parentWithChild(db);
    for (const change of ["phone = '555-0100'", "contact_email = 'kid@example.test'", "instagram = 'kid'"]) {
      await expect(db.run(`update public.profiles set ${change} where id = $1`, [childId])).rejects.toThrow(
        /profiles_child_no_contact/,
      );
    }
    await expect(
      db.run("update public.profiles set birth_year_visibility = 'members' where id = $1", [childId]),
    ).rejects.toThrow(/profiles_child_birth_year_private/);
  });

  test("other members see a child's name and photo, but not birthday, birth year or location", async () => {
    const db = await freshDb();
    const { childId } = await parentWithChild(db);
    await db.run("update public.profiles set city = 'Atlanta', photo_path = 'kid.jpg' where id = $1", [childId]);
    const sql = "select full_name, photo_path, city, birth_year, birth_month from public.directory_profiles() where id = $1";

    const guardianView = await db.one(sql, [childId]);
    expect(guardianView).toMatchObject({ city: "Atlanta", birth_year: thisYear - 4, birth_month: 6 });

    const other = await db.member("Other Member");
    await db.as(other.accountId);
    expect(await db.one(sql, [childId])).toEqual({
      full_name: "Kid Example",
      photo_path: "kid.jpg",
      city: null,
      birth_year: null,
      birth_month: null,
    });
  });

  test("a recorded parent relationship alone does not grant editing", async () => {
    const db = await freshDb();
    const { childId } = await parentWithChild(db);
    const admin = await db.member("Avery Admin", { admin: true });
    const relative = await db.member("Recorded Parent");
    await db.as(admin.accountId);
    await db.run(
      "insert into public.family_relationships (relationship, person_a, person_b, detail) values ('parent', $1, $2, 'biological')",
      [relative.profileId, childId],
    );
    await db.as(relative.accountId);
    expect(await db.run("update public.profiles set aka = 'X' where id = $1", [childId])).toBe(0);
  });

  test("a guardian of a deactivated account loses editing", async () => {
    const db = await freshDb();
    const { parent, childId } = await parentWithChild(db);
    await db.asSystem();
    await db.run("update public.accounts set status = 'deactivated' where id = $1", [parent.accountId]);
    await db.as(parent.accountId);
    expect(await db.run("update public.profiles set aka = 'X' where id = $1", [childId])).toBe(0);
  });
});

describe("two guardians, separate logins", () => {
  test("a co-guardian invitation gives a second parent their own editing rights", async () => {
    const db = await freshDb();
    const { childId } = await parentWithChild(db);
    const secret = await db.value<string>("select public.create_invitation('co_guardian', $1, 'Parent Two')", [childId]);

    const second = await db.member("Parent Two");
    await db.as(second.accountId);
    await db.value("select public.accept_invitation($1)", [secret]);
    expect(await db.run("update public.profiles set aka = 'Bean' where id = $1", [childId])).toBe(1);

    await db.asSystem();
    expect(
      await db.value("select count(*)::int from public.profile_managers where profile_id = $1 and revoked_at is null", [
        childId,
      ]),
    ).toBe(2);
  });

  test("someone who is not a guardian cannot create a co-guardian invitation", async () => {
    const db = await freshDb();
    const { childId } = await parentWithChild(db);
    const other = await db.member("Other Member");
    await db.as(other.accountId);
    await expect(db.value("select public.create_invitation('co_guardian', $1)", [childId])).rejects.toThrow(/not_allowed/);
  });

  test("a request to co-manage is approved by an existing guardian, not by other members", async () => {
    const db = await freshDb();
    const { parent, childId } = await parentWithChild(db);
    const second = await db.member("Parent Two");
    const bystander = await db.member("Bystander");

    await db.as(second.accountId);
    const requestId = await db.value<string>("select public.request_co_guardianship($1, 'I am the other parent')", [childId]);

    await db.as(bystander.accountId);
    await expect(db.value("select public.decide_profile_request($1, true)", [requestId])).rejects.toThrow(/not_allowed/);

    await db.as(parent.accountId);
    await db.value("select public.decide_profile_request($1, true)", [requestId]);
    await db.as(second.accountId);
    expect(await db.run("update public.profiles set aka = 'Bean' where id = $1", [childId])).toBe(1);
  });

  test("there is a cap on guardians per child", async () => {
    const db = await freshDb();
    const { childId } = await parentWithChild(db);
    await db.asSystem();
    await db.run("update public.app_settings set max_guardians = 2");
    const second = await db.account();
    const third = await db.account();
    await db.run("insert into public.profile_managers (profile_id, account_id) values ($1, $2)", [childId, second]);
    await expect(
      db.run("insert into public.profile_managers (profile_id, account_id) values ($1, $2)", [childId, third]),
    ).rejects.toThrow(/too_many_guardians/);
  });

  test("guardians can step down but cannot remove each other; an admin can", async () => {
    const db = await freshDb();
    const { parent, childId } = await parentWithChild(db);
    const second = await db.account();
    await db.asSystem();
    await db.run("insert into public.profile_managers (profile_id, account_id) values ($1, $2)", [childId, second]);

    await db.as(second);
    await expect(db.value("select public.remove_guardian($1, $2)", [childId, parent.accountId])).rejects.toThrow(
      /not_allowed/,
    );
    await db.value("select public.remove_guardian($1, $2, 'stepping down')", [childId, second]);

    const admin = await db.member("Avery Admin", { admin: true });
    await db.as(admin.accountId);
    await db.value("select public.remove_guardian($1, $2)", [childId, parent.accountId]);
    await db.asSystem();
    expect(
      await db.value("select count(*)::int from public.profile_managers where profile_id = $1 and revoked_at is null", [
        childId,
      ]),
    ).toBe(0);
  });

  test("guardianship cannot be granted over an adult's profile", async () => {
    const db = await freshDb();
    const adult = await db.member("Grown Up");
    const other = await db.account();
    await db.asSystem();
    await expect(
      db.run("insert into public.profile_managers (profile_id, account_id) values ($1, $2)", [adult.profileId, other]),
    ).rejects.toThrow(/guardians_only_for_children/);
  });
});

describe("handing a profile over when a child grows up", () => {
  test("the young adult takes ownership, guardians lose access, privacy resets", async () => {
    const db = await freshDb();
    const { parent, childId } = await parentWithChild(db, { birthYear: thisYear - 18 });
    const secret = await db.value<string>("select public.create_invitation('claim', $1)", [childId]);

    const youngAdult = await db.account();
    await db.as(youngAdult);
    expect(await db.value("select public.accept_invitation($1)", [secret])).toEqual({ kind: "claim", profile_id: childId });

    await db.asSystem();
    expect(
      await db.one(
        "select profile_type, account_id, location_visibility, photo_visibility, birthday_visibility from public.profiles where id = $1",
        [childId],
      ),
    ).toEqual({
      profile_type: "adult",
      account_id: youngAdult,
      location_visibility: "private",
      photo_visibility: "private",
      birthday_visibility: "private",
    });
    expect(
      await db.value("select count(*)::int from public.profile_managers where profile_id = $1 and revoked_at is null", [
        childId,
      ]),
    ).toBe(0);
    expect(await db.value("select count(*)::int from public.audit_log where action = 'profile.handed_over'")).toBe(1);

    await db.as(parent.accountId);
    expect(await db.run("update public.profiles set aka = 'X' where id = $1", [childId])).toBe(0);
    await db.as(youngAdult);
    expect(await db.run("update public.profiles set aka = 'Mine now' where id = $1", [childId])).toBe(1);
  });

  test("a guardian cannot start a hand-over for a child under 13", async () => {
    const db = await freshDb();
    const { childId } = await parentWithChild(db, { birthYear: thisYear - 8 });
    await expect(db.value("select public.create_invitation('claim', $1)", [childId])).rejects.toThrow(
      /too_young_for_handover/,
    );
  });
});
