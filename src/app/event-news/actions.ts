"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SaveState } from "@/components/form-bits";

/** Yes or no to family event news, with the email to use. Always the signed-in person's own answer. */
export async function saveEventNews(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const answer = formData.get("wantsNews");
  if (answer !== "yes" && answer !== "no") return { fieldErrors: { wantsNews: "Please choose yes or no." } };
  const wantsNews = answer === "yes";
  const useOther = formData.get("whichEmail") === "other";
  const email = String(formData.get("otherEmail") ?? "").trim().slice(0, 320);
  if (wantsNews && useOther && !email) return { fieldErrors: { otherEmail: "Type the email to use, or choose your sign-in email." } };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_event_news", {
    p_wants_news: wantsNews,
    p_email: wantsNews && useOther ? email : undefined,
  });
  if (error) {
    return error.message.includes("email_invalid")
      ? { fieldErrors: { otherEmail: "Please enter a full email address." } }
      : { error: "Couldn't save. Please try again." };
  }
  refresh();
  return { saved: true };
}
