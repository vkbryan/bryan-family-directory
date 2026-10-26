"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SaveState } from "@/components/form-bits";
import { normalizeState } from "@/lib/places";
import { splitInterests } from "@/lib/interests";

// Every action runs as the signed-in person. The database decides whether they
// may change this profile (their own, a child they guard, or any if admin),
// and refuses anything else, so these actions don't repeat those checks.

const text = (formData: FormData, name: string, max = 200) => {
  const value = String(formData.get(name) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  return value === "" ? null : value;
};

const visibility = (formData: FormData, name: string) =>
  formData.get(name) === "private" ? ("private" as const) : ("members" as const);

const FAILED = "Couldn't save. Please try again.";

export async function saveBasics(profileId: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  const fullName = text(formData, "fullName");
  if (!fullName) return { fieldErrors: { fullName: "Please enter a name." } };
  const branchId = text(formData, "branch");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, aka: text(formData, "aka") })
    .eq("id", profileId);
  if (error) return { error: FAILED };

  // One main branch, chosen here. Replace whatever was there.
  const { error: clearError } = await supabase.from("profile_branches").delete().eq("profile_id", profileId);
  if (clearError) return { error: FAILED };
  if (branchId) {
    const { error: branchError } = await supabase
      .from("profile_branches")
      .insert({ profile_id: profileId, branch_id: branchId, is_primary: true });
    if (branchError) return { error: FAILED };
  }

  refresh();
  return { saved: true };
}

export async function saveLocation(profileId: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      city: text(formData, "city", 120),
      state: normalizeState(text(formData, "state", 120)),
      location_visibility: visibility(formData, "locationVisibility"),
    })
    .eq("id", profileId);
  if (error) return { error: FAILED };
  refresh();
  return { saved: true };
}

export async function saveBirthday(profileId: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  const month = Number(formData.get("month")) || null;
  const day = Number(formData.get("day")) || null;
  const yearText = text(formData, "year", 4);
  const year = yearText ? Number(yearText) : null;
  const isChild = formData.get("isChild") === "true";

  if ((month && !day) || (!month && day)) {
    return { fieldErrors: { birthday: "Choose both a month and a day, or leave both empty." } };
  }
  if (year !== null && (!Number.isInteger(year) || year < 1850 || year > new Date().getFullYear())) {
    return { fieldErrors: { year: "Enter a four-digit year, like 1980." } };
  }
  if (isChild && year === null) {
    return { fieldErrors: { year: "A child's birth year is needed (it stays private), so we know when they turn 18." } };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      birth_month: month,
      birth_day: day,
      birth_year: year,
      birthday_visibility: visibility(formData, "birthdayVisibility"),
      ...(isChild ? {} : { birth_year_visibility: visibility(formData, "birthYearVisibility") }),
    })
    .eq("id", profileId);
  if (error) {
    return error.message.includes("profiles_birthday_valid")
      ? { fieldErrors: { birthday: "That date doesn't exist. Please check the month and day." } }
      : { error: FAILED };
  }
  refresh();
  return { saved: true };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function saveContact(profileId: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  const email = text(formData, "email", 320)?.toLowerCase() ?? null;
  if (email && !EMAIL.test(email)) return { fieldErrors: { email: "Please enter a full email address." } };
  const instagram = text(formData, "instagram")?.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/+$/, "") || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      contact_email: email,
      phone: text(formData, "phone", 40),
      instagram,
      linkedin: text(formData, "linkedin", 500),
      website: text(formData, "website", 500),
      email_visibility: visibility(formData, "emailVisibility"),
      phone_visibility: visibility(formData, "phoneVisibility"),
      social_visibility: visibility(formData, "socialVisibility"),
    })
    .eq("id", profileId);
  if (error) return { error: FAILED };
  refresh();
  return { saved: true };
}

export async function savePhotoVisibility(profileId: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ photo_visibility: visibility(formData, "photoVisibility") })
    .eq("id", profileId);
  if (error) return { error: FAILED };
  refresh();
  return { saved: true };
}

// --- Interests ------------------------------------------------------------------

export async function addInterest(profileId: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  // Several at once is fine: "hiking, cooking" adds two interests.
  const names = splitInterests(String(formData.get("interest") ?? "").slice(0, 2000));
  if (names.length === 0) return { fieldErrors: { interest: "Type an interest first." } };

  const supabase = await createClient();
  for (const name of names) {
    const { data: hobbyId, error } = await supabase.rpc("ensure_hobby", { p_name: name });
    if (error || !hobbyId) return { error: FAILED };
    const { error: linkError } = await supabase
      .from("profile_hobbies")
      .upsert({ profile_id: profileId, hobby_id: hobbyId }, { ignoreDuplicates: true });
    if (linkError) return { error: FAILED };
  }
  refresh();
  return { saved: true };
}

export async function removeInterest(profileId: string, hobbyId: string) {
  const supabase = await createClient();
  await supabase.from("profile_hobbies").delete().eq("profile_id", profileId).eq("hobby_id", hobbyId);
  refresh();
}

// --- Photo ----------------------------------------------------------------------

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export async function uploadPhoto(profileId: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Please choose a photo." };
  if (!PHOTO_TYPES.includes(file.type)) return { error: "Please choose a JPG or PNG photo." };
  if (file.size > MAX_PHOTO_BYTES) return { error: "That photo is too large. Please choose a smaller one." };

  const supabase = await createClient();
  const { data: current } = await supabase.from("profiles").select("photo_path").eq("id", profileId).single();

  // A new file name each time, so nobody sees an old cached photo.
  const path = `${profileId}/photo-${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("profile-photos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { error: "Couldn't upload the photo. Please try again." };

  const { error } = await supabase.from("profiles").update({ photo_path: path }).eq("id", profileId);
  if (error) {
    await supabase.storage.from("profile-photos").remove([path]);
    return { error: FAILED };
  }
  if (current?.photo_path) await supabase.storage.from("profile-photos").remove([current.photo_path]);

  refresh();
  return { saved: true };
}

export async function removePhoto(profileId: string) {
  const supabase = await createClient();
  const { data: current } = await supabase.from("profiles").select("photo_path").eq("id", profileId).single();
  const { error } = await supabase.from("profiles").update({ photo_path: null }).eq("id", profileId);
  if (!error && current?.photo_path) await supabase.storage.from("profile-photos").remove([current.photo_path]);
  refresh();
}
