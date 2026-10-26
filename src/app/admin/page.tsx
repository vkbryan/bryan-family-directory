import Link from "next/link";
import { Suspense } from "react";
import { invitationStatus, requireAdminViewer } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { Card, Loading } from "@/components/ui";
import { PilotChecklist } from "./pilot-checklist";

export const metadata = { title: "Admin · Bryan Family Directory" };

export default function AdminHome() {
  return (
    <>
      <h1 className="text-3xl font-bold">Admin</h1>
      <Suspense fallback={<Loading />}>
        <AdminSummary />
      </Suspense>
    </>
  );
}

async function AdminSummary() {
  const viewer = await requireAdminViewer();
  const supabase = await createClient();
  const [{ data: accounts }, { data: claimRequests }, { data: coRequests }, { data: profiles }, { data: invitations }] =
    await Promise.all([
      supabase.rpc("admin_accounts"),
      supabase.rpc("admin_claim_requests"),
      supabase.from("profile_requests").select("id").eq("kind", "co_guardian").eq("status", "pending"),
      supabase.from("profiles").select("id, account_id, profile_type, is_living").is("archived_at", null),
      supabase.from("invitations").select("id, expires_at, accepted_at, revoked_at"),
    ]);

  const active = (accounts ?? []).filter((a) => a.status === "active").length;
  const pending = (accounts ?? []).filter((a) => a.status === "pending").length;
  const unclaimed = (profiles ?? []).filter((p) => !p.account_id && p.profile_type === "adult" && p.is_living).length;
  const waiting = (invitations ?? []).filter((i) => invitationStatus(i) === "Waiting").length;
  const requests = (claimRequests?.length ?? 0) + (coRequests?.length ?? 0);

  const tiles = [
    { href: "/admin/requests", label: "Requests waiting for you", value: requests, highlight: requests > 0 },
    { href: "/admin/members", label: "Active members", value: active },
    { href: "/admin/members", label: "Signed in but not connected", value: pending },
    { href: "/admin/members", label: "Invitation links waiting", value: waiting },
    { href: "/admin/claims", label: "Profiles not yet claimed", value: unclaimed },
    { href: "/", label: "Profiles in the directory", value: profiles?.length ?? 0 },
  ];

  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2">
        {tiles.map((tile) => (
          <li key={tile.label}>
            <Link href={tile.href} className="block text-foreground no-underline">
              <Card className={tile.highlight ? "border-accent" : ""}>
                <p className="text-3xl font-bold">{tile.value}</p>
                <p className="text-muted">{tile.label}</p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
      <PilotChecklist myAccountId={viewer.accountId} />
    </>
  );
}
