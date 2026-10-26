import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Viewer =
  | { state: "signed-out" }
  | { state: "pending" }
  | { state: "deactivated" }
  | { state: "needs-profile"; isAdmin: boolean }
  | {
      state: "member";
      accountId: string;
      isAdmin: boolean;
      profile: { id: string; fullName: string; aka: string | null };
    };

/**
 * Who is looking at the page, and how far along they are.
 * Reads the session at request time, so call it inside a <Suspense> boundary.
 */
export async function getViewer(): Promise<Viewer> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return { state: "signed-out" };

  const { data: account } = await supabase.from("accounts").select("status, role").eq("id", userId).maybeSingle();
  if (!account || account.status === "pending") return { state: "pending" };
  if (account.status === "deactivated") return { state: "deactivated" };

  const isAdmin = account.role === "admin";
  const { data: me } = await supabase
    .rpc("directory_profiles")
    .select("id, full_name, aka")
    .eq("is_me", true)
    .maybeSingle();
  if (!me) return { state: "needs-profile", isAdmin };

  return { state: "member", accountId: userId, isAdmin, profile: { id: me.id, fullName: me.full_name, aka: me.aka } };
}

/** First name or nickname, for greetings. */
export function greetingName(profile: { fullName: string; aka: string | null }) {
  return profile.aka?.trim() || profile.fullName.trim().split(/\s+/)[0];
}
