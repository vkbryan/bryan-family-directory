"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions";

const link = "inline-flex min-h-11 items-center border-b-2 font-medium no-underline";

/**
 * Home, Everyone, Family, Me (your profile), Invite (as a gold pill) and, for admins, Admin; Sign out
 * sits apart on the right. The page you're on is underlined.
 */
export function NavLinks({ myProfileId, isAdmin }: { myProfileId: string; isAdmin: boolean }) {
  const path = usePathname();
  const myProfile = `/people/${myProfileId}`;
  const items = [
    { href: "/", label: "Home", current: path === "/" },
    { href: "/everyone", label: "Everyone", current: path === "/everyone" },
    { href: "/family", label: "Family", current: path === "/family" },
    { href: myProfile, label: "Me", current: path === myProfile || path.startsWith(`${myProfile}/`) || path === "/children/new" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", current: path.startsWith("/admin") }] : []),
  ];

  return (
    <nav aria-label="Main" className="border-b border-border">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-3 px-4 sm:gap-x-6">
        {items.slice(0, 4).map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
        <Link
          href="/invitations"
          aria-current={path === "/invitations" ? "page" : undefined}
          className={`inline-flex min-h-9 items-center rounded-full bg-gold-soft px-2.5 font-semibold sm:px-3 text-gold-text no-underline hover:outline hover:outline-2 hover:outline-accent ${path === "/invitations" ? "outline outline-2 outline-gold" : ""}`}
        >
          + Invite
        </Link>
        {items.slice(4).map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
        <form action={signOut} className="ml-auto">
          <button type="submit" className="min-h-11 text-sm text-muted underline-offset-4 hover:underline">
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}

function NavLink({ href, label, current }: { href: string; label: string; current: boolean }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`${link} ${current ? "border-accent text-foreground" : "border-transparent text-accent hover:border-border"}`}
    >
      {label}
    </Link>
  );
}
