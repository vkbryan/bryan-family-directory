"use server";

import { headers } from "next/headers";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/messages";

export type InviteState = { link?: string; label?: string; error?: string };

export async function createJoinLink(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const label = String(formData.get("label") ?? "").trim();
  const supabase = await createClient();
  const { data: secret, error } = await supabase.rpc("create_invitation", {
    p_kind: "join",
    p_profile_id: undefined,
    p_recipient_label: label || undefined,
  });
  if (error || !secret) return { error: friendlyError(error) };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  refresh();
  return { link: `${protocol}://${host}/invite/${secret}`, label };
}

export async function cancelInvitation(invitationId: string) {
  const supabase = await createClient();
  await supabase.rpc("revoke_invitation", { p_invitation_id: invitationId });
  refresh();
}
