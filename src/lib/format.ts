const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const longDateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

/** "2026-08-01" -> "Sat, Aug 1" (dates are calendar dates, render in UTC to avoid TZ drift) */
export function formatDate(isoDate: string) {
  return dateFmt.format(new Date(`${isoDate}T00:00:00Z`));
}

export function formatLongDate(isoDate: string) {
  return longDateFmt.format(new Date(`${isoDate}T00:00:00Z`));
}

/** "09:00:00" -> "9:00 AM" */
export function formatTime(time: string | null) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatWindow(start: string | null, end: string | null) {
  if (!start && !end) return "Anytime";
  if (start && end) return `${formatTime(start)} – ${formatTime(end)}`;
  return formatTime(start ?? end);
}

export function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

/** Today as YYYY-MM-DD in the shop's timezone (US Eastern) */
export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());
}

export function addDaysISO(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Month arithmetic that clamps to the last day of the target month, so
 * Jan 31 + 1 month is Feb 28/29 instead of rolling over into March.
 */
export function addMonthsISO(isoDate: string, months: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1); // park on a day every month has before shifting
  d.setUTCMonth(d.getUTCMonth() + months);
  // day 0 of the following month = last day of the target month
  const lastDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString().slice(0, 10);
}
