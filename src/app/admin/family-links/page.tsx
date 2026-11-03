import Link from "next/link";
import { Suspense } from "react";
import { requireAdminViewer } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { bySection, iconFor, LINK_COLUMNS, type FamilyLink } from "@/lib/family-links";
import { Card, Loading } from "@/components/ui";
import { ConfirmButton } from "../confirm-button";
import { deleteLink, moveLink, setLinkHidden } from "./actions";
import { LinkForm } from "./link-form";

export const metadata = { title: "Family links · Admin" };

export default function FamilyLinksPage() {
  return (
    <>
      <h1 className="text-3xl font-bold">Family links</h1>
      <p className="text-muted">
        The links on the <Link href="/family">Family page</Link>: the WhatsApp chat, photos, family tree and anything else
        the family shares. Only signed-in members see them. Changes show right away.
      </p>
      <Suspense fallback={<Loading />}>
        <FamilyLinksContent />
      </Suspense>
    </>
  );
}

async function FamilyLinksContent() {
  await requireAdminViewer();
  const supabase = await createClient();
  const { data } = await supabase.from("family_links").select(LINK_COLUMNS).order("sort_order").order("created_at");
  const sections = bySection((data ?? []) as FamilyLink[]);

  return (
    <>
      <Card className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Add a link</h2>
        <LinkForm />
      </Card>

      {sections.map((section) => (
        <section key={section.value} className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">{section.label}</h2>
          <ul className="flex flex-col gap-3">
            {section.links.map((link, index) => (
              <li key={link.id}>
                <Card className={`flex flex-col gap-3 ${link.hidden ? "opacity-70" : ""}`}>
                  <div className="flex items-start gap-3">
                    <span aria-hidden="true" className="text-2xl">
                      {iconFor(link.icon)}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <p className="text-lg font-semibold leading-snug">
                        {link.title}
                        {link.hidden && <span className="ml-2 text-sm font-medium text-muted">(hidden)</span>}
                      </p>
                      {link.note && <p className="text-sm text-muted">{link.note}</p>}
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="break-all text-sm">
                        {link.url.replace(/^mailto:/, "")}
                      </a>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {index > 0 && <ConfirmButton label="Move up" action={moveLink.bind(null, link.id, "up")} />}
                    {index < section.links.length - 1 && (
                      <ConfirmButton label="Move down" action={moveLink.bind(null, link.id, "down")} />
                    )}
                    <ConfirmButton
                      label={link.hidden ? "Show" : "Hide"}
                      action={setLinkHidden.bind(null, link.id, !link.hidden)}
                    />
                    <ConfirmButton
                      label="Delete"
                      confirmText={`Delete "${link.title}"? To keep it for later, choose Hide instead.`}
                      action={deleteLink.bind(null, link.id)}
                    />
                  </div>
                  <details>
                    <summary className="min-h-11 cursor-pointer py-2 font-medium text-accent">Edit this link</summary>
                    <div className="pt-3">
                      <LinkForm link={link} />
                    </div>
                  </details>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
