"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { updatePassword, type PasswordState } from "@/lib/actions/auth";

const initialState: PasswordState = { error: null, success: false };

export default function AccountPage() {
  const [state, formAction, pending] = useActionState(updatePassword, initialState);

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-denim-ink md:text-4xl">
        My account
      </h1>

      <form
        action={formAction}
        className="mt-6 space-y-4 rounded-lg border border-line bg-card p-6"
      >
        <p className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.15em] text-ink-soft">
          <KeyRound size={15} /> Change password
        </p>

        <div>
          <label htmlFor="password" className="label">
            New password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="field"
          />
        </div>

        <div>
          <label htmlFor="confirm" className="label">
            Confirm new password
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="field"
          />
        </div>

        {state.error && (
          <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        )}
        {state.success && (
          <p className="rounded-md bg-ok/10 px-3 py-2 text-sm text-ok">
            Password updated. Use it next time you sign in.
          </p>
        )}

        <button type="submit" disabled={pending} className="btn-primary btn-tap">
          {pending ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
