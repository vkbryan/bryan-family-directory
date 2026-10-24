"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/messages";

/** "This is me" without a claim link: an admin reviews it before anything changes. */
export async function requestClaim(profileId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_profile_claim", { p_profile_id: profileId });
  if (error && !error.message.includes("profile_requests_one_pending")) return { error: friendlyError(error) };
  refresh();
  return {};
}

export async function cancelClaim(requestId: string) {
  const supabase = await createClient();
  await supabase.rpc("cancel_profile_request", { p_request_id: requestId });
  refresh();
}
