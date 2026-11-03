import { createClient } from "@/lib/supabase/server";

export type EventNews = {
  /** Null until they've answered. */
  wantsNews: boolean | null;
  /** A different email they chose, or null for their sign-in email. */
  email: string | null;
  signInEmail: string;
};

/** The signed-in person's own answer. */
export async function getMyEventNews(): Promise<EventNews | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_event_news");
  const row = data?.[0];
  if (!row) return null;
  return { wantsNews: row.wants_news, email: row.email, signInEmail: row.sign_in_email };
}
