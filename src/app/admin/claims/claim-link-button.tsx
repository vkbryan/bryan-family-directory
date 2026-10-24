"use client";

import { useActionState } from "react";
import { Button, Notice } from "@/components/ui";
import { ShareLink } from "@/components/share-link";
import { createClaimLink, type ClaimLinkState } from "./actions";

export function ClaimLinkButton({ profileId, fullName, label }: { profileId: string; fullName: string; label: string }) {
  const [state, create, pending] = useActionState<ClaimLinkState>(createClaimLink.bind(null, profileId, fullName), {});

  if (state.link) {
    return (
      <ShareLink
        link={state.link}
        heading={`Claim link for ${fullName}:`}
        message="Hi! Our family directory has moved, and your profile is already there. Tap to claim it:"
      />
    );
  }

  return (
    <form action={create} className="flex flex-col gap-3">
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Making link…" : label}
      </Button>
    </form>
  );
}
