import "server-only";
import { cookies } from "next/headers";

// After a code is emailed, remember which address it went to for as long as
// the code works. Someone who closes the page and comes back is taken straight
// to "type the code" instead of starting over. Scripts on the page can't read it.
const NAME = "family_signin_email";

export async function rememberPendingEmail(email: string) {
  (await cookies()).set(NAME, email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // codes expire after an hour
  });
}

export async function readPendingEmail() {
  return (await cookies()).get(NAME)?.value ?? null;
}

export async function forgetPendingEmail() {
  (await cookies()).delete(NAME);
}
