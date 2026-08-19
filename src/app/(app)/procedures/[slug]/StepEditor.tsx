"use client";

import { useActionState, useId } from "react";
import { emptyProcedureFormState, updateStep } from "@/lib/actions/procedures";
import type { StepKind } from "@/lib/types";

const KIND_LABELS: Record<StepKind, string> = {
  step: "Step",
  warning: "Warning",
  tip: "Tip",
};

/** Admin edit of one step. Saving bumps the procedure's updated date. */
export function StepEditor({
  stepId,
  content,
  kind,
  onDone,
}: {
  stepId: string;
  content: string;
  kind: StepKind;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    updateStep,
    emptyProcedureFormState,
  );
  const fieldId = useId();

  return (
    <form action={formAction} className="mt-2 rounded-md bg-paper p-3">
      <input type="hidden" name="step_id" value={stepId} />

      <label htmlFor={`${fieldId}-content`} className="label">
        Step text
      </label>
      <textarea
        id={`${fieldId}-content`}
        name="content"
        rows={3}
        required
        maxLength={4000}
        defaultValue={content}
        className="field"
      />

      <label htmlFor={`${fieldId}-kind`} className="label mt-2">
        Type
      </label>
      <select
        id={`${fieldId}-kind`}
        name="kind"
        defaultValue={kind}
        className="field w-auto min-w-32"
      >
        {(Object.keys(KIND_LABELS) as StepKind[]).map((option) => (
          <option key={option} value={option}>
            {KIND_LABELS[option]}
          </option>
        ))}
      </select>

      {state.error && (
        <p className="mt-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mt-2 rounded-md bg-ok/10 px-3 py-2 text-sm text-ok">
          Saved.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="btn-primary btn-tap">
          {pending ? "Saving…" : "Save step"}
        </button>
        <button type="button" onClick={onDone} className="btn-ghost btn-tap">
          Done
        </button>
      </div>
    </form>
  );
}
