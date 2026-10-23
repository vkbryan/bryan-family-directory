import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button, Card, Loading } from "@/components/ui";
import { cancelInvitation } from "./actions";
import { InviteForm } from "./invite-form";

export const metadata = { title: "Invite a relative · Bryan Family Directory" };

export default function InvitationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Invite a relative</h1>
      <p className="text-lg">
        Make a link and send it to them by text or email. When they open it, they&apos;ll be able to join.
      </p>
      <Suspense fallback={<Loading />}>
        <InvitationsContent />
      </Suspense>
    </div>
  );
}

async function InvitationsContent() {
  const viewer = await getViewer();
  if (viewer.state !== "member") redirect("/");

  const supabase = await createClient();
  const { data: sent } = await supabase
    .from("invitations")
    .select("id, kind, recipient_label, created_at, expires_at, accepted_at, revoked_at")
    .eq("kind", "join")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <>
      <Card>
        <InviteForm />
      </Card>
      {sent && sent.length > 0 && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Links you&apos;ve made</h2>
          <ul className="flex flex-col divide-y divide-border">
            {sent.map((invitation) => {
              const status = invitation.accepted_at
                ? "Joined"
                : invitation.revoked_at
                  ? "Cancelled"
                  : new Date(invitation.expires_at) < new Date()
                    ? "Expired"
                    : "Waiting";
              return (
                <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span>
                    {invitation.recipient_label || "No name given"}{" "}
                    <span className="text-muted">· {status}</span>
                  </span>
                  {status === "Waiting" && (
                    <form action={cancelInvitation.bind(null, invitation.id)}>
                      <Button type="submit" variant="secondary">
                        Cancel link
                      </Button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
