import { describe, expect, test } from "vitest";
import { freshDb, TestDb } from "./helpers";

async function photo(db: TestDb, profileId: string) {
  await db.asSystem();
  const name = `${profileId}/photo.jpg`;
  await db.run("insert into storage.objects (bucket_id, name) values ('profile-photos', $1)", [name]);
  return name;
}

const visible = "select name from storage.objects where bucket_id = 'profile-photos'";

describe("profile photos", () => {
  test("the photo bucket is private", async () => {
    const db = await freshDb();
    await db.asSystem();
    expect(await db.value("select public from storage.buckets where id = 'profile-photos'")).toBe(false);
  });

  test("members see photos shared with members; signed-out visitors see none", async () => {
    const db = await freshDb();
    const owner = await db.member("Owner Example");
    const viewer = await db.member("Viewer Example");
    const name = await photo(db, owner.profileId);

    await db.as(viewer.accountId);
    expect(await db.rows(visible)).toEqual([{ name }]);
    await db.asAnon();
    expect(await db.rows(visible)).toEqual([]);
  });

  test("a hidden photo is visible only to the person, guardians and admins", async () => {
    const db = await freshDb();
    const owner = await db.member("Owner Example");
    const viewer = await db.member("Viewer Example");
    const admin = await db.member("Avery Admin", { admin: true });
    await db.run("update public.profiles set photo_visibility = 'private' where id = $1", [owner.profileId]);
    const name = await photo(db, owner.profileId);

    await db.as(viewer.accountId);
    expect(await db.rows(visible)).toEqual([]);
    await db.as(owner.accountId);
    expect(await db.rows(visible)).toEqual([{ name }]);
    await db.as(admin.accountId);
    expect(await db.rows(visible)).toEqual([{ name }]);
  });

  test("you can upload to your own profile's folder, not someone else's", async () => {
    const db = await freshDb();
    const pat = await db.member("Pat Example");
    const sam = await db.member("Sam Example");
    await db.as(pat.accountId);
    expect(
      await db.run("insert into storage.objects (bucket_id, name) values ('profile-photos', $1)", [`${pat.profileId}/me.jpg`]),
    ).toBe(1);
    await expect(
      db.run("insert into storage.objects (bucket_id, name) values ('profile-photos', $1)", [`${sam.profileId}/x.jpg`]),
    ).rejects.toThrow(/row-level security/);
    await expect(
      db.run("insert into storage.objects (bucket_id, name) values ('profile-photos', 'not-a-profile/x.jpg')"),
    ).rejects.toThrow(/row-level security/);
  });

  test("a guardian can upload a child's photo; other members cannot", async () => {
    const db = await freshDb();
    const parent = await db.member("Parent One");
    const other = await db.member("Other Member");
    await db.as(parent.accountId);
    const childId = await db.value<string>("select public.create_child_profile('Kid Example', 2020)");
    expect(
      await db.run("insert into storage.objects (bucket_id, name) values ('profile-photos', $1)", [`${childId}/kid.jpg`]),
    ).toBe(1);
    await db.as(other.accountId);
    await expect(
      db.run("insert into storage.objects (bucket_id, name) values ('profile-photos', $1)", [`${childId}/x.jpg`]),
    ).rejects.toThrow(/row-level security/);
    expect(await db.run("delete from storage.objects where name = $1", [`${childId}/kid.jpg`])).toBe(0);
  });
});
