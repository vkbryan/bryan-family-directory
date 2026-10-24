import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { getViewer } from "@/lib/auth";
import { getDirectory } from "@/lib/directory";
import {
  birthdayLabel,
  filterHref,
  instagramHref,
  phoneHref,
  placeLabel,
  readFilters,
  websiteHref,
} from "@/lib/directory-logic";
import { Avatar } from "@/components/avatar";
import { ButtonLink, Card, Loading } from "@/components/ui";

export const metadata = { title: "Profile · Bryan Family Directory" };

export default function PersonPage({ params }: PageProps<"/people/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <p>
        <Link href="/">← Back to the directory</Link>
      </p>
      <Suspense fallback={<Loading />}>
        <PersonContent params={params} />
      </Suspense>
    </div>
  );
}

const noFilters = readFilters({});

async function PersonContent({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, viewer] = await Promise.all([params, getViewer()]);
  if (viewer.state !== "member") redirect("/");

  // Only people this viewer may see are in the directory, so anyone else is "not found".
  const person = (await getDirectory()).find((p) => p.id === id);
  if (!person) notFound();

  const place = placeLabel(person);
  const birthday = birthdayLabel(person);
  const website = person.website ? websiteHref(person.website) : null;
  const phone = person.phone ? phoneHref(person.phone) : null;
  const contact = [
    person.contactEmail && { label: "Email", text: person.contactEmail, href: `mailto:${person.contactEmail}` },
    person.phone && { label: "Phone", text: person.phone, href: phone },
    person.instagram && { label: "Instagram", text: `@${person.instagram}`, href: instagramHref(person.instagram) },
    person.linkedin && { label: "LinkedIn", text: "LinkedIn profile", href: websiteHref(person.linkedin) },
    person.website && { label: "Website", text: person.website.replace(/^https?:\/\//, "").replace(/\/$/, ""), href: website },
  ].filter(Boolean) as { label: string; text: string; href: string | null }[];

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
        <Avatar name={person.fullName} photoUrl={person.photoUrl} size="lg" />
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold">{person.fullName}</h1>
          {person.aka && <p className="text-xl text-muted">&ldquo;{person.aka}&rdquo;</p>}
          {place && (
            <p className="text-lg">
              <Link href={filterHref(noFilters, { state: person.state ?? "", city: person.city ?? "" })}>{place}</Link>
            </p>
          )}
          {person.isMe && <p className="text-muted">This is you</p>}
        </div>
      </header>

      {!person.isClaimed && !person.isChild && (
        <Card>
          <p>
            {person.fullName.split(" ")[0]} hasn&apos;t joined the directory yet, so this information came from the
            original family list.
          </p>
        </Card>
      )}

      <Details>
        {person.branches.length > 0 && (
          <Detail label={person.branches.length > 1 ? "Family branches" : "Family branch"}>
            <ul className="flex flex-wrap gap-2">
              {person.branches.map((b) => (
                <li key={b.slug}>
                  <Link href={filterHref(noFilters, { branch: b.slug })}>{b.name}</Link>
                </li>
              ))}
            </ul>
          </Detail>
        )}
        {birthday && <Detail label="Birthday">{birthday}</Detail>}
        {person.hobbies.length > 0 && (
          <Detail label="Interests">
            <ul className="flex flex-wrap gap-2">
              {person.hobbies.map((h) => (
                <li key={h.slug}>
                  <Link
                    href={filterHref(noFilters, { hobby: h.slug })}
                    className="inline-flex min-h-11 items-center rounded-full border border-border bg-background px-4 py-2 text-foreground no-underline hover:border-accent"
                  >
                    {h.name}
                  </Link>
                </li>
              ))}
            </ul>
          </Detail>
        )}
      </Details>

      {contact.length > 0 && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Contact</h2>
          <dl className="flex flex-col gap-3">
            {contact.map((c) => (
              <div key={c.label} className="flex flex-col">
                <dt className="text-sm text-muted">{c.label}</dt>
                <dd className="break-words text-lg">
                  {c.href ? (
                    <a href={c.href} rel="noopener noreferrer" target={c.href.startsWith("http") ? "_blank" : undefined}>
                      {c.text}
                    </a>
                  ) : (
                    c.text
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {person.isChild && (
        <p className="text-muted">Children&apos;s profiles never show contact details, and their birthday stays private.</p>
      )}

      {viewer.isAdmin && !person.isClaimed && !person.isChild && (
        <div>
          <ButtonLink href="/admin/claims" variant="secondary">
            Make a claim link
          </ButtonLink>
        </div>
      )}
    </article>
  );
}

function Details({ children }: { children: ReactNode }) {
  return (
    <Card>
      <dl className="flex flex-col gap-5">{children}</dl>
    </Card>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-lg">{children}</dd>
    </div>
  );
}
