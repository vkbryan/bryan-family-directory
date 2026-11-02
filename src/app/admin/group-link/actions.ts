"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/messages";
import { siteOrigin } from "@/lib/site-origin";

export type GroupLinkState = { link?: string; error?: string };

/** One link for the family group chat. The database allows admins only. */
export async function createGroupLink(_prev: GroupLinkState, formData: FormData): Promise<GroupLinkState> {
  const label = String(formData.get("label") ?? "").trim() || "Family WhatsApp group";
  const supabase = await createClient();
  const { data: secret, error } = await supabase.rpc("create_group_link", { p_label: label });
  if (error || !secret) return { error: friendlyError(error) };

  refresh();
  return { link: `${await siteOrigin()}/invite/${secret}` };
}
