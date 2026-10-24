import Link from "next/link";
import { Suspense } from "react";
import { formatDate, requireAdminViewer } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { Card, Loading } from "@/components/ui";
import { decideRequest } from "../actions";
import { ConfirmButton } from "../confirm-button";

export const metadata = { title: "Requests · Admin" };

export default function RequestsPage() {
  return (
    <>
      <h1 className="text-3xl font-bold">Requests</h1>
      <Suspense fallback={<Loading />}>
        <RequestsContent />
      </Suspense>
    </>
  );
}

async function RequestsContent() {
  await requireAdminViewer();
  const supabase = await createClient();
  const [{ data: claims }, { data: coRequests }, { data: accounts }, { data: profiles }] = await Promise.all([
    supabase.rpc("admin_claim_requests"),
    supabase
      .from("profile_requests")
      .select("id, profile_id, requester_id, message, created_at")
      .eq("kind", "co_guardian")
      .eq("status", "pending")
      .order("created_at"),
    supabase.rpc("admin_accounts"),
    supabase.from("profiles").select("id, full_name"),
  ]);
  const accountName = new Map((accounts ?? []).map((a) => [a.account_id, a.full_name ?? a.email]));
  const profileName = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">&ldquo;This is me&rdquo; claims</h2>
        <p className="text-muted">
          Someone signed in without a claim link and says an existing profile is theirs. Approve only if you&apos;re
          sure. If in doubt, contact them first; the email is the one they signed in with.
        </p>
        {(claims ?? []).length === 0 ? (
          <Card>
            <p>No claims waiting.</p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {(claims ?? []).map((c) => (
              <li key={c.id}>
                <Card className="flex flex-col gap-3">
                  <p>
                    <strong className="break-all">{c.requester_email}</strong> says they are{" "}
                    <Link href={`/people/${c.profile_id}`}>{c.profile_name}</Link>
                  </p>
                  {c.message && <p className="text-muted">&ldquo;{c.message}&rdquo;</p>}
                  <p className="text-sm text-muted">Asked {formatDate(c.created_at)}</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <ConfirmButton
                      variant="primary"
                      label="Approve"
                      confirmText={`Give ${c.requester_email} the profile of ${c.profile_name}?`}
                      action={decideRequest.bind(null, c.id, true)}
                    />
                    <ConfirmButton label="Decline" confirmText="Decline this claim?" action={decideRequest.bind(null, c.id, false)} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Asking to help manage a child</h2>
        <p className="text-muted">A child&apos;s current guardians can approve these too. If a child has no guardian yet, only an admin can.</p>
        {(coRequests ?? []).length === 0 ? (
          <Card>
            <p>No requests waiting.</p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {(coRequests ?? []).map((r) => (
              <li key={r.id}>
                <Card className="flex flex-col gap-3">
                  <p>
                    <strong>{accountName.get(r.requester_id) ?? "A member"}</strong> asks to help manage{" "}
                    <Link href={`/people/${r.profile_id}`}>{profileName.get(r.profile_id) ?? "a child"}</Link>
                  </p>
                  {r.message && <p className="text-muted">&ldquo;{r.message}&rdquo;</p>}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <ConfirmButton variant="primary" label="Approve" action={decideRequest.bind(null, r.id, true)} />
                    <ConfirmButton label="Decline" confirmText="Decline this request?" action={decideRequest.bind(null, r.id, false)} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
