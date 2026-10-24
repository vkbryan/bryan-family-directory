"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/messages";

// Admin actions. Each database function checks that the caller is an active
// admin and refuses everyone else, so these don't repeat the check.

export type ActionResult = { error?: string; done?: boolean };

export async function setAccountStatus(accountId: string, status: "active" | "deactivated"): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_account_status", { p_account_id: accountId, p_status: status });
  if (error) {
    return { error: error.message === "cannot_remove_last_admin" ? "You can't deactivate the last admin." : friendlyError(error) };
  }
  refresh();
  return { done: true };
}

export async function setAccountRole(accountId: string, role: "member" | "admin"): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_account_role", { p_account_id: accountId, p_role: role });
  if (error) {
    return { error: error.message === "cannot_remove_last_admin" ? "There must always be at least one admin." : friendlyError(error) };
  }
  refresh();
  return { done: true };
}

export async function decideRequest(requestId: string, approve: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_profile_request", { p_request_id: requestId, p_approve: approve });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { done: true };
}

export async function revokeInvitation(invitationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", { p_invitation_id: invitationId });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { done: true };
}

export async function addBranch(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").replace(/\s+/g, " ").trim();
  if (!name) return { error: "Type the branch name first." };
  const supabase = await createClient();
  const { error } = await supabase.from("family_branches").insert({ name });
  if (error) return { error: error.code === "23505" ? "There's already a branch with that name." : friendlyError(error) };
  refresh();
  return { done: true };
}

export async function renameBranch(branchId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").replace(/\s+/g, " ").trim();
  if (!name) return { error: "A branch needs a name." };
  const supabase = await createClient();
  const { error } = await supabase.from("family_branches").update({ name }).eq("id", branchId);
  if (error) return { error: error.code === "23505" ? "There's already a branch with that name." : friendlyError(error) };
  refresh();
  return { done: true };
}
