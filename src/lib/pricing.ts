import pricing from "@/data/pricing.json";

/**
 * Price estimates are computed HERE, in code, from src/data/pricing.json.
 * The AI never sees or invents prices. Update the JSON, not this logic,
 * when rates change.
 */

export interface EstimateLine {
  label: string;
  amount_cents: number;
}

export interface Estimate {
  total_cents: number;
  recurring_cents: number;
  lines: EstimateLine[];
  demo: boolean;
}

export function isDemoPricing(): boolean {
  return pricing.demo === true;
}

export function computeEstimate(pestSlug: string, sqft?: number | null): Estimate | null {
  const perPest = pricing.per_pest as Record<
    string,
    { initial_cents: number; recurring_cents: number }
  >;
  const rates = perPest[pestSlug];
  if (!rates) return null;

  const lines: EstimateLine[] = [
    { label: "Initial treatment", amount_cents: rates.initial_cents },
  ];

  if (
    typeof sqft === "number" &&
    Number.isFinite(sqft) &&
    sqft > pricing.sqft_surcharge.threshold_sqft
  ) {
    lines.push({
      label: `Large property surcharge (over ${pricing.sqft_surcharge.threshold_sqft.toLocaleString()} sq ft)`,
      amount_cents: pricing.sqft_surcharge.surcharge_cents,
    });
  }

  const total_cents = lines.reduce((sum, l) => sum + l.amount_cents, 0);

  return {
    total_cents,
    recurring_cents: rates.recurring_cents,
    lines,
    demo: pricing.demo === true,
  };
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}
