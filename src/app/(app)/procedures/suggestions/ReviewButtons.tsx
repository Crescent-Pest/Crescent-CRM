"use client";

import { useActionState } from "react";
import { Check, X } from "lucide-react";
import {
  reviewSuggestion,
  type ProcedureFormState,
} from "@/lib/actions/procedures";

const initialState: ProcedureFormState = { error: null, success: false };

/**
 * Admin decision on one suggestion. Accept writes the proposed text onto the
 * step; reject just closes it. Both buttons post the same form.
 */
export function ReviewButtons({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(
    reviewSuggestion,
    initialState,
  );

  return (
    <form action={formAction} className="mt-3">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="decision"
          value="accepted"
          disabled={pending}
          className="btn-primary btn-tap"
        >
          <Check size={15} /> {pending ? "Working…" : "Accept & apply"}
        </button>
        <button
          type="submit"
          name="decision"
          value="rejected"
          disabled={pending}
          className="btn-ghost btn-tap"
        >
          <X size={15} /> Reject
        </button>
      </div>
      {state.error && (
        <p className="mt-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
