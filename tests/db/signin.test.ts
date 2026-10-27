import { describe, expect, test } from "vitest";
import { freshDb, TestDb } from "./helpers";

async function joinLink(db: TestDb) {
  const inviter = await db.member("Inviter Example");
  await db.as(inviter.accountId);
  const secret = await db.value<string>("select public.create_invitation('join', null, 'Cousin Robin')");
  return { inviter, secret };
}

describe("the sign-up gate (runs before Supabase creates any new sign-in user)", () => {
  test("refuses sign-ups without an invitation", async () => {
    const db = await freshDb();
    expect((await db.signUpGate()).error?.message).toMatch(/invitation-only/);
    expect((await db.signUpGate("made-up-secret")).error?.message).toMatch(/not valid/);
  });

  test("allows a sign-up carrying a valid invitation", async () => {
    const db = await freshDb();
    const { secret } = await joinLink(db);
    expect(await db.signUpGate(secret)).toEqual({});
  });

  test("refuses used, expired and revoked invitations", async () => {
    const db = await freshDb();
    const { inviter, secret: used } = await joinLink(db);
    await db.as(inviter.accountId);
    const expired = await db.value<string>("select public.create_invitation('join')");
    const revoked = await db.value<string>("select public.create_invitation('join')");
    await db.asSystem();
    await db.run("update public.invitations set expires_at = now() - interval '1 minute' where token_hash = sha256(convert_to($1, 'UTF8'))", [expired]);
    await db.run("update public.invitations set revoked_at = now() where token_hash = sha256(convert_to($1, 'UTF8'))", [revoked]);
    const joiner = await db.signUp({ invitation: used });
    await db.as(joiner);
    await db.value("select public.accept_invitation($1)", [used]);

    for (const secret of [used, expired, revoked]) {
      expect((await db.signUpGate(secret)).error?.message).toMatch(/not valid/);
    }
  });

  test("once someone finishes signing in with a link, nobody else can sign up with it", async () => {
    const db = await freshDb();
    const { secret } = await joinLink(db);
    await db.signUp({ invitation: secret, confirmed: true });
    expect((await db.signUpGate(secret)).error?.message).toMatch(/not valid/);
  });

  test("a mistyped email does not use up the link", async () => {
    const db = await freshDb();
    const { secret } = await joinLink(db);
    await db.signUp({ invitation: secret, confirmed: false }); // code sent to a typo, never entered
    expect(await db.signUpGate(secret)).toEqual({});
  });

  test("refuses loudly if attached to the wrong Supabase hook", async () => {
    const db = await freshDb();
    const { secret } = await joinLink(db);
    expect((await db.signUpGate(secret, "send-email")).error?.message).toMatch(/Send Email hook/);
  });

  test("app users cannot call the gate", async () => {
    const db = await freshDb();
    const { inviter } = await joinLink(db);
    await db.as(inviter.accountId);
    await expect(db.value("select private.before_user_created('{}'::jsonb)")).rejects.toThrow(/permission denied/);
  });
});

describe("pending accounts", () => {
  test("a new account sees nothing and can do nothing until it accepts an invitation", async () => {
    const db = await freshDb();
    const { secret } = await joinLink(db);
    const joiner = await db.signUp({ invitation: secret });
    await db.as(joiner);
    expect(await db.rows("select * from public.directory_profiles()")).toHaveLength(0);
    await expect(db.value("select public.create_my_profile('Robin Newcomer')")).rejects.toThrow(/not_signed_in/);
    await expect(db.value("select public.create_invitation('join')")).rejects.toThrow(/not_signed_in/);

    await db.value("select public.accept_invitation($1)", [secret]);
    expect(await db.value("select status from public.accounts where id = $1", [joiner])).toBe("active");
    expect(await db.value("select public.create_my_profile('Robin Newcomer')")).toBeTruthy();
    expect((await db.rows("select * from public.directory_profiles()")).length).toBe(2);
  });

  test("accepting removes the secret from the sign-in record", async () => {
    const db = await freshDb();
    const { secret } = await joinLink(db);
    const joiner = await db.signUp({ invitation: secret });
    await db.as(joiner);
    await db.value("select public.accept_invitation($1)", [secret]);
    await db.asSystem();
    expect(await db.value("select raw_user_meta_data from auth.users where id = $1", [joiner])).toEqual({});
  });

  test("a second person cannot accept the same link", async () => {
    const db = await freshDb();
    const { secret } = await joinLink(db);
    const first = await db.signUp({ invitation: secret, confirmed: false });
    const second = await db.signUp({ invitation: secret });
    await db.as(second);
    await db.value("select public.accept_invitation($1)", [secret]);
    await db.as(first);
    await expect(db.value("select public.accept_invitation($1)", [secret])).rejects.toThrow(/invitation_already_used/);
    await db.asSystem();
    expect(await db.value("select status from public.accounts where id = $1", [first])).toBe("pending");
  });

  test("a claim invitation links the profile and activates the account in one step", async () => {
    const db = await freshDb();
    const admin = await db.member("Avery Admin", { admin: true });
    const imported = await db.profile({ full_name: "Imported Relative", source: "import" });
    await db.as(admin.accountId);
    const secret = await db.value<string>("select public.create_invitation('claim', $1)", [imported]);

    const relative = await db.signUp({ invitation: secret });
    await db.as(relative);
    await db.value("select public.accept_invitation($1)", [secret]);
    expect(await db.value("select id from public.directory_profiles() where is_me")).toBe(imported);
  });

  test("a deactivated account cannot accept invitations", async () => {
    const db = await freshDb();
    const { secret } = await joinLink(db);
    const gone = await db.account({ deactivated: true });
    await db.as(gone);
    await expect(db.value("select public.accept_invitation($1)", [secret])).rejects.toThrow(/not_signed_in/);
  });
});

describe("family photo on the invitation page", () => {
  async function withPhoto(db: TestDb) {
    await db.asSystem();
    await db.run(
      "insert into private.site_photos (name, image, caption) values ('invitation', '\\xffd8ffe0'::bytea, 'Our reunion')",
    );
  }

  test("shown with a valid invitation, even before signing in", async () => {
    const db = await freshDb();
    const { secret } = await joinLink(db);
    await withPhoto(db);
    await db.asAnon();
    expect(await db.rows("select image_base64, caption from public.invitation_photo($1)", [secret])).toEqual([
      { image_base64: "/9j/4A==", caption: "Our reunion" },
    ]);
    expect(await db.value("select public.invitation_preview($1)", [secret])).toMatchObject({ has_photo: true, photo_caption: "Our reunion" });
  });

  test("never shown for made-up, used, expired or cancelled links", async () => {
    const db = await freshDb();
    const { inviter, secret: used } = await joinLink(db);
    await db.as(inviter.accountId);
    const expired = await db.value<string>("select public.create_invitation('join')");
    const revoked = await db.value<string>("select public.create_invitation('join')");
    await withPhoto(db);
    await db.run("update public.invitations set expires_at = now() - interval '1 minute' where token_hash = sha256(convert_to($1, 'UTF8'))", [expired]);
    await db.run("update public.invitations set revoked_at = now() where token_hash = sha256(convert_to($1, 'UTF8'))", [revoked]);
    const joiner = await db.signUp({ invitation: used });
    await db.as(joiner);
    await db.value("select public.accept_invitation($1)", [used]);

    await db.asAnon();
    for (const secret of ["made-up", used, expired, revoked]) {
      expect(await db.rows("select * from public.invitation_photo($1)", [secret])).toEqual([]);
    }
  });

  test("the photo table itself can't be read by app users", async () => {
    const db = await freshDb();
    await withPhoto(db);
    await db.asAnon();
    await expect(db.rows("select * from private.site_photos")).rejects.toThrow(/permission denied/);
  });
});

describe("invitation preview (shown before signing in)", () => {
  test("shows who sent it and who it is for, without signing in", async () => {
    const db = await freshDb();
    const { secret } = await joinLink(db);
    await db.asAnon();
    expect(await db.value("select public.invitation_preview($1)", [secret])).toEqual({
      status: "valid",
      kind: "join",
      recipient_label: "Cousin Robin",
      inviter_name: "Inviter",
      profile_name: null,
      has_photo: false,
      photo_caption: null,
      member_count: 1,
    });
  });

  test("counts who is in the directory, leaving out archived profiles", async () => {
    const db = await freshDb();
    const { secret } = await joinLink(db);
    await db.profile({ full_name: "Imported Relative" });
    const archived = await db.profile({ full_name: "Archived Relative" });
    await db.asSystem();
    await db.run("update public.profiles set archived_at = now() where id = $1", [archived]);
    await db.asAnon();
    expect(await db.value("select public.invitation_preview($1)", [secret])).toMatchObject({ member_count: 2 });
  });

  test("a claim invitation names the profile, so the page can ask 'Is this you?'", async () => {
    const db = await freshDb();
    const admin = await db.member("Avery Admin", { admin: true });
    const imported = await db.profile({ full_name: "Imported Relative" });
    await db.as(admin.accountId);
    const secret = await db.value<string>("select public.create_invitation('claim', $1)", [imported]);
    await db.asAnon();
    expect(await db.value("select public.invitation_preview($1)", [secret])).toMatchObject({
      status: "valid",
      kind: "claim",
      profile_name: "Imported Relative",
    });
  });

  test("reports used and unknown links without revealing anything else", async () => {
    const db = await freshDb();
    const { secret } = await joinLink(db);
    const joiner = await db.signUp({ invitation: secret });
    await db.as(joiner);
    await db.value("select public.accept_invitation($1)", [secret]);
    await db.asAnon();
    expect(await db.value("select public.invitation_preview($1)", [secret])).toMatchObject({ status: "used", member_count: null });
    expect(await db.value("select public.invitation_preview('nope')")).toEqual({ status: "invalid" });
  });
});
