import { describe, expect, test } from "vitest";
import { freshDb, TestDb } from "./helpers";

/** A member with a made-up sign-in email. */
async function memberWithEmail(db: TestDb, name: string, email: string, opts: { admin?: boolean } = {}) {
  const m = await db.member(name, opts);
  await db.run("update auth.users set email = $2 where id = $1", [m.accountId, email]);
  return m;
}

const contactList = async (db: TestDb, adminId: string) => {
  await db.as(adminId);
  return db.rows<{ full_name: string; email: string }>("select full_name, email from public.admin_contact_list()");
};

describe("event news contact list", () => {
  test("nobody is on the list until they say yes", async () => {
    const db = await freshDb();
    const admin = await memberWithEmail(db, "Admin Example", "admin@example.test", { admin: true });
    const robin = await memberWithEmail(db, "Robin Example", "robin@example.test");

    await db.as(robin.accountId);
    expect(await db.one("select * from public.my_event_news()")).toMatchObject({
      wants_news: null,
      sign_in_email: "robin@example.test",
    });
    expect(await contactList(db, admin.accountId)).toEqual([]);

    await db.as(robin.accountId);
    await db.value("select public.set_event_news(true)");
    expect(await contactList(db, admin.accountId)).toEqual([
      { full_name: "Robin Example", email: "robin@example.test" },
    ]);
  });

  test("a different email can be used, and saying no takes them off", async () => {
    const db = await freshDb();
    const admin = await memberWithEmail(db, "Admin Example", "admin@example.test", { admin: true });
    const robin = await memberWithEmail(db, "Robin Example", "robin@example.test");

    await db.as(robin.accountId);
    await db.value("select public.set_event_news(true, ' Robin.Home@Example.test ')");
    expect((await contactList(db, admin.accountId))[0].email).toBe("robin.home@example.test");

    await db.as(robin.accountId);
    await db.value("select public.set_event_news(false, 'robin.home@example.test')");
    expect(await contactList(db, admin.accountId)).toEqual([]);
    await db.as(robin.accountId);
    expect(await db.one("select wants_news, email from public.my_event_news()")).toEqual({
      wants_news: false,
      email: null,
    });
  });

  test("typing the sign-in email again is the same as using it", async () => {
    const db = await freshDb();
    const robin = await memberWithEmail(db, "Robin Example", "robin@example.test");
    await db.as(robin.accountId);
    await db.value("select public.set_event_news(true, 'ROBIN@example.test')");
    expect(await db.value("select email from public.my_event_news()")).toBeNull();
  });

  test("a bad email is refused", async () => {
    const db = await freshDb();
    const robin = await memberWithEmail(db, "Robin Example", "robin@example.test");
    await db.as(robin.accountId);
    await expect(db.value("select public.set_event_news(true, 'not an email')")).rejects.toThrow(/email_invalid/);
  });

  test("only admins see the list, and deactivated people drop off it", async () => {
    const db = await freshDb();
    const admin = await memberWithEmail(db, "Admin Example", "admin@example.test", { admin: true });
    const robin = await memberWithEmail(db, "Robin Example", "robin@example.test");
    const sam = await memberWithEmail(db, "Sam Example", "sam@example.test");
    for (const m of [robin, sam]) {
      await db.as(m.accountId);
      await db.value("select public.set_event_news(true)");
    }

    await db.as(robin.accountId);
    expect(await db.rows("select * from public.admin_contact_list()")).toEqual([]);
    await db.asAnon();
    await expect(db.rows("select * from public.admin_contact_list()")).rejects.toThrow(/permission denied/);

    await db.asSystem();
    await db.run("update public.accounts set status = 'deactivated' where id = $1", [sam.accountId]);
    expect((await contactList(db, admin.accountId)).map((r) => r.full_name)).toEqual(["Robin Example"]);
  });

  test("members can't read the answers table directly", async () => {
    const db = await freshDb();
    const robin = await memberWithEmail(db, "Robin Example", "robin@example.test");
    await db.as(robin.accountId);
    await expect(db.rows("select * from private.event_news")).rejects.toThrow(/permission denied/);
  });
});
