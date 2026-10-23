import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, Loading } from "@/components/ui";
import { CreateProfileForm } from "./create-profile-form";

export const metadata = { title: "Welcome · Bryan Family Directory" };

export default function WelcomePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Welcome to the family directory</h1>
      <p className="text-lg">Just a few details so relatives can find you. Only your name is required.</p>
      <Suspense fallback={<Loading />}>
        <WelcomeContent />
      </Suspense>
    </div>
  );
}

async function WelcomeContent() {
  const viewer = await getViewer();
  if (viewer.state !== "needs-profile") redirect("/");

  const supabase = await createClient();
  const { data: branches } = await supabase.from("family_branches").select("id, name").order("sort_order").order("name");

  return (
    <Card>
      <CreateProfileForm branches={branches ?? []} />
    </Card>
  );
}
