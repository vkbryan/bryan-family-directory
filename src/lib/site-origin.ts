import "server-only";
import { headers } from "next/headers";

/**
 * "https://bryan-family.com", for building invitation links. Uses SITE_URL
 * when set (on the live site), so links always use the real address, even
 * when made from a test deployment. Falls back to the request's own address,
 * e.g. http://localhost:3000 on your computer.
 */
export async function siteOrigin() {
  const configured = process.env.SITE_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
