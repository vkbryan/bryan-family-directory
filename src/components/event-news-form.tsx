"use client";

import { useActionState, useState } from "react";
import { saveEventNews } from "@/app/event-news/actions";
import type { EventNews } from "@/lib/event-news";
import { SaveRow, type SaveState } from "./form-bits";
import { TextField } from "./ui";

const radio = "h-5 w-5 shrink-0 accent-accent";

/** "Send me news about family events?" with which email to use. */
export function EventNewsForm({ news, saveLabel }: { news: EventNews; saveLabel?: string }) {
  const [state, save, pending] = useActionState<SaveState, FormData>(saveEventNews, {});
  const [wants, setWants] = useState(news.wantsNews === null ? null : news.wantsNews ? "yes" : "no");
  const [which, setWhich] = useState(news.email ? "other" : "signIn");

  return (
    <form action={save} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">Send me news about family events, like reunions?</legend>
        {[
          { value: "yes", text: "Yes, please" },
          { value: "no", text: "No, thanks" },
        ].map((c) => (
          <label key={c.value} className="flex min-h-11 items-center gap-3">
            <input
              type="radio"
              name="wantsNews"
              value={c.value}
              checked={wants === c.value}
              onChange={() => setWants(c.value)}
              className={radio}
            />
            {c.text}
          </label>
        ))}
        {state.fieldErrors?.wantsNews && <p className="text-sm font-medium text-danger">{state.fieldErrors.wantsNews}</p>}
      </fieldset>

      {wants === "yes" && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">Which email should we use?</legend>
          <label className="flex min-h-11 items-center gap-3">
            <input type="radio" name="whichEmail" value="signIn" checked={which === "signIn"} onChange={() => setWhich("signIn")} className={radio} />
            <span className="min-w-0 break-all">{news.signInEmail} (the one you sign in with)</span>
          </label>
          <label className="flex min-h-11 items-center gap-3">
            <input type="radio" name="whichEmail" value="other" checked={which === "other"} onChange={() => setWhich("other")} className={radio} />
            A different email
          </label>
          {which === "other" && (
            <TextField
              id="otherEmail"
              name="otherEmail"
              type="email"
              label="Email for event news"
              autoComplete="email"
              defaultValue={news.email ?? ""}
              error={state.fieldErrors?.otherEmail}
            />
          )}
        </fieldset>
      )}

      <p className="text-sm text-muted">Only the directory admins see this list. You can change your answer on your profile anytime.</p>
      <SaveRow state={state} pending={pending} label={saveLabel} />
    </form>
  );
}
