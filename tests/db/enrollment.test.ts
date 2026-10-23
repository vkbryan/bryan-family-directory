import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { freshDb } from "./helpers";

describe("join invitations", () => {
  test("any member can invite; each link works once", async () => {
    const db = await freshDb();
    const inviter = await db.member("Inviter Example");
    await db.as(inviter.accountId);
    const secret = await db.value<string>("select public.create_invitation('join', null, 'Cousin Robin')");

    const newcomer = await db.account();
    await db.as(newcomer);
    expect(await db.value("select public.accept_invitation($1)", [secret])).toEqual({ kind: "join", profile_id: null });
    await expect(db.value("select public.accept_invitation($1)", [secret])).rejects.toThrow(/invitation_already_used/);
  });

  test("admins can turn off member invitations", async () => {
    const db = await freshDb();
    const member = await db.member("Member Example");
    const admin = await db.member("Avery Admin", { admin: true });
    await db.asSystem();
    await db.run("update public.app_settings set members_can_invite = false");
    await db.as(member.accountId);
    await expect(db.value("select public.create_invitation('join')")).rejects.toThrow(/not_allowed/);
    await db.as(admin.accountId);
    expect(await db.value("select public.create_invitation('join')")).toBeTruthy();
  });

  test("only a fingerprint of the link's secret is stored", async () => {
    const db = await freshDb();
    const inviter = await db.member("Inviter Example");
    await db.as(inviter.accountId);
    const secret = await db.value<string>("select public.create_invitation('join')");
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
    await db.asSystem();
    const stored = await db.value<Uint8Array>("select token_hash from public.invitations");
    expect(Buffer.from(stored).toString("hex")).toBe(createHash("sha256").update(secret).digest("hex"));
  });

  test("expired, revoked and made-up links are refused", async () => {
    const db = await freshDb();
    const inviter = await db.member("Inviter Example");
    await db.as(inviter.accountId);
    const expired = await db.value<string>("select public.create_invitation('join')");
    const revoked = await db.value<string>("select public.create_invitation('join')");
    await db.asSystem();
    await db.run("update public.invitations set expires_at = now() - interval '1 day' where token_hash = sha256(convert_to($1, 'UTF8'))", [expired]);
    await db.as(inviter.accountId);
    const revokedId = await db.value<string>(
      "select id from public.invitations where token_hash = sha256(convert_to($1, 'UTF8'))",
      [revoked],
    );
    await db.value("select public.revoke_invitation($1)", [revokedId]);

    const newcomer = await db.account();
    await db.as(newcomer);
    await expect(db.value("select public.accept_invitation($1)", [expired])).rejects.toThrow(/invitation_expired/);
    await expect(db.value("select public.accept_invitation($1)", [revoked])).rejects.toThrow(/invitation_revoked/);
    await expect(db.value("select public.accept_invitation('not-a-real-link')")).rejects.toThrow(/invitation_invalid/);
  });

  test("members see only invitations they sent", async () => {
    const db = await freshDb();
    const a = await db.member("A Example");
    const b = await db.member("B Example");
    await db.as(a.accountId);
    await db.value("select public.create_invitation('join')");
    await db.as(b.accountId);
    expect(await db.rows("select id from public.invitations")).toHaveLength(0);
  });
});

describe("claiming an existing profile", () => {
  test("an admin's claim invitation links the profile to whoever accepts it", async () => {
    const db = await freshDb();
    const admin = await db.member("Avery Admin", { admin: true });
    const unclaimed = await db.profile({ full_name: "Imported Relative", source: "import" });
    await db.as(admin.accountId);
    const secret = await db.value<string>("select public.create_invitation('claim', $1)", [unclaimed]);

    const relative = await db.account();
    await db.as(relative);
    await db.value("select public.accept_invitation($1)", [secret]);
    expect(await db.value("select public.my_profile_id()")).toBe(unclaimed);
    expect(await db.run("update public.profiles set city = 'Reno' where id = $1", [unclaimed])).toBe(1);

    await db.as(admin.accountId);
    await expect(db.value("select public.create_invitation('claim', $1)", [unclaimed])).rejects.toThrow(
      /profile_already_claimed/,
    );
  });

  test("ordinary members cannot create claim invitations for adults", async () => {
    const db = await freshDb();
    const member = await db.member("Member Example");
    const unclaimed = await db.profile({ full_name: "Imported Relative" });
    await db.as(member.accountId);
    await expect(db.value("select public.create_invitation('claim', $1)", [unclaimed])).rejects.toThrow(/not_allowed/);
  });

  test("someone who already has a profile cannot claim a second one", async () => {
    const db = await freshDb();
    const admin = await db.member("Avery Admin", { admin: true });
    const existing = await db.member("Has Profile");
    const unclaimed = await db.profile({ full_name: "Imported Relative" });
    await db.as(admin.accountId);
    const secret = await db.value<string>("select public.create_invitation('claim', $1)", [unclaimed]);
    await db.as(existing.accountId);
    await expect(db.value("select public.accept_invitation($1)", [secret])).rejects.toThrow(/already_has_profile/);
  });

  test("memorial profiles cannot be claimed", async () => {
    const db = await freshDb();
    const admin = await db.member("Avery Admin", { admin: true });
    const memorial = await db.profile({ full_name: "Remembered Relative", is_living: false });
    await db.as(admin.accountId);
    await expect(db.value("select public.create_invitation('claim', $1)", [memorial])).rejects.toThrow(
      /memorial_profiles_cannot_be_claimed/,
    );
  });

  test("claiming without an invitation needs an admin's approval", async () => {
    const db = await freshDb();
    const admin = await db.member("Avery Admin", { admin: true });
    const member = await db.member("Member Example");
    const unclaimed = await db.profile({ full_name: "Imported Relative" });
    const claimant = await db.account();

    await db.as(claimant);
    const requestId = await db.value<string>("select public.request_profile_claim($1, 'This is me')", [unclaimed]);
    expect(await db.value("select public.my_profile_id()")).toBeNull();

    await db.as(member.accountId);
    await expect(db.value("select public.decide_profile_request($1, true)", [requestId])).rejects.toThrow(/not_allowed/);

    await db.as(admin.accountId);
    await db.value("select public.decide_profile_request($1, true)", [requestId]);
    await db.as(claimant);
    expect(await db.value("select public.my_profile_id()")).toBe(unclaimed);
  });
});
