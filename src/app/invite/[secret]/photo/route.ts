import { createClient } from "@/lib/supabase/server";

/**
 * The family photo for a valid invitation. The database returns it only when
 * the invitation in the address is valid, so anyone without a working link
 * gets "not found". Never cached anywhere, so it disappears from the page as
 * soon as the link is used, cancelled or expires.
 */
export async function GET(_request: Request, ctx: RouteContext<"/invite/[secret]/photo">) {
  const { secret } = await ctx.params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("invitation_photo", { p_secret: secret });
  const photo = data?.[0];
  if (!photo) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

  return new Response(Buffer.from(photo.image_base64, "base64"), {
    headers: {
      "Content-Type": photo.content_type,
      "Cache-Control": "private, no-store",
    },
  });
}
