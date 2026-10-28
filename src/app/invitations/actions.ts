"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/messages";
import { siteOrigin } from "@/lib/site-origin";

export type InviteState = { link?: string; label?: string; error?: string; labelError?: string };

export async function createJoinLink(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const label = String(formData.get("label") ?? "").trim();
  // Needed to keep track of who has joined and who is stuck.
  if (!label) return { labelError: "Type their name, like “Cousin Robin”." };
  const supabase = await createClient();
  const { data: secret, error } = await supabase.rpc("create_invitation", {
    p_kind: "join",
    p_profile_id: undefined,
    p_recipient_label: label,
  });
  if (error || !secret) return { error: friendlyError(error) };

  refresh();
  return { link: `${await siteOrigin()}/invite/${secret}`, label };
}

export async function cancelInvitation(invitationId: string) {
  const supabase = await createClient();
  await supabase.rpc("revoke_invitation", { p_invitation_id: invitationId });
  refresh();
}
