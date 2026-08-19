import {
  BookOpen,
  CalendarCheck,
  CalendarDays,
  Camera,
  ClipboardList,
  History,
  LayoutDashboard,
  ListTodo,
  Mic,
  Users,
} from "lucide-react";

const dashboard = { href: "/", label: "Dashboard", icon: LayoutDashboard, badge: false };
const customers = { href: "/customers", label: "Customers", icon: Users, badge: false };
const schedule = { href: "/schedule", label: "Schedule", icon: CalendarDays, badge: false };
const today = { href: "/today", label: "Today", icon: CalendarCheck, badge: false };
const inspect = { href: "/capture", label: "Inspect", icon: Camera, badge: false };
const notes = { href: "/notes/new", label: "Notes", icon: Mic, badge: false };
const history = { href: "/history", label: "History", icon: History, badge: false };
const procedures = { href: "/procedures", label: "Procedures", icon: BookOpen, badge: false };
// badge: open follow-up count for the signed-in tech (red when overdue)
const followups = { href: "/followups", label: "Follow-ups", icon: ListTodo, badge: true };
const team = { href: "/team", label: "Team", icon: ClipboardList, badge: false };

export const sidebarNav = [
  dashboard,
  customers,
  schedule,
  today,
  inspect,
  notes,
  history,
  followups,
  team,
  procedures,
];

/** Five tabs max, field-first — Dashboard, Schedule, and History stay
 * reachable from the sidebar (desktop) and dashboard links. */
export const mobileNav = [today, inspect, notes, followups, customers];

/** "/" only matches exactly so it doesn't light up on every route */
export function isNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  // note detail pages belong to the Notes tab too
  if (href === "/notes/new") return pathname.startsWith("/notes");
  return pathname.startsWith(href);
}
