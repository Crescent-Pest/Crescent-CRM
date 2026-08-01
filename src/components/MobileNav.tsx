"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavActive, mobileNav } from "./nav";

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t-2 border-gold/60 bg-denim-ink pb-[env(safe-area-inset-bottom)] md:hidden">
      {mobileNav.map(({ href, label, icon: Icon }) => {
        const active = isNavActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 font-display text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors ${
              active ? "text-gold" : "text-white/70"
            }`}
          >
            <Icon size={20} strokeWidth={2.2} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
