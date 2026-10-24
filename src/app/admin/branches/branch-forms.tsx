"use client";

import { useActionState } from "react";
import { Button, Notice } from "@/components/ui";
import { addBranch, renameBranch, type ActionResult } from "../actions";

const inputClass = "min-h-12 min-w-0 flex-1 rounded-lg border border-border bg-surface px-4 py-3 text-base text-foreground";

export function AddBranchForm() {
  const [state, add, pending] = useActionState<ActionResult, FormData>(addBranch, {});
  return (
    <form action={add} className="flex flex-col gap-2">
      <label htmlFor="new-branch" className="font-medium">
        Add a branch
      </label>
      <div className="flex gap-2">
        <input id="new-branch" name="name" className={inputClass} />
        <Button type="submit" disabled={pending} className="!w-auto">
          {pending ? "Adding…" : "Add"}
        </Button>
      </div>
      {state.error && <Notice tone="error">{state.error}</Notice>}
    </form>
  );
}

export function RenameBranchForm({ id, name }: { id: string; name: string }) {
  const [state, rename, pending] = useActionState<ActionResult, FormData>(renameBranch.bind(null, id), {});
  return (
    <form action={rename} className="flex flex-col gap-2">
      <label htmlFor={`branch-${id}`} className="sr-only">
        Name of branch {name}
      </label>
      <div className="flex gap-2">
        <input id={`branch-${id}`} name="name" defaultValue={name} className={inputClass} />
        <Button type="submit" variant="secondary" disabled={pending} className="!w-auto">
          {pending ? "Saving…" : "Rename"}
        </Button>
      </div>
      {state.error && <Notice tone="error">{state.error}</Notice>}
    </form>
  );
}
