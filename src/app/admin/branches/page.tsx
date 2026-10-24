import { Suspense } from "react";
import { requireAdminViewer } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { Card, Loading } from "@/components/ui";
import { AddBranchForm, RenameBranchForm } from "./branch-forms";

export const metadata = { title: "Branches · Admin" };

export default function BranchesPage() {
  return (
    <>
      <h1 className="text-3xl font-bold">Family branches</h1>
      <p className="text-muted">
        Branches are the main way relatives browse the directory. Renaming a branch updates it for everyone in it.
      </p>
      <Suspense fallback={<Loading />}>
        <BranchesContent />
      </Suspense>
    </>
  );
}

async function BranchesContent() {
  await requireAdminViewer();
  const supabase = await createClient();
  const [{ data: branches }, { data: links }] = await Promise.all([
    supabase.from("family_branches").select("id, name").order("sort_order").order("name"),
    supabase.from("profile_branches").select("branch_id"),
  ]);
  const counts = new Map<string, number>();
  for (const link of links ?? []) counts.set(link.branch_id, (counts.get(link.branch_id) ?? 0) + 1);

  return (
    <>
      <Card>
        <AddBranchForm />
      </Card>
      <ul className="flex flex-col gap-3">
        {(branches ?? []).map((b) => (
          <li key={b.id}>
            <Card className="flex flex-col gap-2">
              <p className="text-sm text-muted">
                {counts.get(b.id) ?? 0} {counts.get(b.id) === 1 ? "person" : "people"}
              </p>
              <RenameBranchForm id={b.id} name={b.name} />
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
