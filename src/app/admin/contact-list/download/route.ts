import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** One spreadsheet cell, quoted, with formula characters made harmless. */
function cell(value: string | null) {
  const text = (value ?? "").replace(/^[=+\-@\t\r]/, "'$&");
  return `"${text.replace(/"/g, '""')}"`;
}

/** The event-news contact list as a CSV file. Admins only. */
export async function GET() {
  const viewer = await getViewer();
  if (viewer.state !== "member" || !viewer.isAdmin) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_contact_list");
  if (error) return new Response("Couldn't load the list. Please try again.", { status: 500 });

  const rows = [
    ["Name", "Email", "Branch", "City", "State", "Said yes on"],
    ...(data ?? []).map((c) => [c.full_name, c.email, c.branch, c.city, c.state, c.answered_at.slice(0, 10)]),
  ];
  // A byte-order mark so Excel reads accented names correctly.
  const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="family-contact-list-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
