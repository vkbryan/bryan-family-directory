import "server-only";
import { cookies } from "next/headers";

// While someone signs in from an invitation link, the link's secret is kept in
// a cookie the browser's scripts cannot read, so it never appears in later
// page addresses or browser history.
const NAME = "family_invitation";

export async function rememberInvitation(secret: string) {
  (await cookies()).set(NAME, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // a day is plenty to finish signing in
  });
}

export async function readInvitation() {
  return (await cookies()).get(NAME)?.value ?? null;
}

export async function forgetInvitation() {
  (await cookies()).delete(NAME);
}
