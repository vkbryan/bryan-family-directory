import { Suspense } from "react";
import { formatDate, invitationStatus, requireAdminViewer } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { Card, Loading } from "@/components/ui";
import { ConfirmButton } from "../confirm-button";
import { revokeInvitation } from "../actions";
import { GroupLinkForm } from "./group-link-form";

export const metadata = { title: "Group link · Bryan Family Directory" };

export default function GroupLinkPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Group link</h1>
      <p className="text-lg">
        One link for the family group chat. Anyone who opens it can join straight away, up to 50 people, for 14
        days. If it gets passed around too far, cancel it here and make a new one.
      </p>
      <Suspense fallback={<Loading />}>
        <GroupLinks />
      </Suspense>
    </div>
  );
}

async function GroupLinks() {
  await requireAdminViewer();
  const supabase = await createClient();
  const { data: links } = await supabase
    .from("invitations")
    .select("id, recipient_label, created_at, expires_at, accepted_at, revoked_at, max_uses, use_count")
    .not("max_uses", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <>
      <Card>
        <GroupLinkForm />
      </Card>
      {links && links.length > 0 && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Group links</h2>
          <ul className="flex flex-col divide-y divide-border">
            {links.map((link) => {
              const status = invitationStatus(link);
              return (
                <li key={link.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span>
                    <strong>{link.recipient_label || "Group link"}</strong>
                    <span className="block text-sm text-muted">
                      {link.use_count} of {link.max_uses} joined ·{" "}
                      {status === "Waiting" ? `Open until ${formatDate(link.expires_at)}` : status} · made{" "}
                      {formatDate(link.created_at)}
                    </span>
                  </span>
                  {status === "Waiting" && (
                    <ConfirmButton
                      label="Cancel link"
                      confirmText="Cancel this group link? Nobody new can join with it. People who already joined stay."
                      action={revokeInvitation.bind(null, link.id)}
                    />
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
