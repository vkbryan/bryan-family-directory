import Link from "next/link";
import { placeLabel, type Person } from "@/lib/directory-logic";
import { Avatar } from "./avatar";

/** One family member in the directory list. The whole card opens their profile. */
export function PersonCard({ person }: { person: Person }) {
  const place = placeLabel(person);
  return (
    <Link
      href={`/people/${person.id}`}
      className="flex items-start gap-4 rounded-xl border border-border bg-surface p-4 text-foreground no-underline transition-colors hover:border-accent"
    >
      <Avatar name={person.fullName} photoUrl={person.photoUrl} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-lg font-semibold leading-snug">
          {person.fullName}
          {person.aka && <span className="font-normal text-muted"> ({person.aka})</span>}
        </p>
        {person.primaryBranch && <p className="text-sm text-muted">{person.primaryBranch}</p>}
        {place && <p className="text-sm">{place}</p>}
        {person.hobbies.length > 0 && (
          <p className="text-sm text-muted">{person.hobbies.slice(0, 3).map((h) => h.name).join(" · ")}</p>
        )}
        <p className="text-sm text-muted">
          {person.isMe ? "This is you" : person.isChild ? "Child" : !person.isClaimed ? "Hasn't joined yet" : null}
        </p>
      </div>
    </Link>
  );
}
