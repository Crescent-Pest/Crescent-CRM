import { CalendarCheck, CalendarDays, LayoutDashboard, ListTodo, Users } from "lucide-react";

const dashboard = { href: "/", label: "Dashboard", icon: LayoutDashboard };
const customers = { href: "/customers", label: "Customers", icon: Users };
const schedule = { href: "/schedule", label: "Schedule", icon: CalendarDays };
const today = { href: "/today", label: "Today", icon: CalendarCheck };
const followups = { href: "/followups", label: "Follow-ups", icon: ListTodo };

export const sidebarNav = [dashboard, customers, schedule, today, followups];

export const mobileNav = [dashboard, today, schedule, followups, customers];

/** "/" only matches exactly so it doesn't light up on every route */
export function isNavActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
