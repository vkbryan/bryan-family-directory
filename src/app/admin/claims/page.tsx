import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button, Card, Loading } from "@/components/ui";
import { cancelInvitation } from "@/app/invitations/actions";
import { ClaimLinkButton } from "./claim-link-button";

export const metadata = { title: "Claim links · Bryan Family Directory" };

export default function ClaimsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Claim links</h1>
      <p className="text-lg">
        These relatives already have a profile but haven&apos;t claimed it yet. When you&apos;re ready to invite
        someone, make their link and send it. They&apos;ll see &ldquo;Is this you?&rdquo; and can take over their
        profile.
      </p>
      <Suspense fallback={<Loading />}>
        <ClaimsContent />
      </Suspense>
    </div>
  );
}

type Status = { label: string; invitationId?: string };

function linkStatus(invitations: { id: string; expires_at: string; accepted_at: string | null; revoked_at: string | null }[]): Status {
  const latest = invitations[0];
  if (!latest) return { label: "No link yet" };
  if (latest.accepted_at) return { label: "Link used" };
  if (latest.revoked_at) return { label: "Link cancelled" };
  if (new Date(latest.expires_at) < new Date()) return { label: "Link expired" };
  const days = Math.max(1, Math.ceil((new Date(latest.expires_at).getTime() - Date.now()) / 86_400_000));
  return { label: `Link sent, waiting (expires in ${days} day${days === 1 ? "" : "s"})`, invitationId: latest.id };
}

async function ClaimsContent() {
  const viewer = await getViewer();
  if (viewer.state !== "member" || !viewer.isAdmin) redirect("/");

  const supabase = await createClient();
  const [{ data: profiles }, { data: invitations }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, aka, profile_type, profile_branches(is_primary, family_branches(name))")
      .is("account_id", null)
      .is("archived_at", null)
      .eq("is_living", true)
      .order("full_name"),
    supabase
      .from("invitations")
      .select("id, profile_id, expires_at, accepted_at, revoked_at")
      .eq("kind", "claim")
      .order("created_at", { ascending: false }),
  ]);

  const adults = (profiles ?? []).filter((p) => p.profile_type === "adult");
  const children = (profiles ?? []).filter((p) => p.profile_type === "child");

  if (adults.length === 0 && children.length === 0) {
    return (
      <Card>
        <p>Everyone in the directory has claimed their profile. 🎉</p>
      </Card>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-4">
        {adults.map((person) => {
          const branch = person.profile_branches.find((b) => b.is_primary)?.family_branches?.name;
          const status = linkStatus((invitations ?? []).filter((i) => i.profile_id === person.id));
          return (
            <li key={person.id}>
              <Card className="flex flex-col gap-4">
                <div>
                  <h2 className="text-xl font-semibold">
                    {person.full_name}
                    {person.aka && <span className="font-normal text-muted"> ({person.aka})</span>}
                  </h2>
                  {branch && <p className="text-muted">{branch}</p>}
                  <p className="mt-1 text-sm">{status.label}</p>
                </div>
                <ClaimLinkButton
                  profileId={person.id}
                  fullName={person.full_name}
                  label={status.invitationId ? "Make a new link" : "Make claim link"}
                />
                {status.invitationId && (
                  <form action={cancelInvitation.bind(null, status.invitationId)}>
                    <Button type="submit" variant="secondary">
                      Cancel the current link
                    </Button>
                  </form>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
      {children.length > 0 && (
        <Card className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">Children</h2>
          <p>
            Children don&apos;t claim profiles. Once a parent joins, they can be connected as the child&apos;s
            guardian.
          </p>
          <ul className="list-disc pl-6">
            {children.map((child) => (
              <li key={child.id}>{child.full_name}</li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
