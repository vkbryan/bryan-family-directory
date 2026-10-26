"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/messages";
import { siteOrigin } from "@/lib/site-origin";

// The database checks every one of these: only a child's guardians (or an
// admin) can invite co-guardians, decide requests or start a hand-over.

export type LinkState = { link?: string; error?: string };

export async function makeCoGuardianLink(profileId: string): Promise<LinkState> {
  const supabase = await createClient();
  const { data: secret, error } = await supabase.rpc("create_invitation", {
    p_kind: "co_guardian",
    p_profile_id: profileId,
  });
  if (error || !secret) return { error: friendlyError(error) };
  refresh();
  return { link: `${await siteOrigin()}/invite/${secret}` };
}

export async function makeHandOverLink(profileId: string): Promise<LinkState> {
  const supabase = await createClient();
  const { data: secret, error } = await supabase.rpc("create_invitation", { p_kind: "claim", p_profile_id: profileId });
  if (error) {
    return {
      error:
        error.message === "too_young_for_handover"
          ? "A profile can be handed over once the child is 13 or older."
          : friendlyError(error),
    };
  }
  refresh();
  return { link: `${await siteOrigin()}/invite/${secret}` };
}

export async function decideRequest(requestId: string, approve: boolean) {
  const supabase = await createClient();
  await supabase.rpc("decide_profile_request", { p_request_id: requestId, p_approve: approve });
  refresh();
}

export async function stepDown(profileId: string, accountId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_guardian", {
    p_profile_id: profileId,
    p_account_id: accountId,
    p_reason: "stepped down",
  });
  if (!error) redirect(`/people/${profileId}`);
  refresh();
}

/** Admins only (the database refuses anyone else). */
export async function adminRemoveGuardian(profileId: string, accountId: string) {
  const supabase = await createClient();
  await supabase.rpc("remove_guardian", { p_profile_id: profileId, p_account_id: accountId, p_reason: "removed by admin" });
  refresh();
}

/** Admins only (the database refuses anyone else). */
export async function adminAddGuardian(profileId: string, _prev: LinkState, formData: FormData): Promise<LinkState> {
  const accountId = String(formData.get("accountId") ?? "");
  if (!accountId) return { error: "Choose a family member first." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_add_guardian", { p_profile_id: profileId, p_account_id: accountId });
  if (error) return { error: friendlyError(error) };
  refresh();
  return {};
}

// --- Family tree links (admins only; the database refuses anyone else) ----------
// Recording someone as a parent is genealogy only: it grants no editing rights.

const PARENT_KINDS = ["biological", "adoptive", "step", "foster", "unspecified"];

export async function addParentLink(childId: string, _prev: LinkState, formData: FormData): Promise<LinkState> {
  const parentId = String(formData.get("parentId") ?? "");
  const detail = String(formData.get("detail") ?? "unspecified");
  if (!parentId) return { error: "Choose a parent first." };
  if (!PARENT_KINDS.includes(detail)) return { error: "Choose how they're related." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("family_relationships")
    .insert({ relationship: "parent", person_a: parentId, person_b: childId, detail });
  if (error) return { error: error.code === "23505" ? "That parent is already recorded." : friendlyError(error) };
  refresh();
  return {};
}

export async function removeParentLink(relationshipId: string) {
  const supabase = await createClient();
  await supabase.from("family_relationships").delete().eq("id", relationshipId);
  refresh();
}
