import { Suspense } from "react";
import { formatDate, requireAdminViewer } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { Card, Loading } from "@/components/ui";

export const metadata = { title: "Contact list · Admin" };

export default function ContactListPage() {
  return (
    <>
      <h1 className="text-3xl font-bold">Contact list</h1>
      <Suspense fallback={<Loading />}>
        <ContactListContent />
      </Suspense>
    </>
  );
}

async function ContactListContent() {
  await requireAdminViewer();
  const supabase = await createClient();
  const { data: contacts } = await supabase.rpc("admin_contact_list");
  const list = contacts ?? [];

  return (
    <section className="flex flex-col gap-4">
      <p className="text-muted">
        Members who said yes to &ldquo;Send me news about family events.&rdquo; Members are asked once on the home page
        and can change their answer on their profile. Deactivated members are left out.
      </p>
      {list.length > 0 && (
        <a
          href="/admin/contact-list/download"
          download
          className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-accent px-5 py-3 font-semibold text-accent-foreground no-underline hover:bg-accent-hover sm:w-auto sm:self-start"
        >
          Download the list ({list.length})
        </a>
      )}
      <p className="text-sm text-muted">
        The download is a spreadsheet file (CSV) for Excel or Google Sheets. It holds family email addresses: keep it
        private, and don&apos;t share it in public places.
      </p>
      {list.length === 0 ? (
        <Card>
          <p>Nobody has said yes yet.</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((c) => (
            <li key={c.email}>
              <Card className="flex flex-col gap-1">
                <p className="text-lg font-semibold">{c.full_name ?? "No profile yet"}</p>
                <p className="break-all">{c.email}</p>
                <p className="text-sm text-muted">
                  {[c.branch, [c.city, c.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                  {c.branch || c.city || c.state ? " · " : ""}said yes {formatDate(c.answered_at)}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
