"use client";

import { useActionState, useTransition } from "react";
import { Button, Notice } from "@/components/ui";
import { SectionCard, SelectField } from "@/components/form-bits";
import { ShareLink } from "@/components/share-link";
import {
  adminAddGuardian,
  adminRemoveGuardian,
  decideRequest,
  makeCoGuardianLink,
  makeHandOverLink,
  stepDown,
  type LinkState,
} from "./guardian-actions";

type Guardian = { accountId: string; fullName: string; isMe: boolean };
type Request = { id: string; requesterName: string; message: string | null };

export function GuardiansSection({
  profileId,
  childName,
  guardians,
  requests,
  canHandOver,
  isAdmin,
  members,
}: {
  profileId: string;
  childName: string;
  guardians: Guardian[];
  requests: Request[];
  canHandOver: boolean;
  isAdmin: boolean;
  members: { accountId: string; fullName: string }[];
}) {
  const [coState, makeCo, makingCo] = useActionState<LinkState>(makeCoGuardianLink.bind(null, profileId), {});
  const [handState, makeHand, makingHand] = useActionState<LinkState>(makeHandOverLink.bind(null, profileId), {});
  const [addState, addGuardian, adding] = useActionState<LinkState, FormData>(adminAddGuardian.bind(null, profileId), {});
  const [busy, start] = useTransition();
  const first = childName.split(" ")[0];
  const candidates = members.filter((m) => !guardians.some((g) => g.accountId === m.accountId));

  return (
    <>
      <SectionCard
        title="Parents and guardians"
        description={`These people can update ${first}'s profile. Each signs in with their own account.`}
      >
        {guardians.length === 0 ? (
          <p>Nobody yet. An admin can connect a parent once they&apos;ve joined.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {guardians.map((g) => (
              <li key={g.accountId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span>
                  {g.fullName}
                  {g.isMe && <span className="text-muted"> (you)</span>}
                </span>
                {g.isMe ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      if (confirm(`Stop managing ${first}'s profile? Another guardian or an admin can add you back.`)) {
                        start(() => stepDown(profileId, g.accountId));
                      }
                    }}
                  >
                    Step down
                  </Button>
                ) : (
                  isAdmin && (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        if (confirm(`Remove ${g.fullName} as a guardian of ${first}?`)) {
                          start(() => adminRemoveGuardian(profileId, g.accountId));
                        }
                      }}
                    >
                      Remove (admin)
                    </Button>
                  )
                )}
              </li>
            ))}
          </ul>
        )}

        {requests.length > 0 && (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4">
            <h3 className="font-semibold">Asking to help manage</h3>
            <ul className="flex flex-col gap-4">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-col gap-2">
                  <p>
                    <strong>{r.requesterName}</strong>
                    {r.message && <span className="text-muted">: &ldquo;{r.message}&rdquo;</span>}
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="button" disabled={busy} onClick={() => start(() => decideRequest(r.id, true))}>
                      Approve
                    </Button>
                    <Button type="button" variant="secondary" disabled={busy} onClick={() => start(() => decideRequest(r.id, false))}>
                      Decline
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {coState.link ? (
          <ShareLink
            link={coState.link}
            heading="Send this to the other parent or guardian:"
            message={`Please help manage ${first}'s profile in our family directory:`}
          />
        ) : (
          <form action={makeCo} className="flex flex-col gap-2">
            {coState.error && <Notice tone="error">{coState.error}</Notice>}
            <Button type="submit" variant="secondary" disabled={makingCo}>
              {makingCo ? "Making link…" : "Add another parent or guardian"}
            </Button>
          </form>
        )}

        {isAdmin && candidates.length > 0 && (
          <form action={addGuardian} className="flex flex-col gap-3 border-t border-border pt-5">
            <SelectField id="accountId" name="accountId" label="Admin: connect a family member as guardian" defaultValue="">
              <option value="">Choose…</option>
              {candidates.map((m) => (
                <option key={m.accountId} value={m.accountId}>
                  {m.fullName}
                </option>
              ))}
            </SelectField>
            {addState.error && <Notice tone="error">{addState.error}</Notice>}
            <Button type="submit" variant="secondary" disabled={adding}>
              {adding ? "Connecting…" : "Connect as guardian"}
            </Button>
          </form>
        )}
      </SectionCard>

      {canHandOver && (
        <SectionCard
          title={`Hand over to ${first}`}
          description={`When ${first} is ready to manage their own profile, send them this link. Once they accept, the profile becomes theirs, guardians stop managing it, and its privacy settings reset so ${first} decides what to share.`}
        >
          {handState.link ? (
            <ShareLink
              link={handState.link}
              heading={`Send this to ${first}:`}
              message="Your profile in our family directory is ready for you to take over:"
            />
          ) : (
            <form action={makeHand} className="flex flex-col gap-2">
              {handState.error && <Notice tone="error">{handState.error}</Notice>}
              <Button type="submit" variant="secondary" disabled={makingHand}>
                {makingHand ? "Making link…" : `Make a hand-over link for ${first}`}
              </Button>
            </form>
          )}
        </SectionCard>
      )}
    </>
  );
}
