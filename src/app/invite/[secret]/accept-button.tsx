"use client";

import { useActionState } from "react";
import { Button, Notice } from "@/components/ui";
import { acceptAsSignedIn } from "./actions";

export function AcceptButton({ secret, label }: { secret: string; label: string }) {
  const [error, accept, pending] = useActionState(acceptAsSignedIn.bind(null, secret), null);
  return (
    <form action={accept} className="flex flex-col gap-4">
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" disabled={pending}>
        {pending ? "One moment…" : label}
      </Button>
    </form>
  );
}
