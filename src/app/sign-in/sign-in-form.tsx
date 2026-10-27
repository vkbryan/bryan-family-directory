"use client";

import { useActionState } from "react";
import { Button, Notice, TextField } from "@/components/ui";
import { isMicrosoftEmail } from "@/lib/email-providers";
import { signInStep, type SignInState } from "./actions";

const initialState: SignInState = { step: "email", email: "" };

/** Email, then code. On an invitation page it carries the invitation along. */
export function SignInForm({ invitation, submitLabel = "Email me a code" }: { invitation?: string; submitLabel?: string }) {
  const [state, act, pending] = useActionState(signInStep, initialState);

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
      {state.message && <Notice>{state.message}</Notice>}
      {isMicrosoftEmail(state.email) && (
        <div className="flex flex-col gap-2 rounded-lg border-2 border-gold bg-gold-soft p-4 text-gold-text">
          <p className="font-semibold">Using Hotmail or Outlook?</p>
          <p>
            Microsoft sometimes holds back our emails. Look in your <strong>Junk</strong> folder and the{" "}
            <strong>Other</strong> tab. If nothing arrives within 5 minutes,{" "}
            <a href="/sign-in" className="text-gold-text">
              try a different email address
            </a>
            , such as Gmail or iCloud.
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
        <Button type="submit" variant="secondary" disabled={pending}>
          Send a new code
        </Button>
      </form>
      <p className="text-sm text-muted">
        Wrong email? <a href="/sign-in">Start over</a>.
      </p>
    </div>
  );
}
