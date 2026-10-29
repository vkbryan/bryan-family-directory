import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { getViewer, greetingName } from "@/lib/auth";
import { getBranchNames, getDirectory } from "@/lib/directory";
import { filterHref, hasFilters, newestFirst, readFilters, tally, upcomingBirthdays, whenLabel } from "@/lib/directory-logic";
import { Avatar } from "@/components/avatar";
import { PersonCard } from "@/components/person-card";
import { YourProfileCard } from "@/components/your-profile-card";
import { branchColorClass } from "@/lib/branch-colors";
import { Button, ButtonLink, Card, Loading } from "@/components/ui";
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
    case "member": {
      // Searches used to live here; old links now open the Everyone page.
      const params = await searchParams;
      if (hasFilters(readFilters(params))) redirect(`/everyone?${new URLSearchParams(params as Record<string, string>)}`);
      return <Directory name={greetingName(viewer.profile)} />;
    }
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

const NEWEST_COUNT = 12;

async function Directory({ name }: { name: string }) {
  const [everyone, allBranches] = await Promise.all([getDirectory(), getBranchNames()]);
  const branches = tally(everyone.flatMap((p) => p.branches));
  const places = tally(everyone.filter((p) => p.state).map((p) => ({ slug: p.state!, name: p.state! })));
  const birthdays = upcomingBirthdays(everyone, new Date());
  const me = everyone.find((p) => p.isMe);
  const newest = newestFirst(everyone, NEWEST_COUNT);
  const noFilters = readFilters({});

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">Hi, {name}</h1>
        <p className="text-muted">
          {everyone.length} family {everyone.length === 1 ? "member" : "members"} in the directory
        </p>
      </div>

      {me && <YourProfileCard me={me} />}

      <Form action="/everyone" className="flex flex-col gap-1.5" role="search">
        <label htmlFor="q" className="sr-only">
          Search by name or nickname
        </label>
        <div className="flex gap-2">
          <input
            id="q"
            name="q"
            type="search"
            placeholder="Name or nickname"
            autoComplete="off"
            className="min-h-12 min-w-0 flex-1 rounded-lg border border-border bg-surface px-4 py-3 text-base text-foreground placeholder:text-muted"
          />
          <Button type="submit" className="!w-auto">
            Search
          </Button>
        </div>
      </Form>

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
        <ChipList
          items={branches}
          href={(slug) => filterHref(noFilters, { branch: slug })}
          colorFor={(slug) => branchColorClass(allBranches.find((b) => b.slug === slug)?.color)}
        />
      </Section>
      {places.length > 0 && (
        <Section title="Where we live">
          <ChipList items={places} href={(state) => filterHref(noFilters, { state })} />
        </Section>
      )}

      <section aria-labelledby="newest-heading" className="flex flex-col gap-4">
        <h2 id="newest-heading" className="text-xl font-semibold">
          <Link href="/everyone">Everyone ›</Link>
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {newest.map((person) => (
            <li key={person.id}>
              <PersonCard person={person} />
            </li>
          ))}
        </ul>
        {everyone.length > newest.length && (
          <ButtonLink href="/everyone" variant="secondary">
            See all {everyone.length}
          </ButtonLink>
        )}
      </section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function ChipList({
  items,
  href,
  colorFor,
}: {
  items: { slug: string; name: string; count: number }[];
  href: (slug: string) => string;
  colorFor?: (slug: string) => string;
}) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item.slug}>
          <Link
            href={href(item.slug)}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 font-medium no-underline hover:outline hover:outline-2 hover:outline-accent ${colorFor ? colorFor(item.slug) : "bg-green-soft text-green-text"}`}
          >
            {item.name}
            <span className="text-sm">{item.count}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
