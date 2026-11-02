"use client";

import { useActionState } from "react";
import { Button, Notice, TextField } from "@/components/ui";
import { ShareLink } from "@/components/share-link";
import { createGroupLink, type GroupLinkState } from "./actions";

export function GroupLinkForm() {
  const [state, create, pending] = useActionState<GroupLinkState, FormData>(createGroupLink, {});

  if (state.link) {
    return (
      <ShareLink
        link={state.link}
        heading="Your group link:"
        note="Up to 50 people can join with it in the next 14 days. Copy it now: for safety it can't be shown again."
        message="The Bryan family directory is open! A private place to find one another, see birthdays and stay in touch. Tap to join (it takes about a minute):"
        whatsapp
      />
    );
  }

  return (
    <form action={create} className="flex flex-col gap-5">
      <TextField
        id="label"
        name="label"
        label="Where will you share it?"
        hint="So you can tell your links apart. Only admins see this."
        defaultValue="Family WhatsApp group"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Making link…" : "Make a group link"}
      </Button>
      {state.error && <Notice tone="error">{state.error}</Notice>}
    </form>
  );
}
