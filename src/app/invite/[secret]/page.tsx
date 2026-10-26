import { Suspense } from "react";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button, ButtonLink, Card, Loading } from "@/components/ui";
import { startFromInvitation } from "./actions";
import { AcceptButton } from "./accept-button";

export const metadata = { title: "You're invited · Bryan Family Directory" };

type Preview = {
  status: "valid" | "used" | "expired" | "revoked" | "invalid";
  kind?: "join" | "claim" | "co_guardian";
  recipient_label?: string | null;
  inviter_name?: string | null;
  profile_name?: string | null;
  has_photo?: boolean;
  photo_caption?: string | null;
};

export default function InvitePage({ params }: PageProps<"/invite/[secret]">) {
  return (
    <Suspense fallback={<Loading />}>
      <InviteContent params={params} />
    </Suspense>
  );
}

async function InviteContent({ params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  const supabase = await createClient();
  const [{ data }, viewer] = await Promise.all([
    supabase.rpc("invitation_preview", { p_secret: secret }),
    getViewer(),
  ]);
  const preview = (data ?? { status: "invalid" }) as Preview;

  if (preview.status !== "valid") {
    const reason = {
      used: "This invitation has already been used.",
      expired: "This invitation has expired.",
      revoked: "This invitation was cancelled.",
      invalid: "This invitation link isn't valid. It may have been copied incompletely.",
    }[preview.status];
    return (
      <Card className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">This link can&apos;t be used</h1>
        <p>{reason} Ask the relative who sent it for a new one.</p>
        <p>
          Already a member? <a href="/sign-in">Sign in</a>.
        </p>
      </Card>
    );
  }

  const from = preview.inviter_name ? `${preview.inviter_name} invited you` : "You're invited";
  const heading = {
    join: `${from} to the Bryan Family Directory`,
    claim: preview.profile_name ? `Is this you, ${preview.profile_name}?` : `${from} to the Bryan Family Directory`,
    co_guardian: `${from} to help manage a child's profile`,
  }[preview.kind ?? "join"];

  const explanation = {
    join: "It's a private place for our family to find one another, see where relatives live, and stay in touch. Only invited family members can see it.",
    claim: "A profile has been saved for you in the family directory. Sign in to make it yours. You'll decide what to share.",
    co_guardian: "You'll be able to update the child's profile and photo. Other relatives see only what you choose to share.",
  }[preview.kind ?? "join"];

  const acceptLabel = preview.kind === "co_guardian" ? "Accept" : preview.kind === "claim" ? "Yes, that's me" : "Join";
  const signedInMember = viewer.state === "member" || viewer.state === "needs-profile" || viewer.state === "pending";

  return (
    <div className="flex flex-col gap-6">
      {preview.has_photo && (
        <figure className="flex flex-col gap-2">
          {/* Served only with this valid invitation; never public, never cached. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/invite/${secret}/photo`}
            alt={preview.photo_caption || "The Bryan family together"}
            className="w-full rounded-xl border-[3px] border-gold object-cover"
          />
          {preview.photo_caption && <figcaption className="text-center text-muted">{preview.photo_caption}</figcaption>}
        </figure>
      )}
      <h1 className="text-3xl font-bold">{heading}</h1>
      <p className="text-lg">{explanation}</p>
      <Card className="flex flex-col gap-4">
        {signedInMember ? (
          <AcceptButton secret={secret} label={acceptLabel} />
        ) : (
          <>
            <p>
              No password needed. Enter your email and we&apos;ll send you a short code.
            </p>
            <form action={startFromInvitation.bind(null, secret)}>
              <Button type="submit">{preview.kind === "claim" ? "Yes, that's me" : "Get started"}</Button>
            </form>
          </>
        )}
      </Card>
      {preview.kind === "claim" && !signedInMember && (
        <p className="text-muted">
          Not you? Let the person who sent this link know. <ButtonLink href="/" variant="secondary">Go to the home page</ButtonLink>
        </p>
      )}
    </div>
  );
}
