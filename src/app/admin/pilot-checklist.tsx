import Link from "next/link";
import { daysAgo, formatDate, invitationStatus } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";

// One row per person invited in the last 60 days, with ✓ marks built from what
// the site already records (no extra tracking): did they join, update their
// profile, add a photo, birthday, contact details, interests, children, and
// when did they last sign in.

type Step = { label: string; done: boolean };

const SINCE_DAYS = 60;

export async function PilotChecklist({ myAccountId }: { myAccountId: string }) {
  const supabase = await createClient();
  const since = daysAgo(SINCE_DAYS);

  const [{ data: invitations }, { data: accounts }, { data: profiles }, { data: hobbyLinks }, { data: managers }, { data: edits }] =
    await Promise.all([
      supabase
        .from("invitations")
        .select("id, kind, recipient_label, profile_id, created_at, expires_at, accepted_at, accepted_by, revoked_at")
        .in("kind", ["join", "claim"])
        .gte("created_at", since)
        .order("created_at", { ascending: false }),
      supabase.rpc("admin_accounts"),
      supabase
        .from("profiles")
        .select("id, account_id, full_name, photo_path, birth_month, contact_email, phone, instagram, linkedin, website"),
      supabase.from("profile_hobbies").select("profile_id"),
      supabase.from("profile_managers").select("account_id").is("revoked_at", null),
      supabase.from("audit_log").select("actor_id, profile_id").eq("action", "profile.updated").gte("at", since),
    ]);

  // Not part of the pilot: cancelled links, your own sign-up, and deactivated accounts (like test accounts).
  const deactivated = new Set((accounts ?? []).filter((a) => a.status === "deactivated").map((a) => a.account_id));
  const rows = (invitations ?? []).filter(
    (i) => !i.revoked_at && i.accepted_by !== myAccountId && !(i.accepted_by && deactivated.has(i.accepted_by)),
  );
  if (rows.length === 0) {
    return (
      <Card className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Pilot checklist</h2>
        <p className="text-muted">
          Once you send invitations (Claim links or Invite a relative), each person appears here with their progress.
        </p>
      </Card>
    );
  }

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const profileByAccount = new Map((profiles ?? []).filter((p) => p.account_id).map((p) => [p.account_id!, p]));
  const lastSignIn = new Map((accounts ?? []).map((a) => [a.account_id, a.last_sign_in_at]));
  const hobbyCount = new Map<string, number>();
  for (const h of hobbyLinks ?? []) hobbyCount.set(h.profile_id, (hobbyCount.get(h.profile_id) ?? 0) + 1);
  const childCount = new Map<string, number>();
  for (const m of managers ?? []) childCount.set(m.account_id, (childCount.get(m.account_id) ?? 0) + 1);
  const editedOwn = new Set((edits ?? []).map((e) => `${e.actor_id}:${e.profile_id}`));

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">Pilot checklist</h2>
      <p className="text-muted">Everyone invited in the last {SINCE_DAYS} days, newest first.</p>
      <ul className="flex flex-col gap-3">
        {rows.map((inv) => {
          const account = inv.accepted_by;
          const profile = account ? profileByAccount.get(account) : inv.profile_id ? profileById.get(inv.profile_id) : undefined;
          const name = profile?.full_name ?? inv.recipient_label ?? "Someone you invited";
          const joined = Boolean(inv.accepted_at);
          const status = invitationStatus(inv);
          const steps: Step[] = [
            { label: "Joined", done: joined },
            { label: "Updated profile", done: Boolean(account && profile && editedOwn.has(`${account}:${profile.id}`)) },
            { label: "Photo", done: Boolean(joined && profile?.photo_path) },
            { label: "Birthday", done: Boolean(joined && profile?.birth_month) },
            {
              label: "Contact",
              done: Boolean(
                joined && (profile?.contact_email || profile?.phone || profile?.instagram || profile?.linkedin || profile?.website),
              ),
            },
            { label: "Interests", done: Boolean(joined && profile && (hobbyCount.get(profile.id) ?? 0) > 0) },
            { label: "Children", done: Boolean(account && (childCount.get(account) ?? 0) > 0) },
          ];
          return (
            <li key={inv.id}>
              <Card className="flex flex-col gap-3">
                <div>
                  <p className="text-lg font-semibold">
                    {profile ? <Link href={`/people/${profile.id}`}>{name}</Link> : name}
                  </p>
                  <p className="text-sm text-muted">
                    {inv.kind === "claim" ? "Claim link" : "Join link"} sent {formatDate(inv.created_at)}
                    {joined
                      ? ` · last visit ${formatDate(account ? (lastSignIn.get(account) ?? null) : null)}`
                      : status === "Expired"
                        ? " · link expired before they joined"
                        : " · hasn't joined yet"}
                  </p>
                </div>
                <ul className="flex flex-wrap gap-2" aria-label={`${name}'s progress`}>
                  {steps.map((s) => (
                    <li
                      key={s.label}
                      className={
                        s.done
                          ? "rounded-full bg-green-soft px-3 py-1 text-sm font-medium text-green-text"
                          : "rounded-full border border-border px-3 py-1 text-sm text-muted"
                      }
                    >
                      <span aria-hidden="true">{s.done ? "✓ " : "· "}</span>
                      {s.label}
                      <span className="sr-only">{s.done ? " done" : " not yet"}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
