"use client";

import { useActionState, useId } from "react";
import { Send } from "lucide-react";
import {
  suggestStepChange,
  type ProcedureFormState,
} from "@/lib/actions/procedures";

const initialState: ProcedureFormState = { error: null, success: false };

/**
 * Suggest a rewrite of one step. Any active staff member can send one; it
 * lands in the queue for an admin to accept or reject.
 */
export function SuggestForm({
  stepId,
  currentContent,
  onDone,
}: {
  stepId: string;
  currentContent: string;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    suggestStepChange,
    initialState,
  );
  const fieldId = useId();

  if (state.success) {
    return (
      <div className="mt-2 rounded-md bg-ok/10 px-3 py-2 text-sm text-ok">
        Sent. An admin reviews it before the manual changes.
        <button
          type="button"
          onClick={onDone}
          className="ml-2 font-semibold underline"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-2 rounded-md bg-paper p-3">
      <input type="hidden" name="step_id" value={stepId} />

      <label htmlFor={`${fieldId}-content`} className="label">
        How should it read?
      </label>
      <textarea
        id={`${fieldId}-content`}
        name="proposed_content"
        rows={3}
        required
        minLength={5}
        maxLength={4000}
        defaultValue={currentContent}
        className="field"
      />

      <label htmlFor={`${fieldId}-reason`} className="label mt-2">
        Why (optional)
      </label>
      <input
        id={`${fieldId}-reason`}
        name="reason"
        type="text"
        maxLength={500}
        placeholder="Label says a different rate, product discontinued…"
        className="field"
      />

      {state.error && (
        <p className="mt-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="btn-primary btn-tap">
          <Send size={15} /> {pending ? "Sending…" : "Send suggestion"}
        </button>
        <button type="button" onClick={onDone} className="btn-ghost btn-tap">
          Cancel
        </button>
      </div>
    </form>
  );
}
