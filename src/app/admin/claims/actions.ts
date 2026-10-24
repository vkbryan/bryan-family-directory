"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/messages";
import { siteOrigin } from "@/lib/site-origin";

export type ClaimLinkState = { link?: string; error?: string };

/** The database only lets admins make claim links for adults, whatever the page shows. */
export async function createClaimLink(
  profileId: string,
  fullName: string,
): Promise<ClaimLinkState> {
  const supabase = await createClient();
  const { data: secret, error } = await supabase.rpc("create_invitation", {
    p_kind: "claim",
    p_profile_id: profileId,
    p_recipient_label: fullName,
  });
  if (error || !secret) return { error: friendlyError(error) };

  refresh();
  return { link: `${await siteOrigin()}/invite/${secret}` };
}
