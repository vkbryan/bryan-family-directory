// One spelling per place, so "NY", "ny" and "New York" don't become separate
// filters. Used by the State dropdowns and to tidy anything typed by hand.

export const US_STATES: [code: string, name: string][] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"],
  ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"],
  ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"],
  ["PA", "Pennsylvania"], ["PR", "Puerto Rico"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"],
  ["VA", "Virginia"], ["VI", "U.S. Virgin Islands"], ["WA", "Washington"], ["WV", "West Virginia"],
  ["WI", "Wisconsin"], ["WY", "Wyoming"],
];

/** Shown after the states, for relatives living abroad. */
export const OUTSIDE_US = ["Jamaica", "Canada", "United Kingdom", "Another country"];

const lookup = new Map<string, string>();
for (const [code, name] of US_STATES) {
  lookup.set(code.toLowerCase(), name);
  lookup.set(name.toLowerCase(), name);
}
for (const place of OUTSIDE_US) lookup.set(place.toLowerCase(), place);
// Common ways people write these by hand.
for (const [typed, name] of [
  ["washington dc", "District of Columbia"], ["washington d.c.", "District of Columbia"], ["d.c.", "District of Columbia"],
  ["uk", "United Kingdom"], ["england", "United Kingdom"], ["great britain", "United Kingdom"],
  ["ja", "Jamaica"], ["jm", "Jamaica"],
] as const) {
  lookup.set(typed, name);
}

/**
 * "NY", " new york ", "N.Y." -> "New York". Unknown values are kept as typed
 * (tidied), so nothing is lost; empty -> null.
 */
export function normalizeState(value: string | null | undefined): string | null {
  const tidied = (value ?? "").replace(/\s+/g, " ").trim();
  if (!tidied) return null;
  const key = tidied.toLowerCase();
  return lookup.get(key) ?? lookup.get(key.replace(/\./g, "")) ?? tidied;
}

/** Every option in dropdown order, so a stored value is always selectable. */
export function isKnownPlace(value: string) {
  return lookup.get(value.toLowerCase()) === value;
}
