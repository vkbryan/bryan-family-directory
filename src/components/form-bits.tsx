import type { ComponentProps, ReactNode } from "react";
import { Button, Notice } from "./ui";

export type SaveState = { saved?: boolean; error?: string; fieldErrors?: Record<string, string> };

const inputClass = "min-h-12 rounded-lg border border-border bg-surface px-4 py-3 text-base text-foreground";

export function SelectField({
  id,
  label,
  hint,
  children,
  ...props
}: ComponentProps<"select"> & { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      <select id={id} className={inputClass} {...props}>
        {children}
      </select>
    </div>
  );
}

/** "Who can see this?" with two plain choices. */
export function VisibilityChoice({
  name,
  value,
  isChild,
  label = "Who can see this?",
}: {
  name: string;
  value: "members" | "private";
  isChild: boolean;
  label?: string;
}) {
  const choices = [
    { value: "members", text: "Family members" },
    { value: "private", text: isChild ? "Only parents and guardians" : "Only me" },
  ];
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-medium">{label}</legend>
      {choices.map((c) => (
        <label key={c.value} className="flex min-h-11 items-center gap-3">
          <input type="radio" name={name} value={c.value} defaultChecked={value === c.value} className="h-5 w-5 accent-accent" />
          {c.text}
        </label>
      ))}
    </fieldset>
  );
}

export function SectionCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">{title}</h2>
        {description && <p className="text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** The Save button with a pending label and a "Saved" or error message. */
export function SaveRow({ state, pending, label = "Save" }: { state: SaveState; pending: boolean; label?: string }) {
  return (
    <div className="flex flex-col gap-3">
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : label}
        </Button>
        <span role="status" className="font-medium text-success">
          {!pending && state.saved ? "Saved ✓" : ""}
        </span>
      </div>
    </div>
  );
}
