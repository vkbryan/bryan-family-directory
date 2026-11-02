import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getViewer } from "@/lib/auth";
import { readInvitation } from "@/lib/invitation-cookie";
import { readPendingEmail } from "@/lib/pending-sign-in";
import { Card, Loading } from "@/components/ui";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in · Bryan Family Directory" };

export default function SignInPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Sign in</h1>
      <Suspense fallback={<Loading />}>
        <SignInContent />
      </Suspense>
    </div>
  );
}

async function SignInContent() {
  const [viewer, invitation, waitingFor] = await Promise.all([getViewer(), readInvitation(), readPendingEmail()]);
  // Already signed in and nothing left to accept: nothing to do here.
  if (viewer.state !== "signed-out" && !invitation) redirect("/");

  return (
    <Card>
      <SignInForm waitingFor={waitingFor} />
    </Card>
  );
}
