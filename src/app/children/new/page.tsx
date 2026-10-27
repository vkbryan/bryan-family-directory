import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getViewer } from "@/lib/auth";
import { getDirectory, getMyGuardedIds } from "@/lib/directory";
import { Avatar } from "@/components/avatar";
import { Card, Loading } from "@/components/ui";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AddChildForm } from "./add-child-form";

export const metadata = { title: "Add a child · Bryan Family Directory" };

export default function AddChildPage() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={null}>
        <Crumbs />
      </Suspense>
      <h1 className="text-3xl font-bold">Add a child</h1>
      <p className="text-lg">
        Children don&apos;t need an email or an account. You&apos;ll manage their profile, and you can add another
        parent later.
      </p>
      <Suspense fallback={<Loading />}>
        <AddChildContent />
      </Suspense>
    </div>
  );
}

async function Crumbs() {
  const viewer = await getViewer();
  const myProfile = viewer.state === "member" ? `/people/${viewer.profile.id}` : undefined;
  return <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "My profile", href: myProfile }, { label: "Add a child" }]} />;
}

async function AddChildContent() {
  const viewer = await getViewer();
  if (viewer.state !== "member") redirect("/");

  // Children already listed, so a second parent doesn't add a duplicate.
  const [everyone, mine] = await Promise.all([getDirectory(), getMyGuardedIds()]);
  const children = everyone.filter((p) => p.isChild && !mine.has(p.id));

  return (
    <>
      {children.length > 0 && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Is your child already here?</h2>
          <p>If so, open their profile and ask to help manage it, instead of adding them again.</p>
          <ul className="flex flex-col gap-3">
            {children.map((child) => (
              <li key={child.id}>
                <Link href={`/people/${child.id}`} className="flex items-center gap-3 text-foreground no-underline">
                  <Avatar name={child.fullName} photoUrl={child.photoUrl} size="sm" />
                  <span className="font-semibold">{child.fullName}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <AddChildForm />
      </Card>
    </>
  );
}
