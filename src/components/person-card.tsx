import Link from "next/link";
import type { Person } from "@/lib/directory-logic";
import { Avatar } from "./avatar";

/** One family member in the grid of faces. The whole card opens their profile. */
export function PersonCard({ person }: { person: Person }) {
  const note = person.isMe ? "This is you" : person.isChild ? "Child" : !person.isClaimed ? "Hasn't joined yet" : null;
  return (
    <Link
      href={`/people/${person.id}`}
      className="flex h-full flex-col items-center gap-1 rounded-xl border border-border bg-surface p-4 text-center text-foreground no-underline transition-colors hover:border-accent"
    >
      <Avatar name={person.fullName} photoUrl={person.photoUrl} />
      <p className="mt-2 font-semibold leading-snug">{person.fullName}</p>
      {person.aka && <p className="text-sm text-muted">&ldquo;{person.aka}&rdquo;</p>}
      {person.city && <p className="text-sm">{person.city}</p>}
      {note && <p className="text-sm text-muted">{note}</p>}
    </Link>
  );
}
