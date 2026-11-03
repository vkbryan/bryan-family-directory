import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getViewer } from "@/lib/auth";
import { getBranchNames, getDirectory } from "@/lib/directory";
import { filterPeople, hasFilters, readFilters, tally, type Filters } from "@/lib/directory-logic";
import { PersonCard } from "@/components/person-card";
import { Card, Loading } from "@/components/ui";
import { DirectoryFilters } from "./directory-filters";

export const metadata = { title: "Family · Bryan Family Directory" };

/** The whole family: search and filters at the top, every tile below. */
export default function FamilyPage({ searchParams }: PageProps<"/family">) {
  return (
    <Suspense fallback={<Loading />}>
      <Family searchParams={searchParams} />
    </Suspense>
  );
}

async function Family({ searchParams }: { searchParams: PageProps<"/family">["searchParams"] }) {
  const viewer = await getViewer();
  if (viewer.state !== "member") redirect("/");

  const filters = readFilters(await searchParams);
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

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold">Family</h1>

      <DirectoryFilters
        key={JSON.stringify(filters)}
        filters={filters}
        branches={allBranches.map((b) => ({ value: b.slug, label: b.name }))}
        states={states.map((s) => ({ value: s, label: s }))}
        cities={cities.map((c) => ({ value: c, label: c }))}
        hobbies={hobbies.map((h) => ({ value: h.slug, label: h.name }))}
      />

      <section aria-labelledby="results-heading" className="flex flex-col gap-4">
        {/* Screen readers still hear a heading when nothing is filtered. */}
        <h2 id="results-heading" className={filtering ? "text-xl font-semibold" : "sr-only"} aria-live="polite">
          {filtering ? resultsLabel(results.length, filters, allBranches) : "All family members"}
        </h2>
        {results.length === 0 ? (
          <Card>
            <p>
              Nobody matches yet. Try fewer filters, or <Link href="/family">see everyone</Link>.
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
    </div>
  );
}

function resultsLabel(count: number, filters: Filters, branches: { slug: string; name: string }[]) {
  const branch = branches.find((b) => b.slug === filters.branch)?.name;
  const base = `${count} ${count === 1 ? "match" : "matches"}`;
  return branch ? `${base} in ${branch}` : base;
}
