import Link from "next/link";

const links = [
  { href: "/admin", label: "Admin home" },
  { href: "/admin/group-link", label: "Group link" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/contact-list", label: "Contact list" },
  { href: "/admin/requests", label: "Requests" },
  { href: "/admin/claims", label: "Claim links" },
  { href: "/admin/branches", label: "Branches" },
  { href: "/admin/activity", label: "Activity" },
];

export function AdminNav() {
  return (
    <nav aria-label="Admin" className="flex flex-wrap gap-x-4 gap-y-2 border-b border-border pb-4">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="min-h-11 py-2">
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
