import "server-only";
import { headers } from "next/headers";

/** "https://example.com", from the request, for building invitation links. */
export async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
