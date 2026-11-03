import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { bySection, iconFor, LINK_COLUMNS, type FamilyLink } from "@/lib/family-links";
import { Card, Loading } from "@/components/ui";

export const metadata = { title: "Info · Bryan Family Directory" };

/** The family's shared places: WhatsApp chat, photos, family tree, planning docs. Members only. */
export default function InfoPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Info />
    </Suspense>
  );
}

async function Info() {
  const viewer = await getViewer();
  if (viewer.state !== "member") redirect("/");

  const supabase = await createClient();
  const { data } = await supabase
    .from("family_links")
    .select(LINK_COLUMNS)
    .eq("hidden", false)
    .order("sort_order")
    .order("created_at");
  const sections = bySection((data ?? []) as FamilyLink[]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">Info</h1>
        <p className="text-muted">Everything Bryan, in one place. Only signed-in family can see these links.</p>
      </div>

      {sections.length === 0 ? (
        <Card>
          <p>Links are on their way. {viewer.isAdmin ? "Add them under Admin → Family links." : "Check back soon."}</p>
        </Card>
      ) : (
        sections.map((section) => (
          <section key={section.value} aria-labelledby={`section-${section.value}`} className="flex flex-col gap-3">
            <h2 id={`section-${section.value}`} className="text-xl font-semibold">
              {section.label}
            </h2>
            <ul className="flex flex-col gap-3">
              {section.links.map((link) => (
                <li key={link.id}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-16 items-center gap-4 rounded-xl border border-border bg-surface p-4 text-foreground no-underline hover:border-accent"
                  >
                    <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gold-soft text-2xl">
                      {iconFor(link.icon)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-lg font-semibold leading-snug">{link.title}</span>
                      {link.note && <span className="text-sm text-muted">{link.note}</span>}
                    </span>
                    <span aria-hidden="true" className="text-xl text-accent">
                      ›
                    </span>
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
