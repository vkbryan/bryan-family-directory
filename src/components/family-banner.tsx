import Link from "next/link";

/** The Jamaican flag, drawn small for the banner. */
function JamaicanFlag() {
  return (
    <svg width="48" height="24" viewBox="0 0 48 24" role="img" aria-label="Flag of Jamaica" className="shrink-0 rounded-sm">
      <rect width="48" height="24" fill="#009B3A" />
      <polygon points="0,0 24,12 0,24" fill="#000000" />
      <polygon points="48,0 24,12 48,24" fill="#000000" />
      <line x1="0" y1="0" x2="48" y2="24" stroke="#FED100" strokeWidth="4" />
      <line x1="48" y1="0" x2="0" y2="24" stroke="#FED100" strokeWidth="4" />
    </svg>
  );
}

/** Top of every page: motto, family name and flag, with a green, gold and black stripe. */
export function FamilyBanner() {
  return (
    <header>
      <div className="bg-banner text-banner-foreground">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="flex flex-col text-banner-foreground no-underline">
            <span className="text-sm text-gold">Out of many, one people</span>
            <span className="text-2xl font-semibold leading-tight">The Bryan Family</span>
          </Link>
          <JamaicanFlag />
        </div>
      </div>
      <div className="flex h-1.5" aria-hidden="true">
        <div className="flex-1 bg-flag-green" />
        <div className="flex-1 bg-gold" />
        <div className="flex-1 bg-banner" />
      </div>
    </header>
  );
}
