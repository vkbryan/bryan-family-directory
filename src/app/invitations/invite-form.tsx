"use client";

import { useActionState } from "react";
import { Button, Notice, TextField } from "@/components/ui";
import { ShareLink } from "@/components/share-link";
import { createJoinLink, type InviteState } from "./actions";

export function InviteForm() {
  const [state, create, pending] = useActionState<InviteState, FormData>(createJoinLink, {});

  return (
    <div className="flex flex-col gap-5">
      <form action={create} className="flex flex-col gap-5">
        <TextField
          id="label"
          name="label"
          label="Who is this for? (optional)"
          hint="Just a reminder for you, like “Cousin Robin”. They'll see it on the invitation."
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Making link…" : "Make an invitation link"}
        </Button>
      </form>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.link && (
        <ShareLink
          link={state.link}
          heading={`Your invitation link${state.label ? ` for ${state.label}` : ""}:`}
          message="You're invited to the Bryan family directory! It takes about a minute, just your name:"
        />
      )}
    </div>
  );
}
