"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/messages";
import { ICONS, normalizeUrl, SECTIONS } from "@/lib/family-links";
import type { ActionResult } from "../actions";

// The database lets only admins change family links, so these don't repeat the check.

export type LinkFormState = ActionResult & { fieldErrors?: Record<string, string>; savedAt?: number };

const clean = (formData: FormData, name: string, max: number) =>
  String(formData.get(name) ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Adds a link (id null) or saves changes to one. */
export async function saveLink(id: string | null, _prev: LinkFormState, formData: FormData): Promise<LinkFormState> {
  const title = clean(formData, "title", 80);
  const url = normalizeUrl(String(formData.get("url") ?? "").slice(0, 1000));
  const note = clean(formData, "note", 200) || null;
  const section = String(formData.get("section"));
  const icon = String(formData.get("icon"));

  const fieldErrors: Record<string, string> = {};
  if (!title) fieldErrors.title = "Give the link a title.";
  if (!url) fieldErrors.url = "Paste the full web address (starting https://) or an email address.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  if (!SECTIONS.some((s) => s.value === section) || !ICONS.some((i) => i.value === icon)) return { error: "Choose a section and an icon." };

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("family_links").update({ title, url: url!, note, section, icon }).eq("id", id);
    if (error) return { error: friendlyError(error) };
  } else {
    // New links go to the end of their section.
    const { data: last } = await supabase
      .from("family_links")
      .select("sort_order")
      .eq("section", section)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase
      .from("family_links")
      .insert({ title, url: url!, note, section, icon, sort_order: (last?.sort_order ?? -1) + 1 });
    if (error) return { error: friendlyError(error) };
  }
  refresh();
  return { done: true, savedAt: Date.now() };
}

/** Moves a link one place up or down within its section. */
export async function moveLink(id: string, direction: "up" | "down"): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: me } = await supabase.from("family_links").select("section").eq("id", id).single();
  if (!me) return { error: friendlyError(null) };
  const { data: siblings } = await supabase
    .from("family_links")
    .select("id")
    .eq("section", me.section)
    .order("sort_order")
    .order("created_at");
  const order = (siblings ?? []).map((s) => s.id);
  const from = order.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= order.length) return { done: true };
  [order[from], order[to]] = [order[to], order[from]];

  for (const [index, linkId] of order.entries()) {
    const { error } = await supabase.from("family_links").update({ sort_order: index }).eq("id", linkId);
    if (error) return { error: friendlyError(error) };
  }
  refresh();
  return { done: true };
}

export async function setLinkHidden(id: string, hidden: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("family_links").update({ hidden }).eq("id", id);
  if (error) return { error: friendlyError(error) };
  refresh();
  return { done: true };
}

export async function deleteLink(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("family_links").delete().eq("id", id);
  if (error) return { error: friendlyError(error) };
  refresh();
  return { done: true };
}
