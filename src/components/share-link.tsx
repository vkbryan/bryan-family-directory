"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

/** Shows a fresh invitation link with "Copy" and "Send as a text" buttons. */
export function ShareLink({ link, heading, message }: { link: string; heading: string; message: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-background p-4">
      <p className="font-medium">{heading}</p>
      <p className="break-all rounded bg-surface p-3 font-mono text-sm">{link}</p>
      <p className="text-sm text-muted">It works once and expires in 14 days. Send it however you usually reach them.</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" onClick={copy}>
          {copied ? "Copied" : "Copy link"}
        </Button>
        <a
          href={`sms:?&body=${encodeURIComponent(`${message} ${link}`)}`}
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
