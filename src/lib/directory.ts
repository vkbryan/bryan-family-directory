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
  const [{ data: rows }, { data: branchLinks }, { data: hobbyLinks }, allBranches, { data: parentLinks }] = await Promise.all([
    supabase.rpc("directory_profiles").select("*"),
    supabase.from("profile_branches").select("profile_id, is_primary, family_branches(name)"),
    supabase.from("profile_hobbies").select("profile_id, hobbies(name, slug)"),
    getBranchNames(),
    supabase.from("family_relationships").select("person_a, person_b").eq("relationship", "parent"),
  ]);
  if (!rows) return [];
  // Names of everyone this viewer can see, for parent and child links.
  const nameOf = new Map(rows.map((r) => [r.id, r.full_name]));
  const linked = (ids: string[]) =>
    ids.filter((id) => nameOf.has(id)).map((id) => ({ id, name: nameOf.get(id)! })).sort((a, b) => a.name.localeCompare(b.name));
  const branchColor = new Map(allBranches.map((b) => [b.name, b.color]));

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
        primaryBranchColor: branchColor.get(branches.find((b) => b.is_primary)?.family_branches?.name ?? ""),
        branches: branches.map((b) => ({
          slug: slugOf(b.family_branches!.name),
          name: b.family_branches!.name,
          color: branchColor.get(b.family_branches!.name),
        })),
        parents: linked((parentLinks ?? []).filter((l) => l.person_b === r.id).map((l) => l.person_a)),
        children: linked((parentLinks ?? []).filter((l) => l.person_a === r.id).map((l) => l.person_b)),
        hobbies: (hobbyLinks ?? [])
          .filter((l) => l.profile_id === r.id && l.hobbies)
          .map((l) => ({ slug: l.hobbies!.slug, name: l.hobbies!.name }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        contactEmail: r.contact_email,
        phone: r.phone,
        instagram: r.instagram,
        linkedin: r.linkedin,
        website: r.website,
        addedAt: r.created_at,
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
  const { data } = await supabase.from("family_branches").select("name, created_at").order("sort_order").order("name");
  // Colors follow the order branches were added, so a new branch never changes anyone else's color.
  const byAge = [...(data ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.name.localeCompare(b.name));
  const colorOf = new Map(byAge.map((b, i) => [b.name, i]));
  return (data ?? []).map((b) => ({ slug: slugOf(b.name), name: b.name, color: colorOf.get(b.name) ?? 0 }));
});
