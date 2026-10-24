"use client";

import { useState, useTransition } from "react";
import { Button, Notice } from "@/components/ui";
import type { ActionResult } from "./actions";

/** A button that asks "Are you sure?" first, then runs an admin action and shows any error. */
export function ConfirmButton({
  label,
  confirmText,
  action,
  variant = "secondary",
}: {
  label: string;
  confirmText?: string;
  action: () => Promise<ActionResult>;
  variant?: "primary" | "secondary";
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant={variant}
        disabled={pending}
        onClick={() => {
          if (confirmText && !confirm(confirmText)) return;
          setError(null);
          start(async () => {
            const result = await action();
            if (result.error) setError(result.error);
          });
        }}
      >
        {pending ? "One moment…" : label}
      </Button>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
