"use client";

import { useActionState } from "react";
import { Button, Notice, TextField } from "@/components/ui";
import { createMyProfile, type CreateProfileState } from "./actions";

export function CreateProfileForm({ branches }: { branches: { id: string; name: string }[] }) {
  const [state, create, pending] = useActionState<CreateProfileState, FormData>(createMyProfile, {});

  return (
    <form action={create} className="flex flex-col gap-5">
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <TextField
        id="fullName"
        name="fullName"
        label="Your full name"
        autoComplete="name"
        required
        error={state.fieldErrors?.fullName}
      />
      <TextField id="aka" name="aka" label="Nickname (optional)" hint="What does the family call you?" />
      {branches.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="branch" className="font-medium">
            Family branch (optional)
          </label>
          <select
            id="branch"
            name="branch"
            defaultValue=""
            className="min-h-12 rounded-lg border border-border bg-surface px-4 py-3 text-base text-foreground"
          >
            <option value="">I&apos;m not sure</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField id="city" name="city" label="City (optional)" autoComplete="address-level2" />
        <TextField id="state" name="state" label="State (optional)" autoComplete="address-level1" />
      </div>
      <p className="text-sm text-muted">
        You can add a photo, birthday, hobbies and contact details later, and choose who sees them.
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Join the directory"}
      </Button>
    </form>
  );
}
