"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/messages";

/** An already signed-in member accepts (for example, co-managing a child). */
export async function acceptAsSignedIn(secret: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_secret: secret });
  if (error) return friendlyError(error);
  redirect((data as { kind?: string } | null)?.kind === "join" ? "/welcome" : "/");
}
