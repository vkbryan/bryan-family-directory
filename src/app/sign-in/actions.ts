"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { forgetInvitation, readInvitation, rememberInvitation } from "@/lib/invitation-cookie";
import { friendlyError } from "@/lib/messages";

export type SignInState = {
  step: "email" | "code";
  email: string;
  message?: string;
  error?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** One action for both steps, so the form keeps a single state. */
export async function signInStep(prev: SignInState, formData: FormData): Promise<SignInState> {
  return formData.get("intent") === "verify" ? verifyCode(prev, formData) : requestCode(prev, formData);
}

async function requestCode(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    return { step: "email", email, error: "Please enter a full email address, like name@example.com." };
  }

  // Sent from the invitation page's own email box; otherwise remembered earlier.
  const fromPage = String(formData.get("invitation") ?? "");
  if (fromPage) await rememberInvitation(fromPage);
  const invitation = fromPage || (await readInvitation());
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Only someone holding an invitation can create a new account. The
      // database checks the invitation again before Supabase creates anyone.
      shouldCreateUser: Boolean(invitation),
      data: invitation ? { invitation } : undefined,
    },
  });

  if (error) {
    if (error.status === 429) {
      return { step: "email", email, error: "Too many tries. Please wait a few minutes and try again." };
    }
    if (invitation) {
      // The invitation check explains itself (expired, already used, …).
      return { step: "email", email, error: error.message };
    }
    // Without an invitation, an unknown email fails here. Say the same thing
    // either way, so the page never reveals who is a member.
  }

  return {
    step: "code",
    email,
    message: invitation
      ? `We sent a code to ${email}.`
      : `If ${email} belongs to a family member, we sent it a code.`,
  };
}

async function verifyCode(prev: SignInState, formData: FormData): Promise<SignInState> {
  const token = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (token.length < 6) {
    return { ...prev, message: undefined, error: "Enter the code from the email. It's 6 or more numbers." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: prev.email, token, type: "email" });
  if (error) {
    return {
      ...prev,
      message: undefined,
      error: "That code didn't work. Check the newest email, or ask for a new code. Codes expire after an hour.",
    };
  }

  const invitation = await readInvitation();
  if (!invitation) redirect("/");

  const { data, error: acceptError } = await supabase.rpc("accept_invitation", { p_secret: invitation });
  await forgetInvitation();
  if (acceptError) {
    // Signed in, but the invitation could not be used. The home page explains next steps.
    return { ...prev, message: undefined, error: friendlyError(acceptError) };
  }

  redirect((data as { kind?: string } | null)?.kind === "join" ? "/welcome" : "/");
}
