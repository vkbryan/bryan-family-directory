import { describe, expect, test } from "vitest";
import { freshDb, TestDb } from "./helpers";

async function groupLink(db: TestDb, maxUses = 50) {
  const admin = await db.member("Admin Example", { admin: true });
  await db.as(admin.accountId);
  const secret = await db.value<string>("select public.create_group_link('Family chat', $1)", [maxUses]);
  return { admin, secret };
}

/** Someone new signs up with the link and enters their code. */
async function join(db: TestDb, secret: string) {
  const id = await db.signUp({ invitation: secret });
  await db.as(id);
  await db.value("select public.accept_invitation($1)", [secret]);
  await db.asSystem();
  return id;
}

const uses = (db: TestDb, secret: string) =>
  db.asSystem().then(() =>
    db.value<number>("select use_count from public.invitations where token_hash = sha256(convert_to($1, 'UTF8'))", [secret]),
  );

describe("group links (for the family WhatsApp chat)", () => {
  test("only admins can make one, and it expires in 14 days", async () => {
    const db = await freshDb();
    const member = await db.member("Member Example");
    await db.as(member.accountId);
    await expect(db.value("select public.create_group_link('Family chat')")).rejects.toThrow(/not_allowed/);

    const { secret } = await groupLink(db);
    await db.asSystem();
    const days = await db.value<number>(
      "select round(extract(epoch from expires_at - now()) / 86400) from public.invitations where token_hash = sha256(convert_to($1, 'UTF8'))",
      [secret],
    );
    expect(Number(days)).toBe(14);
  });

  test("many people can join with the same link, each straight in", async () => {
    const db = await freshDb();
    const { secret } = await groupLink(db);
    const first = await join(db, secret);
    const second = await join(db, secret);
    for (const id of [first, second]) {
      expect(await db.value("select status from public.accounts where id = $1", [id])).toBe("active");
    }
    expect(await uses(db, secret)).toBe(2);
    expect(await db.signUpGate(secret)).toEqual({});
  });

  test("stops working once full", async () => {
    const db = await freshDb();
    const { secret } = await groupLink(db, 2);
    await join(db, secret);
    await join(db, secret);
    expect((await db.signUpGate(secret)).error?.message).toMatch(/not valid/);

    // Someone who signed up just before it filled can't squeeze in.
    const late = await db.signUp({ invitation: secret });
    await db.as(late);
    await expect(db.value("select public.accept_invitation($1)", [secret])).rejects.toThrow(/invitation_full/);

    await db.asAnon();
    expect(await db.value("select public.invitation_preview($1) ->> 'status'", [secret])).toBe("full");
  });

  test("a member opening it again is let through without using a place", async () => {
    const db = await freshDb();
    const { secret } = await groupLink(db);
    const member = await db.member("Member Example");
    await db.as(member.accountId);
    await db.value("select public.accept_invitation($1)", [secret]);
    expect(await uses(db, secret)).toBe(0);
  });

  test("cancelled and expired group links refuse sign-ups", async () => {
    const db = await freshDb();
    const { admin, secret: cancelled } = await groupLink(db);
    await db.as(admin.accountId);
    const expired = await db.value<string>("select public.create_group_link('Old chat')");
    const id = await db.value<string>(
      "select id from public.invitations where token_hash = sha256(convert_to($1, 'UTF8'))",
      [cancelled],
    );
    await db.value("select public.revoke_invitation($1)", [id]);
    await db.asSystem();
    await db.run("update public.invitations set expires_at = now() - interval '1 minute' where token_hash = sha256(convert_to($1, 'UTF8'))", [expired]);

    for (const secret of [cancelled, expired]) {
      expect((await db.signUpGate(secret)).error?.message).toMatch(/not valid/);
    }
  });

  test("the invitation page knows it is a group link", async () => {
    const db = await freshDb();
    const { secret } = await groupLink(db);
    await db.asAnon();
    const preview = await db.value<Record<string, unknown>>("select public.invitation_preview($1)", [secret]);
    expect(preview).toMatchObject({ status: "valid", kind: "join", is_group: true });
  });

  test("one-person links still close after one use", async () => {
    const db = await freshDb();
    const inviter = await db.member("Inviter Example");
    await db.as(inviter.accountId);
    const secret = await db.value<string>("select public.create_invitation('join', null, 'Cousin Robin')");
    await join(db, secret);
    expect((await db.signUpGate(secret)).error?.message).toMatch(/not valid/);
    await db.asAnon();
    expect(await db.value("select public.invitation_preview($1) ->> 'is_group'", [secret])).toBe("false");
  });
});
