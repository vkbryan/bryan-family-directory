"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { Button, Notice } from "@/components/ui";
import { cancelClaim, requestClaim } from "./claim-actions";

type Candidate = { id: string; fullName: string; aka: string | null; photoUrl: string | null; place: string | null };

export function ClaimChoices({ candidates, pending }: { candidates: Candidate[]; pending: { requestId: string; name: string } | null }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (pending) {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="success">
          You asked to claim <strong>{pending.name}</strong>. A family admin will check and approve it, usually within a
          day or two. You&apos;ll see your profile here once it&apos;s approved.
        </Notice>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => start(() => cancelClaim(pending.requestId))}>
          That was a mistake. Cancel my request
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <Notice tone="error">{error}</Notice>}
      <ul className="flex flex-col gap-3">
        {candidates.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
            <span className="flex items-center gap-3">
              <Avatar name={c.fullName} photoUrl={c.photoUrl} size="sm" />
              <span>
                <span className="font-semibold">{c.fullName}</span>
                {c.aka && <span className="text-muted"> ({c.aka})</span>}
                {c.place && <span className="block text-sm text-muted">{c.place}</span>}
              </span>
            </span>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              className="!w-auto"
              onClick={() => {
                if (!confirm(`Ask to claim the profile of ${c.fullName}? An admin will check before it becomes yours.`)) return;
                setError(null);
                start(async () => {
                  const result = await requestClaim(c.id);
                  if (result.error) setError(result.error);
                });
              }}
            >
              This is me
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
