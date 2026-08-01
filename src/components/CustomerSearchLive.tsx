"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

/** Live search box for /customers — updates the URL (and the server-rendered
 *  list) as you type, debounced so we're not querying per keystroke. */
export function CustomerSearchLive({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const skippedInitial = useRef(false);

  useEffect(() => {
    if (!skippedInitial.current) {
      skippedInitial.current = true;
      return;
    }
    const timer = setTimeout(() => {
      const q = value.trim();
      router.replace(q ? `/customers?q=${encodeURIComponent(q)}` : "/customers");
    }, 300);
    return () => clearTimeout(timer);
  }, [value, router]);

  return (
    <form
      className="relative mt-4 max-w-md md:mt-6"
      onSubmit={(e) => e.preventDefault()}
    >
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Search customers"
        placeholder="Search name, company, phone, email…"
        className="field pl-9"
      />
    </form>
  );
}
