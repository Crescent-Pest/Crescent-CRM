"use client";

import { useRouter } from "next/navigation";

/** Tech dropdown for /followups — updates the URL so the server re-filters. */
export function TechFilter({
  techs,
  selected,
}: {
  techs: { id: string; full_name: string }[];
  selected: string;
}) {
  const router = useRouter();

  return (
    <select
      aria-label="Filter by tech"
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
          {t.full_name}
        </option>
      ))}
    </select>
  );
}
