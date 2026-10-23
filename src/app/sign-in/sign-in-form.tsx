"use client";

import { useActionState } from "react";
import { Button, Notice, TextField } from "@/components/ui";
import { signInStep, type SignInState } from "./actions";

const initialState: SignInState = { step: "email", email: "" };

export function SignInForm() {
  const [state, act, pending] = useActionState(signInStep, initialState);

  if (state.step === "email") {
    return (
      <form action={act} className="flex flex-col gap-5">
        <input type="hidden" name="intent" value="send" />
        <TextField
          id="email"
          name="email"
          type="email"
          label="Your email address"
          hint="We'll email you a short code. No password needed."
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.email}
          error={state.error}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Email me a code"}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {state.message && <Notice>{state.message}</Notice>}
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
