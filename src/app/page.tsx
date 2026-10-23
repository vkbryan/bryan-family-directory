import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getViewer, greetingName } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button, ButtonLink, Card, Loading } from "@/components/ui";
import { signOut } from "./actions";

export default function Home() {
  return (
    <Suspense fallback={<Loading />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const viewer = await getViewer();

  switch (viewer.state) {
    case "signed-out":
      return <Welcome />;
    case "needs-profile":
      redirect("/welcome");
    case "pending":
      return (
        <StatusCard title="You're signed in, but not connected yet">
          To join the directory, open the invitation link a relative sent you. If it has expired, ask them for a
          new one.
        </StatusCard>
      );
    case "deactivated":
      return (
        <StatusCard title="This account is no longer active">
          If you think this is a mistake, contact a family admin.
        </StatusCard>
      );
    case "member":
      return <MemberHome name={greetingName(viewer.profile)} />;
  }
}

function Welcome() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Welcome</h1>
      <p className="text-lg">
        A private place for our family to find one another, see where relatives live, and stay in touch.
      </p>
      <Card className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">New here?</h2>
        <p>Open the invitation link a relative sent you. The directory is for invited family members only.</p>
      </Card>
      <Card className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Already a member?</h2>
        <ButtonLink href="/sign-in">Sign in</ButtonLink>
      </Card>
    </div>
  );
}

function StatusCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p>{children}</p>
      <form action={signOut}>
        <Button variant="secondary">Sign out</Button>
      </form>
    </Card>
  );
}

async function MemberHome({ name }: { name: string }) {
  // A simple list for now; the searchable directory arrives in Milestone 4.
  const supabase = await createClient();
  const { data: people } = await supabase.rpc("directory_profiles").select("id, full_name, aka").order("full_name");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Hi, {name}</h1>
      <Card className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Family members ({people?.length ?? 0})</h2>
        <ul className="flex flex-col gap-1">
          {people?.map((person) => (
            <li key={person.id}>
              {person.full_name}
              {person.aka && <span className="text-muted"> ({person.aka})</span>}
            </li>
          ))}
        </ul>
      </Card>
      <div className="flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/invitations">Invite a relative</ButtonLink>
        <form action={signOut}>
          <Button variant="secondary">Sign out</Button>
        </form>
      </div>
    </div>
  );
}
