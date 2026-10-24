"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/messages";
import type { SaveState } from "@/components/form-bits";

const RELATIONSHIPS = ["biological", "adoptive", "step", "foster", "guardian"];

export async function addChild(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const text = (name: string) => String(formData.get(name) ?? "").replace(/\s+/g, " ").trim();
  const fullName = text("fullName");
  const month = Number(formData.get("month")) || null;
  const day = Number(formData.get("day")) || null;
  const year = Number(text("year")) || null;
  const relationship = text("relationship");

  const fieldErrors: Record<string, string> = {};
  if (!fullName) fieldErrors.fullName = "Please enter the child's name.";
  if (!year || year < new Date().getFullYear() - 18 || year > new Date().getFullYear()) {
    fieldErrors.year = "Enter the year they were born. It stays private; it tells us when they turn 18.";
  }
  if ((month && !day) || (!month && day)) fieldErrors.birthday = "Choose both a month and a day, or leave both empty.";
  if (!RELATIONSHIPS.includes(relationship)) fieldErrors.relationship = "Please choose how you're related.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = await createClient();
  const { data: childId, error } = await supabase.rpc("create_child_profile", {
    p_full_name: fullName,
    p_birth_year: year!,
    p_birth_month: month ?? undefined,
    p_birth_day: day ?? undefined,
    p_aka: text("aka") || undefined,
    // A guardian who isn't a parent gets editing rights but no parent relationship.
    p_parent_detail: relationship === "guardian" ? undefined : relationship,
  });
  if (error || !childId) {
    return error?.message.includes("profiles_birthday_valid")
      ? { fieldErrors: { birthday: "That date doesn't exist. Please check the month and day." } }
      : { error: friendlyError(error) };
  }

  // Straight to their profile editor, to add a photo and interests.
  redirect(`/people/${childId}/edit`);
}
