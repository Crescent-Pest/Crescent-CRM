import { AlertTriangle, ListTodo } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchFollowups, type FollowupRow } from "@/lib/fieldActivity";
import { formatLongDate, todayISO } from "@/lib/format";
import type { Profile } from "@/lib/types";
import { FollowupItem } from "./FollowupItem";
import { TechFilter } from "./TechFilter";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Section {
  key: string;
  title: string;
  headerClass: string;
  listClass: string;
  items: FollowupRow[];
  withIcon?: boolean;
}

export default async function FollowupsPage({
  searchParams,
}: {
  searchParams: Promise<{ tech?: string }>;
}) {
  // `tech` in the URL now means "assigned to this person"
  const { tech } = await searchParams;
  const assigneeId = UUID_RE.test(tech ?? "") ? tech! : null;
  const today = todayISO();
  const supabase = await createClient();

  const [items, { data: techData }, { data: userData }] = await Promise.all([
    fetchFollowups(assigneeId),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("active", true)
      .order("full_name"),
    supabase.auth.getUser(),
  ]);
  const techs = (techData ?? []) as Pick<Profile, "id" | "full_name">[];

  const open = items.filter((i) => i.status === "open");
  const done = [...items]
    .filter((i) => i.status === "done")
    .sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));

  const sections: Section[] = [
    {
      key: "overdue",
      title: "Overdue",
      headerClass: "text-danger",
      listClass: "border-danger/40",
      items: open.filter((i) => i.due_date !== null && i.due_date < today),
      withIcon: true,
    },
    {
      key: "today",
      title: "Today",
      headerClass: "text-denim-ink",
      listClass: "border-gold/60",
      items: open.filter((i) => i.due_date === today),
    },
    {
      key: "upcoming",
      title: "Upcoming",
      headerClass: "text-denim-ink",
      listClass: "border-line",
      items: open.filter((i) => i.due_date === null || i.due_date > today),
    },
    {
      key: "done",
      title: "Done recently",
      headerClass: "text-ink-soft",
      listClass: "border-line",
      items: done,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-denim-ink md:text-4xl">
            Follow-ups
          </h1>
          <p className="mt-1 text-ink-soft">
            {formatLongDate(today)}
            <span className="mx-1.5">·</span>
            {open.length} open
          </p>
        </div>
        <TechFilter
          techs={techs}
          selected={assigneeId ?? ""}
          selfId={userData.user?.id ?? ""}
        />
      </div>

      {items.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-line bg-card px-4 py-6 text-center md:py-10">
          <ListTodo size={28} className="mx-auto text-ink-soft" />
          <p className="mt-2 text-ink-soft">
            {assigneeId
              ? "No follow-ups assigned to this person."
              : "No follow-ups yet — techs capture these as voice notes in Crescent Inspect."}
          </p>
        </div>
      )}

      {sections.map(({ key, title, headerClass, listClass, items: rows, withIcon }) => {
        if (rows.length === 0) return null;
        return (
          <section key={key} className="mt-6 md:mt-8">
            <h2
              className={`mb-2 flex items-center gap-2 font-display text-base font-bold uppercase tracking-wide md:text-lg ${headerClass}`}
            >
              {withIcon && <AlertTriangle size={18} />}
              {title}
              <span className="text-sm font-semibold text-ink-soft">
                {rows.length}
              </span>
            </h2>
            <ul className={`rounded-lg border bg-card ${listClass}`}>
              {rows.map((item) => (
                <FollowupItem key={item.id} item={item} today={today} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
