import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { byName, slugOf, type Person } from "@/lib/directory-logic";

const PHOTO_LINK_SECONDS = 60 * 60;

/**
 * Everyone the signed-in viewer may see, with only the fields they may see.
 * The database decides both (directory_profiles and the photo rules), so this
 * never needs its own permission checks. Loaded once per request.
 */
export const getDirectory = cache(async (): Promise<Person[]> => {
  const supabase = await createClient();
  const [{ data: rows }, { data: branchLinks }, { data: hobbyLinks }] = await Promise.all([
    supabase.rpc("directory_profiles").select("*"),
    supabase.from("profile_branches").select("profile_id, is_primary, family_branches(name)"),
    supabase.from("profile_hobbies").select("profile_id, hobbies(name, slug)"),
  ]);
  if (!rows) return [];

  // Short-lived private links, one per photo this viewer is allowed to see.
  const paths = rows.map((r) => r.photo_path).filter((p): p is string => Boolean(p));
  const photoUrls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("profile-photos").createSignedUrls(paths, PHOTO_LINK_SECONDS);
    for (const s of signed ?? []) if (s.path && s.signedUrl && !s.error) photoUrls.set(s.path, s.signedUrl);
  }

  return rows
    .map((r): Person => {
      const branches = (branchLinks ?? [])
        .filter((l) => l.profile_id === r.id && l.family_branches)
        .sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
      return {
        id: r.id,
        fullName: r.full_name,
        aka: r.aka,
        isChild: r.profile_type === "child",
        isClaimed: r.is_claimed,
        isMe: r.is_me,
        canEdit: r.can_edit,
        city: r.city,
        state: r.state,
        birthMonth: r.birth_month,
        birthDay: r.birth_day,
        birthYear: r.birth_year,
        photoUrl: r.photo_path ? (photoUrls.get(r.photo_path) ?? null) : null,
        primaryBranch: branches.find((b) => b.is_primary)?.family_branches?.name ?? null,
        branches: branches.map((b) => ({ slug: slugOf(b.family_branches!.name), name: b.family_branches!.name })),
        hobbies: (hobbyLinks ?? [])
          .filter((l) => l.profile_id === r.id && l.hobbies)
          .map((l) => ({ slug: l.hobbies!.slug, name: l.hobbies!.name }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        contactEmail: r.contact_email,
        phone: r.phone,
        instagram: r.instagram,
        linkedin: r.linkedin,
        website: r.website,
      };
    })
    .sort(byName);
});

/** Profiles the viewer is an active guardian of (each person can read their own guardian rows). */
export const getMyGuardedIds = cache(async (): Promise<Set<string>> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const me = auth?.claims?.sub;
  if (!me) return new Set();
  const { data } = await supabase.from("profile_managers").select("profile_id").eq("account_id", me).is("revoked_at", null);
  return new Set((data ?? []).map((row) => row.profile_id));
});

/** All branch names, for the branch filter (including branches nobody has joined yet). */
export const getBranchNames = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("family_branches").select("name").order("sort_order").order("name");
  return (data ?? []).map((b) => ({ slug: slugOf(b.name), name: b.name }));
});
