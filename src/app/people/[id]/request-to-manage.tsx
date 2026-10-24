"use client";

import { useActionState } from "react";
import { Notice, TextField } from "@/components/ui";
import { SaveRow, type SaveState } from "@/components/form-bits";
import { requestToManage } from "./actions";

export function RequestToManage({ profileId, firstName }: { profileId: string; firstName: string }) {
  const [state, request, pending] = useActionState<SaveState, FormData>(requestToManage.bind(null, profileId), {});
  if (state.saved) {
    return <Notice tone="success">Request sent. {firstName}&apos;s parent or guardian will be asked to approve it.</Notice>;
  }
  return (
    <form action={request} className="flex flex-col gap-4">
      <TextField
        id="message"
        name="message"
        label="A note for the current parent or guardian (optional)"
        hint="For example: “I'm their dad.”"
        maxLength={300}
      />
      <SaveRow state={state} pending={pending} label="Ask to help manage" />
    </form>
  );
}
