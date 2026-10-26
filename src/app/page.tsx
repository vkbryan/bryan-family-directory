import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { getViewer, greetingName } from "@/lib/auth";
import { getBranchNames, getDirectory } from "@/lib/directory";
import {
  filterHref,
  filterPeople,
  hasFilters,
  readFilters,
  tally,
  upcomingBirthdays,
  whenLabel,
  type Filters,
} from "@/lib/directory-logic";
import { Avatar } from "@/components/avatar";
import { PersonCard } from "@/components/person-card";
import { YourProfileCard } from "@/components/your-profile-card";
import { Button, ButtonLink, Card, Loading } from "@/components/ui";
import { DirectoryFilters } from "./directory-filters";
import { signOut } from "./actions";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<Loading />}>
      <HomeContent searchParams={searchParams} />
    </Suspense>
  );
}

async function HomeContent({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
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
      return (
        <Directory
          name={greetingName(viewer.profile)}
          isAdmin={viewer.isAdmin}
          filters={readFilters(await searchParams)}
        />
      );
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

function StatusCard({ title, children }: { title: string; children: ReactNode }) {
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

async function Directory({ name, isAdmin, filters }: { name: string; isAdmin: boolean; filters: Filters }) {
  const [everyone, allBranches] = await Promise.all([getDirectory(), getBranchNames()]);
  const results = filterPeople(everyone, filters);
  const filtering = hasFilters(filters);

  // Options for the filters, from what this viewer can see.
  const states = [...new Set(everyone.map((p) => p.state).filter(Boolean))].sort() as string[];
  const cities = [
    ...new Set(
      everyone.filter((p) => p.city && (!filters.state || p.state === filters.state)).map((p) => p.city),
    ),
  ].sort() as string[];
  const hobbies = tally(everyone.flatMap((p) => p.hobbies));
  const branches = tally(everyone.flatMap((p) => p.branches));
  const places = tally(everyone.filter((p) => p.state).map((p) => ({ slug: p.state!, name: p.state! })));
  const birthdays = upcomingBirthdays(everyone, new Date());
  const me = everyone.find((p) => p.isMe);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">Hi, {name}</h1>
        <p className="text-muted">
          {everyone.length} family {everyone.length === 1 ? "member" : "members"} in the directory
        </p>
      </div>

      {me && <YourProfileCard me={me} />}

      <DirectoryFilters
        key={JSON.stringify(filters)}
        filters={filters}
        branches={allBranches.map((b) => ({ value: b.slug, label: b.name }))}
        states={states.map((s) => ({ value: s, label: s }))}
        cities={cities.map((c) => ({ value: c, label: c }))}
        hobbies={hobbies.map((h) => ({ value: h.slug, label: h.name }))}
      />

      {!filtering && (
        <>
          {birthdays.length > 0 && (
            <Section title="Birthdays in the next 30 days">
              <ul className="grid gap-3 sm:grid-cols-2">
                {birthdays.map(({ person, daysAway, turning }) => (
                  <li key={person.id}>
                    <Link
                      href={`/people/${person.id}`}
                      className="flex items-center gap-3 rounded-xl bg-gold-soft p-3 text-gold-text no-underline"
                    >
                      <Avatar name={person.fullName} photoUrl={person.photoUrl} size="sm" />
                      <span>
                        <span className="font-semibold">{person.aka || person.fullName}</span>
                        <span className="block text-sm">
                          {whenLabel(daysAway)}
                          {turning !== null && !person.isChild ? ` · turning ${turning}` : ""}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <Section title="Browse by family branch">
            <ChipList items={branches} href={(slug) => filterHref(filters, { branch: slug })} />
          </Section>
          {hobbies.length > 0 && (
            <Section title="Shared interests">
              <ChipList items={hobbies} href={(slug) => filterHref(filters, { hobby: slug })} />
            </Section>
          )}
          {places.length > 0 && (
            <Section title="Where we live">
              <ChipList items={places} href={(state) => filterHref(filters, { state })} />
            </Section>
          )}
        </>
      )}

      <section aria-labelledby="results-heading" className="flex flex-col gap-4">
        <h2 id="results-heading" className="text-xl font-semibold" aria-live="polite">
          {filtering ? resultsLabel(results.length, filters, allBranches) : "Everyone"}
        </h2>
        {results.length === 0 ? (
          <Card>
            <p>
              Nobody matches yet. Try fewer filters, or <Link href="/">see everyone</Link>.
            </p>
          </Card>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {results.map((person) => (
              <li key={person.id}>
                <PersonCard person={person} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:flex-wrap">
        <ButtonLink href="/invitations">Invite a relative</ButtonLink>
        {isAdmin && (
          <ButtonLink href="/admin" variant="secondary">
            Admin
          </ButtonLink>
        )}
        <form action={signOut}>
          <Button variant="secondary">Sign out</Button>
        </form>
      </div>
    </div>
  );
}

function resultsLabel(count: number, filters: Filters, branches: { slug: string; name: string }[]) {
  const branch = branches.find((b) => b.slug === filters.branch)?.name;
  const base = `${count} ${count === 1 ? "match" : "matches"}`;
  return branch ? `${base} in ${branch}` : base;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function ChipList({ items, href }: { items: { slug: string; name: string; count: number }[]; href: (slug: string) => string }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item.slug}>
          <Link
            href={href(item.slug)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-green-soft px-4 py-2 font-medium text-green-text no-underline hover:outline hover:outline-2 hover:outline-accent"
          >
            {item.name}
            <span className="text-sm">{item.count}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
