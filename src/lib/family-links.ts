// Sections and icons for the Info page (/info). The database accepts only these.

export const SECTIONS = [
  { value: "stay_in_touch", label: "Stay in touch" },
  { value: "history", label: "Our history" },
  { value: "photos", label: "Photos" },
  { value: "get_involved", label: "Get involved" },
  { value: "past_events", label: "Past events" },
] as const;

export const ICONS = [
  { value: "link", emoji: "🔗", label: "Link" },
  { value: "chat", emoji: "💬", label: "Chat" },
  { value: "email", emoji: "✉️", label: "Email" },
  { value: "tree", emoji: "🌳", label: "Family tree" },
  { value: "photos", emoji: "📸", label: "Photos" },
  { value: "calendar", emoji: "📅", label: "Calendar" },
  { value: "video", emoji: "🎥", label: "Video call" },
  { value: "document", emoji: "📝", label: "Document" },
  { value: "form", emoji: "📋", label: "Form" },
  { value: "money", emoji: "💵", label: "Payment" },
  { value: "beach", emoji: "🏝️", label: "Trip" },
] as const;

export type FamilyLink = {
  id: string;
  section: string;
  title: string;
  url: string;
  note: string | null;
  icon: string;
  sort_order: number;
  hidden: boolean;
};

export const LINK_COLUMNS = "id, section, title, url, note, icon, sort_order, hidden";

export const iconFor = (icon: string) => ICONS.find((i) => i.value === icon)?.emoji ?? "🔗";

/** Links grouped by section, in section order, skipping empty sections. */
export function bySection<T extends { section: string }>(links: T[]) {
  return SECTIONS.map((s) => ({ ...s, links: links.filter((l) => l.section === s.value) })).filter((s) => s.links.length > 0);
}

/** Accepts "https://…" and "mailto:…"; adds https:// to a bare address and mailto: to an email. */
export function normalizeUrl(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (/^https:\/\//i.test(value) || /^mailto:/i.test(value)) return value;
  if (/^http:\/\//i.test(value)) return value.replace(/^http:/i, "https:");
  if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(value)) return `mailto:${value}`;
  if (/^[^\s]+\.[^\s]+/.test(value)) return `https://${value}`;
  return null;
}
