"use client";

import { useActionState, type ReactNode } from "react";
import { Button, TextField } from "@/components/ui";
import { isMicrosoftEmail, maskEmail } from "@/lib/email-providers";
import { signInStep, type SignInState } from "./actions";

const initialState: SignInState = { step: "email", email: "" };

/**
 * Email, then code. On an invitation page it carries the invitation along.
 * `waitingFor` is an address that was sent a code in the last hour: the form
 * opens straight at the code box, for someone who closed the page and came back.
 */
export function SignInForm({
  invitation,
  submitLabel = "Email me a code",
  waitingFor,
}: {
  invitation?: string;
  submitLabel?: string;
  waitingFor?: string | null;
}) {
  const [state, act, pending] = useActionState<SignInState, FormData>(
    signInStep,
    waitingFor
      ? { step: "code", email: waitingFor, message: `We emailed a code to ${maskEmail(waitingFor)}.` }
      : initialState,
  );

  if (state.step === "email") {
    return (
      <form action={act} className="flex flex-col gap-5">
        <input type="hidden" name="intent" value="send" />
        {invitation && <input type="hidden" name="invitation" value={invitation} />}
        <TextField
          id="email"
          name="email"
          type="email"
          label="Type your email address"
          hint="We'll email you a short code. No password needed."
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.email}
          error={state.error}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : submitLabel}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2" role="status">
        <p className="text-xl font-semibold">Check your email for a 6-digit code</p>
        {state.message && <p>{state.message}</p>}
        <p>
          <strong>Keep this page open.</strong> When the email arrives, come back here and type the code below.
          There&apos;s no need to reply to the email.
        </p>
      </div>
      {isMicrosoftEmail(state.email) && (
        <div className="flex flex-col gap-2 rounded-lg border-2 border-gold bg-gold-soft p-4 text-gold-text">
          <p className="font-semibold">Using Hotmail or Outlook?</p>
          <p>
            Microsoft sometimes holds back our emails. Look in your <strong>Junk</strong> folder and the{" "}
            <strong>Other</strong> tab. If nothing arrives within 5 minutes, <RestartLink>try a different email
            address</RestartLink>, such as Gmail or iCloud.
          </p>
        </div>
      )}
      <form action={act} className="flex flex-col gap-5">
        <input type="hidden" name="intent" value="verify" />
        <TextField
          id="code"
          name="code"
          label="Code from the email"
          hint="Check your spam folder if it isn't in your inbox within a minute."
          autoComplete="one-time-code"
          inputMode="numeric"
          required
          error={state.error}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Checking…" : "Sign in"}
        </Button>
      </form>
      <form action={act}>
        <input type="hidden" name="intent" value="send" />
        <input type="hidden" name="email" value={state.email} />
        {invitation && <input type="hidden" name="invitation" value={invitation} />}
        <Button type="submit" variant="secondary" disabled={pending}>
          Send a new code
        </Button>
      </form>
      <p className="text-sm text-muted">
        Wrong email? <RestartLink>Start over</RestartLink>.
      </p>
      <form id="restart-sign-in" action={act} hidden>
        <input type="hidden" name="intent" value="restart" />
      </form>
    </div>
  );
}

/** Looks like a link; forgets the waiting address and shows the email box again. */
function RestartLink({ children }: { children: ReactNode }) {
  return (
    <button type="submit" form="restart-sign-in" className="inline cursor-pointer underline underline-offset-4">
      {children}
    </button>
  );
}
