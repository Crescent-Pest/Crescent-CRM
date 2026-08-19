"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isNavActive, mobileNav } from "./nav";

export function MobileNav() {
  const pathname = usePathname();
  const [openCount, setOpenCount] = useState(0);
  const [hasOverdue, setHasOverdue] = useState(false);

  // Refresh the follow-up badge on every tab change. Errors just leave the
  // badge hidden.
  useEffect(() => {
    let cancelled = false;
    async function loadBadge() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user.id;
      if (!userId) return;
      const { data } = await supabase
        .from("action_items")
        .select("due_date")
        .eq("tech_id", userId)
        .eq("status", "open")
        .limit(100);
      if (cancelled || !data) return;
      const today = new Date().toLocaleDateString("en-CA");
      setOpenCount(data.length);
      setHasOverdue(data.some((r) => r.due_date !== null && r.due_date < today));
    }
    void loadBadge();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t-2 border-gold/60 bg-denim-ink pb-[env(safe-area-inset-bottom)] md:hidden">
      {mobileNav.map(({ href, label, icon: Icon, badge }) => {
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
            <span className="relative">
              <Icon size={20} strokeWidth={2.2} />
              {badge && openCount > 0 && (
                <span
                  aria-label={`${openCount} open follow-ups`}
                  className={`absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-sans text-[10px] font-bold leading-none ${
                    hasOverdue ? "bg-danger text-white" : "bg-gold text-denim-ink"
                  }`}
                >
                  {openCount > 9 ? "9+" : openCount}
                </span>
              )}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
