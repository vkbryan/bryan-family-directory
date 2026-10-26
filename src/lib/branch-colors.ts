// One color per family branch, so you can tell at a glance who's from which
// branch. Soft background with dark text (light text on a deep background in
// dark mode); each pair meets WCAG AA contrast. The name is always shown too,
// so color is never the only cue.
//
// Written out in full so Tailwind includes every class.
const BRANCH_COLORS = [
  "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
  "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  "bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200",
  "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
  "bg-pink-100 text-pink-900 dark:bg-pink-950 dark:text-pink-200",
  "bg-lime-100 text-lime-900 dark:bg-lime-950 dark:text-lime-200",
  "bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200",
  "bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-950 dark:text-fuchsia-200",
  "bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200",
  "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
];

/** Classes for a branch label. `color` is the branch's place in the order branches were added. */
export function branchColorClass(color: number | undefined) {
  return BRANCH_COLORS[(color ?? 0) % BRANCH_COLORS.length];
}
