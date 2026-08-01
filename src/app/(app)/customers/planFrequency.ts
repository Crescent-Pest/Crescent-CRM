import type { PlanFrequency } from "@/lib/types";

/** Human labels for the plan_frequency enum, in the order they appear in selects */
export const frequencyLabel: Record<PlanFrequency, string> = {
  one_time: "One-time",
  monthly: "Monthly",
  bimonthly: "Every 2 months",
  quarterly: "Quarterly",
  semiannual: "Twice a year",
  annual: "Yearly",
};

export const frequencyOptions = Object.entries(frequencyLabel) as [
  PlanFrequency,
  string,
][];
