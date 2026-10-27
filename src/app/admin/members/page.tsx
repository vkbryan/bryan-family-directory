import Link from "next/link";
import { Suspense } from "react";
import { formatDate, invitationStatus, requireAdminViewer } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { Card, Loading } from "@/components/ui";
import { revokeInvitation, setAccountRole, setAccountStatus } from "../actions";
import { ConfirmButton } from "../confirm-button";

export const metadata = { title: "Members · Admin" };

export default function MembersPage() {
  return (
    <>
      <h1 className="text-3xl font-bold">Members</h1>
      <Suspense fallback={<Loading />}>
        <MembersContent />
      </Suspense>
    </>
  );
}

const statusLabel = { active: "Active", pending: "Signed in, not connected", deactivated: "Deactivated" };

/** A pending account that never signed in asked for a code and never typed it in: worth a nudge. */
function accountStatus(a: { status: keyof typeof statusLabel; last_sign_in_at: string | null }) {
  return a.status === "pending" && !a.last_sign_in_at ? "Asked for a code, never entered it" : statusLabel[a.status];
}

async function MembersContent() {
  const viewer = await requireAdminViewer();
  const supabase = await createClient();
  const [{ data: accounts }, { data: invitations }, { data: profiles }] = await Promise.all([
    supabase.rpc("admin_accounts"),
    supabase
      .from("invitations")
      .select("id, kind, recipient_label, created_by, created_at, expires_at, accepted_at, revoked_at, profile_id")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("profiles").select("id, full_name, account_id"),
  ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const nameByAccount = new Map((profiles ?? []).filter((p) => p.account_id).map((p) => [p.account_id!, p.full_name]));

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Accounts ({accounts?.length ?? 0})</h2>
        <p className="text-muted">
          Everyone who has signed in. Deactivating someone stops them signing in or seeing anything right away; their
          profile stays, and you can reactivate them later.
        </p>
        <ul className="flex flex-col gap-3">
          {(accounts ?? []).map((a) => {
            const isMe = a.account_id === viewer.profile.id || a.profile_id === viewer.profile.id;
            return (
              <li key={a.account_id}>
                <Card className="flex flex-col gap-3">
                  <div>
                    <p className="text-lg font-semibold">
                      {a.profile_id ? <Link href={`/people/${a.profile_id}`}>{a.full_name}</Link> : "No profile yet"}
                      {a.role === "admin" && <span className="text-muted"> · admin</span>}
                      {isMe && <span className="text-muted"> · you</span>}
                    </p>
                    <p className="break-all text-sm">{a.email}</p>
                    <p className="text-sm text-muted">
                      {accountStatus(a)} · joined {formatDate(a.created_at)} · last signed in {formatDate(a.last_sign_in_at)}
                    </p>
                  </div>
                  {!isMe && (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      {a.status === "deactivated" ? (
                        <ConfirmButton label="Reactivate" action={setAccountStatus.bind(null, a.account_id, "active")} />
                      ) : (
                        <ConfirmButton
                          label="Deactivate"
                          confirmText={`Deactivate ${a.full_name ?? a.email}? They won't be able to sign in until you reactivate them.`}
                          action={setAccountStatus.bind(null, a.account_id, "deactivated")}
                        />
                      )}
                      {a.status === "active" &&
                        (a.role === "admin" ? (
                          <ConfirmButton
                            label="Remove admin"
                            confirmText={`Remove admin rights from ${a.full_name ?? a.email}?`}
                            action={setAccountRole.bind(null, a.account_id, "member")}
                          />
                        ) : (
                          <ConfirmButton
                            label="Make admin"
                            confirmText={`Make ${a.full_name ?? a.email} an admin? Admins can edit every profile and manage accounts.`}
                            action={setAccountRole.bind(null, a.account_id, "admin")}
                          />
                        ))}
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Recent invitation links</h2>
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface px-4">
          {(invitations ?? []).map((inv) => {
            const status = invitationStatus(inv);
            const kind = { join: "Join", claim: "Claim", co_guardian: "Co-parent" }[inv.kind];
            const target = inv.profile_id ? nameById.get(inv.profile_id) : inv.recipient_label;
            return (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span>
                  <strong>{kind}</strong>
                  {target ? ` · ${target}` : ""}
                  <span className="block text-sm text-muted">
                    {status} · made by {inv.created_by ? (nameByAccount.get(inv.created_by) ?? "a member") : "setup"} on{" "}
                    {formatDate(inv.created_at)}
                  </span>
                </span>
                {status === "Waiting" && (
                  <ConfirmButton
                    label="Cancel link"
                    confirmText="Cancel this link? It will stop working."
                    action={revokeInvitation.bind(null, inv.id)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
