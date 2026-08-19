"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { PESTS, slugFromCommonName } from "@/lib/pests";
import type { PestCandidate } from "@/lib/types";

/**
 * Tech confirmation step. The AI ranking is advisory only — nothing proceeds
 * until the technician taps a candidate (or picks a pest manually).
 */
export function CandidatePicker({
  candidates,
  photoQualityNote,
  onConfirm,
}: {
  candidates: PestCandidate[];
  photoQualityNote: string;
  onConfirm: (pestSlug: string, confidence: number | null) => void;
}) {
  const [showManual, setShowManual] = useState(false);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-bold uppercase tracking-[0.08em] text-denim-ink">
          Confirm the pest
        </h2>
        <p className="text-sm text-ink-soft">
          AI suggestions below — you make the call. Tap the correct pest.
        </p>
      </div>

      {photoQualityNote && (
        <p className="rounded-md bg-gold/15 px-3 py-2 text-sm text-ink">
          {photoQualityNote}
        </p>
      )}

      <ul className="space-y-2">
        {candidates.map((c, i) => {
          const slug = slugFromCommonName(c.common_name);
          const pct = Math.round(c.confidence * 100);
          return (
            <li key={`${c.common_name}-${i}`}>
              <button
                type="button"
                disabled={!slug}
                onClick={() => slug && onConfirm(slug, c.confidence)}
                className="card w-full text-left transition-colors enabled:hover:border-denim disabled:opacity-70"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-ink">{c.common_name}</span>
                  <span className="font-display text-sm font-bold text-denim">
                    {pct}%
                  </span>
                </div>
                {c.scientific_name && (
                  <p className="text-xs italic text-ink-soft">{c.scientific_name}</p>
                )}
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-denim"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {c.evidence.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-ink-soft">
                    {c.evidence.slice(0, 3).map((e, j) => (
                      <li key={j} className="flex gap-1.5">
                        <Check size={13} className="mt-0.5 shrink-0 text-ok" />
                        <span>{e}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {!slug && (
                  <p className="mt-2 text-xs text-danger">
                    Not in Crescent&apos;s treatment catalog — pick the closest
                    match manually below.
                  </p>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => setShowManual((v) => !v)}
        className="btn-ghost w-full"
      >
        <ChevronDown
          size={16}
          className={`transition-transform ${showManual ? "rotate-180" : ""}`}
        />
        None of these — pick manually
      </button>

      {showManual && (
        <ul className="grid grid-cols-2 gap-2">
          {PESTS.map((p) => (
            <li key={p.slug}>
              <button
                type="button"
                onClick={() => onConfirm(p.slug, null)}
                className="btn-ghost w-full"
              >
                {p.shortName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
