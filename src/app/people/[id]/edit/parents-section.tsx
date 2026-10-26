"use client";

import { useActionState, useTransition } from "react";
import { Button, Notice } from "@/components/ui";
import { SectionCard, SelectField } from "@/components/form-bits";
import { addParentLink, removeParentLink, type LinkState } from "./guardian-actions";

type ParentLink = { id: string; name: string; detail: string };

const kindLabel: Record<string, string> = {
  biological: "Parent",
  adoptive: "Adoptive parent",
  step: "Step-parent",
  foster: "Foster parent",
  unspecified: "Parent",
};

/** Admin only: record who a child's parents are, for the directory and the future family tree. */
export function ParentsSection({
  childId,
  childName,
  parents,
  adults,
}: {
  childId: string;
  childName: string;
  parents: ParentLink[];
  adults: { id: string; name: string }[];
}) {
  const [state, add, adding] = useActionState<LinkState, FormData>(addParentLink.bind(null, childId), {});
  const [removing, startRemoving] = useTransition();
  const first = childName.split(" ")[0];
  const choices = adults.filter((a) => !parents.some((p) => p.name === a.name));

  return (
    <SectionCard
      title="Parents (family tree)"
      description={`Shown on ${first}'s tile and profile, like “Vanessa Bryan's child”. This is for the family tree only; it doesn't let anyone edit ${first}'s profile. Use Parents and guardians for that.`}
    >
      {parents.length === 0 ? (
        <p className="text-muted">No parents recorded yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {parents.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span>
                {p.name} <span className="text-muted">· {kindLabel[p.detail] ?? "Parent"}</span>
              </span>
              <Button
                type="button"
                variant="secondary"
                disabled={removing}
                onClick={() => {
                  if (confirm(`Remove ${p.name} as ${first}'s parent in the family tree?`)) {
                    startRemoving(() => removeParentLink(p.id));
                  }
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form action={add} className="flex flex-col gap-4 border-t border-border pt-5">
        <SelectField id="parentId" name="parentId" label="Add a parent" defaultValue="">
          <option value="">Choose a family member…</option>
          {choices.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </SelectField>
        <SelectField id="detail" name="detail" label="Relationship" defaultValue="unspecified">
          <option value="unspecified">Parent</option>
          <option value="biological">Birth parent</option>
          <option value="adoptive">Adoptive parent</option>
          <option value="step">Step-parent</option>
          <option value="foster">Foster parent</option>
        </SelectField>
        {state.error && <Notice tone="error">{state.error}</Notice>}
        <Button type="submit" variant="secondary" disabled={adding}>
          {adding ? "Saving…" : "Add parent"}
        </Button>
      </form>
    </SectionCard>
  );
}
