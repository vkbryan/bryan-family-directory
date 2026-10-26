import { initials } from "@/lib/directory-logic";

const sizes = {
  sm: "h-12 w-12 text-base",
  md: "h-20 w-20 text-2xl",
  lg: "h-36 w-36 text-4xl sm:h-44 sm:w-44",
};

/** A round photo with a gold ring, or the person's initials when there's no photo they may see. */
export function Avatar({ name, photoUrl, size = "md" }: { name: string; photoUrl: string | null; size?: keyof typeof sizes }) {
  const ring = "shrink-0 rounded-full border-[3px] border-gold";
  if (photoUrl) {
    return (
      // A plain <img>: photo links are private and expire within the hour, so
      // they must not be cached by Next.js's image optimizer.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoUrl} alt={`Photo of ${name}`} className={`${sizes[size]} ${ring} bg-background object-cover`} loading="lazy" />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${sizes[size]} ${ring} flex items-center justify-center bg-green-soft font-semibold text-green-text`}
    >
      {initials(name)}
    </span>
  );
}
