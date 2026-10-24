import "server-only";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";

/** Sends anyone who isn't an active admin back home. (The database also refuses them.) */
export async function requireAdminViewer() {
  const viewer = await getViewer();
  if (viewer.state !== "member" || !viewer.isAdmin) redirect("/");
  return viewer;
}

export function formatDate(value: string | null) {
  if (!value) return "never";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type InvitationTimes = { expires_at: string; accepted_at: string | null; revoked_at: string | null };

/** "Used", "Cancelled", "Expired" or "Waiting", as of now. */
export function invitationStatus(inv: InvitationTimes) {
  if (inv.accepted_at) return "Used";
  if (inv.revoked_at) return "Cancelled";
  return new Date(inv.expires_at).getTime() < Date.now() ? "Expired" : "Waiting";
}
