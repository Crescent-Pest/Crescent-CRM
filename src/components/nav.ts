import { CalendarCheck, CalendarDays, LayoutDashboard, Users } from "lucide-react";

const dashboard = { href: "/", label: "Dashboard", icon: LayoutDashboard };
const customers = { href: "/customers", label: "Customers", icon: Users };
const schedule = { href: "/schedule", label: "Schedule", icon: CalendarDays };
const today = { href: "/today", label: "Today", icon: CalendarCheck };

export const sidebarNav = [dashboard, customers, schedule, today];

/** Phone tab bar leads with the pages a tech in the field opens most */
export const mobileNav = [today, schedule, customers, dashboard];

/** "/" only matches exactly so it doesn't light up on every route */
export function isNavActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
