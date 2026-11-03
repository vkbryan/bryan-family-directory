import { describe, expect, test } from "vitest";
import { freshDb } from "./helpers";

const link = { section: "history", title: "Family photos", url: "https://photos.example.test/album", icon: "photos" };

describe("family links", () => {
  test("admins add links; members see the shown ones; strangers see nothing", async () => {
    const db = await freshDb();
    const admin = await db.member("Admin Example", { admin: true });
    const member = await db.member("Member Example");

    await db.as(admin.accountId);
    await db.run("insert into public.family_links (section, title, url, icon) values ($1, $2, $3, $4)", Object.values(link));
    await db.run("insert into public.family_links (section, title, url, hidden) values ('past_events', 'Old deposit', 'https://pay.example.test', true)");
    expect(await db.value("select count(*)::int from public.family_links")).toBe(2);

    await db.as(member.accountId);
    expect(await db.rows("select title from public.family_links")).toEqual([{ title: "Family photos" }]);

    await db.asAnon();
    await expect(db.rows("select * from public.family_links")).rejects.toThrow(/permission denied/);
  });

  test("members can't add, change or delete links", async () => {
    const db = await freshDb();
    const admin = await db.member("Admin Example", { admin: true });
    const member = await db.member("Member Example");
    await db.as(admin.accountId);
    await db.run("insert into public.family_links (section, title, url) values ('history', 'Tree', 'https://tree.example.test')");

    await db.as(member.accountId);
    await expect(
      db.run("insert into public.family_links (section, title, url) values ('history', 'Mine', 'https://x.example.test')"),
    ).rejects.toThrow(/row-level security/);
    expect(await db.run("update public.family_links set title = 'Changed'")).toBe(0);
    expect(await db.run("delete from public.family_links")).toBe(0);
  });

  test("deactivated members see nothing", async () => {
    const db = await freshDb();
    const admin = await db.member("Admin Example", { admin: true });
    const gone = await db.member("Gone Example", { deactivated: true });
    await db.as(admin.accountId);
    await db.run("insert into public.family_links (section, title, url) values ('history', 'Tree', 'https://tree.example.test')");
    await db.as(gone.accountId);
    expect(await db.rows("select * from public.family_links")).toEqual([]);
  });

  test("only https and email addresses are allowed", async () => {
    const db = await freshDb();
    const admin = await db.member("Admin Example", { admin: true });
    await db.as(admin.accountId);
    await expect(
      db.run("insert into public.family_links (section, title, url) values ('history', 'Bad', 'javascript:alert(1)')"),
    ).rejects.toThrow(/check constraint/);
    await db.run("insert into public.family_links (section, title, url, icon) values ('stay_in_touch', 'Email us', 'mailto:hello@example.test', 'email')");
    await db.run("insert into public.family_links (section, title, url, icon) values ('photos', 'Album', 'https://photos.example.test', 'photos')");
  });
});
