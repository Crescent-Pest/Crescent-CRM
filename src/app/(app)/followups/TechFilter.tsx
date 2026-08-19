"use client";

import { useRouter } from "next/navigation";

/** Assignee dropdown for /followups — updates the URL so the server re-filters.
 * The `tech` query param name is kept so existing links still work. */
export function TechFilter({
  techs,
  selected,
  selfId,
}: {
  techs: { id: string; full_name: string }[];
  selected: string;
  /** signed-in staff member, so "mine" is one tap away */
  selfId: string;
}) {
  const router = useRouter();

  return (
    <select
      aria-label="Filter by assignee"
      value={selected}
      onChange={(e) => {
        const tech = e.target.value;
        router.replace(tech ? `/followups?tech=${tech}` : "/followups");
      }}
      className="field w-auto min-w-40"
    >
      <option value="">Everyone</option>
      {techs.map((t) => (
        <option key={t.id} value={t.id}>
          {t.id === selfId ? `${t.full_name} (mine)` : t.full_name}
        </option>
      ))}
    </select>
  );
}
