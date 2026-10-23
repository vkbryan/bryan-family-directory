"use client";

import { useActionState, useState } from "react";
import { Button, Notice, TextField } from "@/components/ui";
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
      {state.link && <ShareLink link={state.link} label={state.label} />}
    </div>
  );
}

function ShareLink({ link, label }: { link: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const message = `Join the Bryan Family Directory, our private family directory: ${link}`;

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-background p-4">
      <p className="font-medium">Your invitation link{label ? ` for ${label}` : ""}:</p>
      <p className="break-all rounded bg-surface p-3 font-mono text-sm">{link}</p>
      <p className="text-sm text-muted">It works once and expires in 14 days. Send it however you usually reach them.</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" onClick={copy}>
          {copied ? "Copied" : "Copy link"}
        </Button>
        <a
          href={`sms:?&body=${encodeURIComponent(message)}`}
          className="inline-flex min-h-12 items-center justify-center rounded-lg border border-border bg-surface px-5 py-3 font-semibold text-foreground no-underline"
        >
          Send as a text
        </a>
      </div>
      <span role="status" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
    </div>
  );
}
