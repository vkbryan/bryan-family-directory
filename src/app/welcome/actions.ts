"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/messages";

export type CreateProfileState = { error?: string; fieldErrors?: { fullName?: string } };

export async function createMyProfile(_prev: CreateProfileState, formData: FormData): Promise<CreateProfileState> {
  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const fullName = text("fullName");
  if (!fullName) return { fieldErrors: { fullName: "Please enter your name." } };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_my_profile", {
    p_full_name: fullName,
    p_aka: text("aka") || undefined,
    p_city: text("city") || undefined,
    p_state: text("state") || undefined,
    p_branch_id: text("branch") || undefined,
  });
  if (error) return { error: friendlyError(error) };

  redirect("/");
}
