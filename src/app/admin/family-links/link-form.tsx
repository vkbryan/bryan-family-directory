"use client";

import { useActionState } from "react";
import { Button, Notice, TextField } from "@/components/ui";
import { SelectField } from "@/components/form-bits";
import { ICONS, SECTIONS, type FamilyLink } from "@/lib/family-links";
import { saveLink, type LinkFormState } from "./actions";

/** Add a new link, or edit one when `link` is given. */
export function LinkForm({ link }: { link?: FamilyLink }) {
  const [state, save, pending] = useActionState<LinkFormState, FormData>(saveLink.bind(null, link?.id ?? null), {});
  const id = (name: string) => `${name}-${link?.id ?? "new"}`;
  return (
    // A fresh form after adding, so the boxes empty out.
    <form action={save} key={link ? undefined : state.savedAt} className="flex flex-col gap-4">
      <TextField id={id("title")} name="title" label="Title" defaultValue={link?.title} placeholder="Family photos" required error={state.fieldErrors?.title} />
      <TextField
        id={id("url")}
        name="url"
        label="Web address"
        hint="Paste the link, or an email address."
        defaultValue={link?.url.replace(/^mailto:/, "")}
        inputMode="url"
        autoComplete="off"
        required
        error={state.fieldErrors?.url}
      />
      <TextField
        id={id("note")}
        name="note"
        label="Short note (optional)"
        defaultValue={link?.note ?? ""}
        placeholder="View and add your own photos."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField id={id("section")} name="section" label="Section" defaultValue={link?.section ?? "stay_in_touch"}>
          {SECTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </SelectField>
        <SelectField id={id("icon")} name="icon" label="Icon" defaultValue={link?.icon ?? "link"}>
          {ICONS.map((i) => (
            <option key={i.value} value={i.value}>
              {i.emoji} {i.label}
            </option>
          ))}
        </SelectField>
      </div>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : link ? "Save changes" : "Add link"}
        </Button>
        <span role="status" className="font-medium text-success">
          {!pending && state.done ? (link ? "Saved ✓" : "Added ✓") : ""}
        </span>
      </div>
    </form>
  );
}
