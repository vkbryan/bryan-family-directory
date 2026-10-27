import { getViewer } from "@/lib/auth";
import { NavLinks } from "./nav-links";

/** The menu under the banner, for signed-in members only. Render inside <Suspense>. */
export async function SiteNav() {
  const viewer = await getViewer();
  if (viewer.state !== "member") return null;
  return <NavLinks myProfileId={viewer.profile.id} isAdmin={viewer.isAdmin} />;
}
