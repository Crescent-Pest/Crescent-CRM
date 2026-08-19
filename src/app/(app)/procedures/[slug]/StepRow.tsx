"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  Lightbulb,
  MessageSquarePlus,
  PencilLine,
} from "lucide-react";
import { ChemicalChips } from "@/components/procedures/ChemicalChips";
import type { Chemical, ProcedureStep } from "@/lib/types";
import { StepEditor } from "./StepEditor";
import { SuggestForm } from "./SuggestForm";

type Panel = "none" | "suggest" | "edit";

/** Warnings and tips read as callouts; plain steps read as checklist rows. */
const CALLOUT = {
  warning: {
    label: "Safety",
    icon: AlertTriangle,
    box: "border-danger/40 bg-danger/5",
    text: "text-danger",
  },
  tip: {
    label: "Tip",
    icon: Lightbulb,
    box: "border-gold/60 bg-gold/10",
    text: "text-denim-ink",
  },
} as const;

export function StepRow({
  step,
  chemicals,
  checked,
  onToggle,
  pendingCount,
  canEdit,
}: {
  step: ProcedureStep;
  chemicals: Map<string, Chemical>;
  checked: boolean;
  onToggle: (id: string) => void;
  pendingCount: number;
  canEdit: boolean;
}) {
  const [panel, setPanel] = useState<Panel>("none");
  const indent = step.indent >= 1 ? "ml-4 border-l border-line pl-3" : "";

  const actions = (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        onClick={() => setPanel(panel === "suggest" ? "none" : "suggest")}
        aria-expanded={panel === "suggest"}
        className="inline-flex min-h-8 items-center gap-1 text-xs text-ink-soft transition-colors hover:text-denim"
      >
        <MessageSquarePlus size={13} /> Suggest a change
      </button>
      {canEdit && (
        <button
          type="button"
          onClick={() => setPanel(panel === "edit" ? "none" : "edit")}
          aria-expanded={panel === "edit"}
          className="inline-flex min-h-8 items-center gap-1 text-xs text-ink-soft transition-colors hover:text-denim"
        >
          <PencilLine size={13} /> Edit
        </button>
      )}
      {pendingCount > 0 && (
        <Link
          href="/procedures/suggestions"
          className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-denim hover:underline"
        >
          {pendingCount} pending
        </Link>
      )}
    </div>
  );

  const panels = (
    <>
      {panel === "suggest" && (
        <SuggestForm
          stepId={step.id}
          currentContent={step.content}
          onDone={() => setPanel("none")}
        />
      )}
      {panel === "edit" && canEdit && (
        <StepEditor
          stepId={step.id}
          content={step.content}
          kind={step.kind}
          onDone={() => setPanel("none")}
        />
      )}
    </>
  );

  if (step.kind === "warning" || step.kind === "tip") {
    const meta = CALLOUT[step.kind];
    const Icon = meta.icon;
    return (
      <li className={`${indent} py-1.5`}>
        <div className={`rounded-md border px-3 py-2 ${meta.box}`}>
          <p
            className={`flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-wider ${meta.text}`}
          >
            <Icon size={13} /> {meta.label}
          </p>
          <p className="mt-1 text-[15px] leading-relaxed">{step.content}</p>
          <ChemicalChips ids={step.chemical_ids} chemicals={chemicals} />
          {actions}
        </div>
        {panels}
      </li>
    );
  }

  return (
    <li className={`${indent} border-b border-line py-1 last:border-b-0`}>
      <div className="flex items-start gap-2.5">
        <label className="flex min-h-10 cursor-pointer items-start gap-2.5 pt-1.5">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={checked}
            onChange={() => onToggle(step.id)}
          />
          <span
            aria-hidden="true"
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-denim/40 ${
              checked
                ? "border-gold bg-gold text-denim-ink"
                : "border-line bg-white text-transparent"
            }`}
          >
            <Check size={13} strokeWidth={3} />
          </span>
          <span
            className={`min-w-0 text-[15px] leading-relaxed ${
              checked ? "text-ink-soft line-through" : ""
            }`}
          >
            {step.content}
          </span>
        </label>
      </div>
      <div className="pl-[30px]">
        <ChemicalChips ids={step.chemical_ids} chemicals={chemicals} />
        {actions}
      </div>
      {panels}
    </li>
  );
}
