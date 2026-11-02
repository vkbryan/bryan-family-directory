import Link from "next/link";
import { Suspense } from "react";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink, Card, Loading } from "@/components/ui";
import { SignInForm } from "@/app/sign-in/sign-in-form";
import { AcceptButton } from "./accept-button";

const description = "Find relatives, see birthdays and stay in touch. It takes about a minute.";

// What WhatsApp, iMessage and others show when the link is shared. Kept
// general: link previews are fetched by those companies' servers.
export const metadata = {
  title: "You're invited to the Bryan Family Directory",
  description,
  openGraph: {
    title: "You're invited to the Bryan Family Directory",
    description,
    siteName: "The Bryan Family",
    // Setting openGraph here replaces the inherited picture, so name it again.
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "The Bryan Family: Out of many, one people" }],
  },
};

type Preview = {
  status: "valid" | "used" | "full" | "expired" | "revoked" | "invalid";
  kind?: "join" | "claim" | "co_guardian";
  is_group?: boolean;
  recipient_label?: string | null;
  inviter_name?: string | null;
  profile_name?: string | null;
  has_photo?: boolean;
  photo_caption?: string | null;
  member_count?: number | null;
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
      full: "So many relatives have joined with this link that it's full.",
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
    join: "A private place to find one another, see birthdays and stay in touch.",
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
      {preview.kind !== "co_guardian" && (preview.member_count ?? 0) >= 2 && (
        <p className="font-semibold text-green-text">{preview.member_count} relatives are already in the directory.</p>
      )}
      <Card className="flex flex-col gap-4">
        {viewer.state === "member" && preview.is_group ? (
          <p>
            You&apos;re already in the directory. <Link href="/">Go to the directory</Link>.
          </p>
        ) : viewer.state === "member" && preview.kind === "join" ? (
          // Accepting would use up a newcomer's link without adding anyone.
          <p>
            This invitation is for someone new. You&apos;re already a member, so pass the link along to them.{" "}
            <Link href="/">Go to the directory</Link>.
          </p>
        ) : signedInMember ? (
          <AcceptButton secret={secret} label={acceptLabel} />
        ) : (
          <>
            <SignInForm invitation={secret} submitLabel={preview.kind === "claim" ? "Yes, that's me" : "Send code"} />
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
