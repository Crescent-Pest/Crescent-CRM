import { Search } from "lucide-react";

/**
 * Compact GET form that lands on /customers?q=… — lets office staff jump to a
 * customer from the schedule views without switching sections first.
 */
export function CustomerSearch({ className = "w-60" }: { className?: string }) {
  return (
    <form action="/customers" className={`relative ${className}`}>
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
      />
      <input
        type="search"
        name="q"
        aria-label="Search customers"
        placeholder="Find a customer…"
        className="field pl-9"
      />
    </form>
  );
}
