"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rememberInvitation } from "@/lib/invitation-cookie";
import { friendlyError } from "@/lib/messages";

/** A signed-out visitor starts signing in, carrying the invitation along. */
export async function startFromInvitation(secret: string) {
  await rememberInvitation(secret);
  redirect("/sign-in");
}

/** An already signed-in member accepts (for example, co-managing a child). */
export async function acceptAsSignedIn(secret: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_secret: secret });
  if (error) return friendlyError(error);
  redirect((data as { kind?: string } | null)?.kind === "join" ? "/welcome" : "/");
}
