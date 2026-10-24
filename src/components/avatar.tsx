import { initials } from "@/lib/directory-logic";

const sizes = {
  md: "h-16 w-16 text-xl",
  lg: "h-36 w-36 text-4xl sm:h-44 sm:w-44",
};

/** A round photo, or the person's initials when there's no photo they may see. */
export function Avatar({ name, photoUrl, size = "md" }: { name: string; photoUrl: string | null; size?: keyof typeof sizes }) {
  if (photoUrl) {
    return (
      // A plain <img>: photo links are private and expire within the hour, so
      // they must not be cached by Next.js's image optimizer.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={`Photo of ${name}`}
        className={`${sizes[size]} shrink-0 rounded-full border border-border bg-background object-cover`}
        loading="lazy"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${sizes[size]} flex shrink-0 items-center justify-center rounded-full border border-border bg-background font-semibold text-muted`}
    >
      {initials(name)}
    </span>
  );
}
