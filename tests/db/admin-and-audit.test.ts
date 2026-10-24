import { describe, expect, test } from "vitest";
import { freshDb } from "./helpers";

describe("admin powers", () => {
  test("ordinary members cannot use admin actions", async () => {
    const db = await freshDb();
    const member = await db.member("Member Example");
    const other = await db.member("Other Example");
    await db.as(member.accountId);
    await expect(db.value("select public.admin_set_account_status($1, 'deactivated')", [other.accountId])).rejects.toThrow(
      /not_allowed/,
    );
    await expect(db.value("select public.admin_set_account_role($1, 'admin')", [member.accountId])).rejects.toThrow(
      /not_allowed/,
    );
    await expect(db.value("select public.admin_unlink_profile($1)", [other.profileId])).rejects.toThrow(/not_allowed/);
  });

  test("deactivating an account cuts off access immediately", async () => {
    const db = await freshDb();
    const admin = await db.member("Avery Admin", { admin: true });
    const member = await db.member("Member Example");
    await db.as(admin.accountId);
    await db.value("select public.admin_set_account_status($1, 'deactivated')", [member.accountId]);
    await db.as(member.accountId);
    expect(await db.rows("select * from public.directory_profiles()")).toHaveLength(0);
  });

  test("the last admin cannot be deactivated or demoted", async () => {
    const db = await freshDb();
    const admin = await db.member("Avery Admin", { admin: true });
    await db.as(admin.accountId);
    await expect(db.value("select public.admin_set_account_status($1, 'deactivated')", [admin.accountId])).rejects.toThrow(
      /cannot_remove_last_admin/,
    );
    await expect(db.value("select public.admin_set_account_role($1, 'member')", [admin.accountId])).rejects.toThrow(
      /cannot_remove_last_admin/,
    );
  });

  test("an admin can undo a mistaken claim", async () => {
    const db = await freshDb();
    const admin = await db.member("Avery Admin", { admin: true });
    const member = await db.member("Member Example");
    await db.as(admin.accountId);
    await db.value("select public.admin_unlink_profile($1)", [member.profileId]);
    await db.as(member.accountId);
    expect(await db.value("select (select id from public.directory_profiles() where is_me)")).toBeNull();
  });
});

describe("admin overviews", () => {
  test("only admins see sign-in emails and account status", async () => {
    const db = await freshDb();
    const admin = await db.member("Avery Admin", { admin: true });
    const member = await db.member("Member Example");
    await db.asSystem();
    await db.run("update auth.users set email = 'member@example.test' where id = $1", [member.accountId]);

    await db.as(admin.accountId);
    expect(await db.rows("select email, role, full_name from public.admin_accounts() where account_id = $1", [member.accountId])).toEqual([
      { email: "member@example.test", role: "member", full_name: "Member Example" },
    ]);
    await db.as(member.accountId);
    expect(await db.rows("select * from public.admin_accounts()")).toEqual([]);
  });

  test("only admins see pending claim requests, with the requester's email", async () => {
    const db = await freshDb();
    const admin = await db.member("Avery Admin", { admin: true });
    const unclaimed = await db.profile({ full_name: "Imported Relative" });
    const claimant = await db.account();
    await db.asSystem();
    await db.run("update auth.users set email = 'claimant@example.test' where id = $1", [claimant]);
    await db.as(claimant);
    await db.value("select public.request_profile_claim($1, 'This is me')", [unclaimed]);

    expect(await db.rows("select * from public.admin_claim_requests()")).toEqual([]);
    await db.as(admin.accountId);
    expect(await db.rows("select profile_name, requester_email, message from public.admin_claim_requests()")).toEqual([
      { profile_name: "Imported Relative", requester_email: "claimant@example.test", message: "This is me" },
    ]);
  });
});

describe("audit log", () => {
  test("profile edits are logged with field names, not the personal values", async () => {
    const db = await freshDb();
    const member = await db.member("Member Example");
    await db.as(member.accountId);
    await db.run("update public.profiles set phone = '555-0100', city = 'Reno' where id = $1", [member.profileId]);
    await db.asSystem();
    const entry = await db.one<{ actor_id: string; details: { fields: string[] } }>(
      "select actor_id, details from public.audit_log where action = 'profile.updated'",
    );
    expect(entry.actor_id).toBe(member.accountId);
    expect(entry.details.fields).toEqual(["city", "phone"]);
    expect(JSON.stringify(entry)).not.toContain("555-0100");
  });

  test("only admins can read the log", async () => {
    const db = await freshDb();
    const admin = await db.member("Avery Admin", { admin: true });
    const member = await db.member("Member Example");
    await db.as(member.accountId);
    await db.run("update public.profiles set city = 'Reno' where id = $1", [member.profileId]);
    expect(await db.rows("select * from public.audit_log")).toHaveLength(0);
    await db.as(admin.accountId);
    expect((await db.rows("select * from public.audit_log")).length).toBeGreaterThan(0);
  });

  test("no one can change or delete log entries, not even the database owner", async () => {
    const db = await freshDb();
    const admin = await db.member("Avery Admin", { admin: true });
    await db.as(admin.accountId);
    await db.run("update public.profiles set city = 'Reno' where id = $1", [admin.profileId]);
    await expect(db.run("delete from public.audit_log")).rejects.toThrow(/permission denied/);
    await db.asSystem();
    await expect(db.run("update public.audit_log set action = 'edited'")).rejects.toThrow(/audit_log_is_append_only/);
    await expect(db.run("delete from public.audit_log")).rejects.toThrow(/audit_log_is_append_only/);
  });
});
