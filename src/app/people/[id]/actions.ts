"use server";

import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/messages";
import type { SaveState } from "@/components/form-bits";

/** "I'm a parent of this child": an existing guardian (or an admin) decides. */
export async function requestToManage(profileId: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  const message = String(formData.get("message") ?? "").trim().slice(0, 300);
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_co_guardianship", {
    p_profile_id: profileId,
    p_message: message || undefined,
  });
  if (error) {
    // A second click while one is already waiting is fine.
    if (error.message.includes("profile_requests_one_pending")) return { saved: true };
    return { error: friendlyError(error) };
  }
  return { saved: true };
}
