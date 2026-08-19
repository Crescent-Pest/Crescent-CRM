"use client";

import { FileText } from "lucide-react";
import { pestBySlug } from "@/lib/pests";

/** Optional job details collected between pest confirmation and plan generation. */
export function DetailsForm({
  pestSlug,
  sqft,
  notes,
  onSqftChange,
  onNotesChange,
  onGenerate,
  onBack,
}: {
  pestSlug: string;
  sqft: string;
  notes: string;
  onSqftChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onGenerate: () => void;
  onBack: () => void;
}) {
  const pest = pestBySlug(pestSlug);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-bold uppercase tracking-[0.08em] text-denim-ink">
          Job details
        </h2>
        <p className="text-sm text-ink-soft">
          Confirmed: <span className="font-semibold text-ink">{pest?.commonName}</span>
        </p>
      </div>

      <div className="card space-y-3">
        <div>
          <label htmlFor="sqft" className="label">
            Property size (sq ft, optional)
          </label>
          <input
            id="sqft"
            type="number"
            inputMode="numeric"
            min={0}
            className="field"
            placeholder="e.g. 2400"
            value={sqft}
            onChange={(e) => onSqftChange(e.target.value)}
          />
          <p className="mt-1 text-xs text-ink-soft">
            Properties over 3,000 sq ft add a size surcharge to the estimate.
          </p>
        </div>

        <div>
          <label htmlFor="notes" className="label">
            Field notes (optional)
          </label>
          <textarea
            id="notes"
            rows={3}
            className="field"
            placeholder="Where you found it, severity, access issues…"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
          />
        </div>
      </div>

      <button type="button" onClick={onGenerate} className="btn-primary w-full">
        <FileText size={17} />
        Generate treatment plan
      </button>
      <button type="button" onClick={onBack} className="btn-ghost w-full">
        Back to pest selection
      </button>
    </div>
  );
}
