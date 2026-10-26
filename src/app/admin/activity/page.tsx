import { Suspense } from "react";
import { formatDateTime, requireAdminViewer } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { Card, Loading } from "@/components/ui";

export const metadata = { title: "Activity · Admin" };

export default function ActivityPage() {
  return (
    <>
      <h1 className="text-3xl font-bold">Activity</h1>
      <p className="text-muted">
        The last 100 important changes, newest first. This log can&apos;t be edited or deleted, by anyone.
      </p>
      <Suspense fallback={<Loading />}>
        <ActivityContent />
      </Suspense>
    </>
  );
}

const describe: Record<string, string> = {
  "profile.created_self": "joined and created their profile",
  "profile.updated": "updated a profile",
  "profile.claimed": "claimed a profile",
  "profile.handed_over": "took over their profile from a guardian",
  "profile.unlinked": "unlinked a profile from its account",
  "profile.status_set": "changed a profile's memorial/archive status",
  "child.created": "added a child",
  "guardian.added": "added a guardian",
  "guardian.removed": "removed a guardian",
  "invitation.created": "made an invitation link",
  "invitation.accepted": "accepted an invitation",
  "invitation.revoked": "cancelled an invitation link",
  "request.claim_created": "asked to claim a profile",
  "request.co_guardian_created": "asked to help manage a child",
  "request.approved": "approved a request",
  "request.denied": "declined a request",
  "account.deactivated": "deactivated an account",
  "account.active": "reactivated an account",
  "account.role_set": "changed an account's role",
  "import.airtable": "imported the Airtable records",
  "branches.added": "added family branches",
  "profiles.states_tidied": "tidied state names (GA and NY written in full)",
};

async function ActivityContent() {
  await requireAdminViewer();
  const supabase = await createClient();
  const [{ data: entries }, { data: profiles }] = await Promise.all([
    supabase.from("audit_log").select("id, at, actor_id, action, profile_id, details").order("at", { ascending: false }).limit(100),
    supabase.from("profiles").select("id, full_name, account_id"),
  ]);
  const byAccount = new Map((profiles ?? []).filter((p) => p.account_id).map((p) => [p.account_id!, p.full_name]));
  const byProfile = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return (
    <Card>
      <ul className="flex flex-col divide-y divide-border">
        {(entries ?? []).map((e) => {
          const who = e.actor_id ? (byAccount.get(e.actor_id) ?? "A member") : "Setup or import";
          const about = e.profile_id ? byProfile.get(e.profile_id) : null;
          const fields =
            e.action === "profile.updated" && e.details && typeof e.details === "object" && "fields" in e.details
              ? (e.details.fields as string[]).filter((f) => !f.endsWith("_by") && f !== "legacy").join(", ")
              : null;
          return (
            <li key={e.id} className="flex flex-col gap-0.5 py-3">
              <p>
                <strong>{who}</strong> {describe[e.action] ?? e.action}
                {about && <> · {about}</>}
              </p>
              <p className="text-sm text-muted">
                {formatDateTime(e.at)}
                {fields ? ` · changed: ${fields.replaceAll("_", " ")}` : ""}
              </p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
