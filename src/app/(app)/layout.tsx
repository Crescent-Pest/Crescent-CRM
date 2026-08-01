import Link from "next/link";
import { LayoutDashboard, Users, CalendarDays, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { CrescentMark, Wordmark } from "@/components/brand";
import type { Profile } from "@/lib/types";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r-2 border-gold/60 bg-denim-ink text-white">
        <div className="flex items-center gap-2.5 px-4 py-5">
          <CrescentMark size={30} />
          <Wordmark light />
        </div>

        <nav className="mt-2 flex-1 space-y-1 px-3">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-md px-3 py-2 font-display text-sm font-semibold uppercase tracking-[0.08em] text-white/80 transition-colors hover:bg-white/10 hover:text-gold"
            >
              <Icon size={17} strokeWidth={2.2} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <p className="truncate text-sm font-semibold">
            {profile?.full_name || "Staff"}
          </p>
          <p className="font-display text-[11px] uppercase tracking-[0.2em] text-gold">
            {profile?.role ?? "office"}
          </p>
          <form action={signOut} className="mt-3">
            <button
              type="submit"
              className="flex items-center gap-2 text-xs text-white/60 transition-colors hover:text-white"
            >
              <LogOut size={13} />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="grain min-w-0 flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
