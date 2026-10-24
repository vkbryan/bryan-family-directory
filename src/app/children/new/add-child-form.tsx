"use client";

import { useActionState } from "react";
import { MONTHS } from "@/lib/directory-logic";
import { Notice, TextField } from "@/components/ui";
import { SaveRow, SelectField, type SaveState } from "@/components/form-bits";
import { addChild } from "./actions";

export function AddChildForm() {
  const [state, add, pending] = useActionState<SaveState, FormData>(addChild, {});
  const e = state.fieldErrors ?? {};
  return (
    <form action={add} className="flex flex-col gap-5">
      <TextField id="fullName" name="fullName" label="Child's full name" required error={e.fullName} />
      <TextField id="aka" name="aka" label="Nickname (optional)" />
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-medium">Birthday</legend>
        <p className="text-sm text-muted">
          The year is required but always stays private. It tells us when they can take over their own profile.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <SelectField id="month" name="month" label="Month" defaultValue="">
            <option value="">—</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </SelectField>
          <SelectField id="day" name="day" label="Day" defaultValue="">
            <option value="">—</option>
            {Array.from({ length: 31 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </SelectField>
          <TextField id="year" name="year" label="Year" inputMode="numeric" maxLength={4} required error={e.year} />
        </div>
        {e.birthday && <Notice tone="error">{e.birthday}</Notice>}
      </fieldset>
      <SelectField id="relationship" name="relationship" label="You are their…" defaultValue="" required>
        <option value="" disabled>
          Choose one
        </option>
        <option value="biological">Parent</option>
        <option value="adoptive">Adoptive parent</option>
        <option value="step">Step-parent</option>
        <option value="foster">Foster parent</option>
        <option value="guardian">Grandparent or other guardian</option>
      </SelectField>
      {e.relationship && <Notice tone="error">{e.relationship}</Notice>}
      <p className="text-sm text-muted">
        Children&apos;s profiles never show contact details. Their birthday and location stay hidden unless you
        choose to share them.
      </p>
      <SaveRow state={state} pending={pending} label="Add child" />
    </form>
  );
}
