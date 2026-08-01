"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";

// Catches data-load failures (e.g. transient auth clock skew right after
// login) and offers a retry instead of a dead error page.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const transient = /JWT issued at future|fetch failed|network/i.test(
    error.message
  );

  return (
    <div className="mx-auto mt-24 max-w-md text-center">
      <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-denim-ink">
        {transient ? "One sec…" : "Something went wrong"}
      </h1>
      <p className="mt-3 text-ink-soft">
        {transient
          ? "The database connection hiccuped — this usually clears right up."
          : "Couldn't load this page. Try again, and tell Logan if it keeps happening."}
      </p>
      <button onClick={reset} className="btn-primary mx-auto mt-6">
        <RotateCw size={16} /> Try again
      </button>
    </div>
  );
}
