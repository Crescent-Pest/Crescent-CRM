import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { fetchChemicals } from "@/lib/procedures";
import { ChemicalBrowser } from "./ChemicalBrowser";

export default async function ChemicalsPage() {
  const chemicals = await fetchChemicals();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/procedures"
        className="inline-flex min-h-10 items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-[0.12em] text-denim hover:text-denim-deep"
      >
        <ArrowLeft size={14} /> Procedures
      </Link>

      <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-denim-ink md:text-4xl">
        Chemicals
      </h1>
      <p className="mt-1 text-ink-soft">
        Mix ratios, EPA numbers, and label limits for everything Crescent runs.
      </p>

      <ChemicalBrowser chemicals={chemicals} />
    </div>
  );
}
