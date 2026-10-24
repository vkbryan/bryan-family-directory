import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getViewer } from "@/lib/auth";
import { getDirectory } from "@/lib/directory";
import { placeLabel } from "@/lib/directory-logic";
import { createClient } from "@/lib/supabase/server";
import { Card, Loading } from "@/components/ui";
import { CreateProfileForm } from "./create-profile-form";
import { ClaimChoices } from "./claim-choices";

export const metadata = { title: "Welcome · Bryan Family Directory" };

export default function WelcomePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Welcome to the family directory</h1>
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
  const [{ data: branches }, everyone, { data: myRequests }] = await Promise.all([
    supabase.from("family_branches").select("id, name").order("sort_order").order("name"),
    getDirectory(),
    supabase.from("profile_requests").select("id, profile_id").eq("kind", "claim").eq("status", "pending").limit(1),
  ]);

  // Adults already listed who haven't joined: one of them may be this person.
  const candidates = everyone
    .filter((p) => !p.isClaimed && !p.isChild)
    .map((p) => ({ id: p.id, fullName: p.fullName, aka: p.aka, photoUrl: p.photoUrl, place: placeLabel(p) }));
  const request = myRequests?.[0];
  const pending = request
    ? { requestId: request.id, name: everyone.find((p) => p.id === request.profile_id)?.fullName ?? "a profile" }
    : null;

  return (
    <>
      {(candidates.length > 0 || pending) && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Are you already in the directory?</h2>
          {!pending && <p>Some relatives were added before they joined. If one of these is you, say so.</p>}
          <ClaimChoices candidates={candidates} pending={pending} />
        </Card>
      )}
      {!pending && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">{candidates.length > 0 ? "Not listed? Add yourself" : "Add yourself"}</h2>
          <p>Just a few details so relatives can find you. Only your name is required.</p>
          <CreateProfileForm branches={branches ?? []} />
        </Card>
      )}
    </>
  );
}
