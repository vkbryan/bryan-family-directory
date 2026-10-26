import Link from "next/link";
import type { Person } from "@/lib/directory-logic";
import { Avatar } from "./avatar";
import { ButtonLink } from "./ui";

/** What's still missing from someone's own profile, as friendly suggestions. */
export function missingSuggestions(me: Person) {
  const suggestions: string[] = [];
  if (!me.photoUrl) suggestions.push("Add a photo");
  if (!me.birthMonth) suggestions.push("Add your birthday");
  if (!me.city && !me.state) suggestions.push("Add where you live");
  if (me.hobbies.length === 0) suggestions.push("Add your interests");
  if (!me.contactEmail && !me.phone) suggestions.push("Add a way to reach you");
  return suggestions;
}

/** Top of the home page: your own profile, one tap from editing it. */
export function YourProfileCard({ me }: { me: Person }) {
  const suggestions = missingSuggestions(me);
  return (
    <section
      aria-labelledby="your-profile-heading"
      className="flex flex-col gap-4 rounded-xl border-2 border-gold bg-surface p-4 sm:flex-row sm:items-center sm:p-5"
    >
      <div className="flex items-center gap-4">
        <Avatar name={me.fullName} photoUrl={me.photoUrl} />
        <div className="flex flex-col">
          <h2 id="your-profile-heading" className="text-sm font-medium text-muted">
            Your profile
          </h2>
          <p className="text-lg font-semibold leading-snug">{me.fullName}</p>
          <Link href={`/people/${me.id}`} className="text-sm">
            See it the way relatives do
          </Link>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 sm:items-end">
        {suggestions.length > 0 && (
          <p className="text-sm sm:text-right">
            <span className="font-medium">Next:</span> {suggestions.slice(0, 3).join(" · ")}
          </p>
        )}
        <ButtonLink href={`/people/${me.id}/edit`}>Edit your profile</ButtonLink>
      </div>
    </section>
  );
}
