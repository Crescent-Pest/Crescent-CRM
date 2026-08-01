"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/lib/actions/auth";
import { CrescentMark, Wordmark } from "@/components/brand";

const initialState: SignInState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <main className="grain flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="overflow-hidden rounded-xl border border-line bg-card shadow-[0_12px_40px_-16px_rgba(29,42,66,0.35)]">
          <div className="flex items-center gap-3 border-b-2 border-gold bg-denim-ink px-6 py-5">
            <CrescentMark />
            <Wordmark light />
          </div>

          <form action={formAction} className="space-y-4 px-6 py-6">
            <p className="font-display text-sm font-semibold uppercase tracking-[0.15em] text-ink-soft">
              Staff sign in
            </p>

            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="field"
                placeholder="you@crescent-pest.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="field"
              />
            </div>

            {state.error && (
              <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
                {state.error}
              </p>
            )}

            <button type="submit" disabled={pending} className="btn-primary w-full justify-center">
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-ink-soft">
          Accounts are created by the office admin. No self sign-up.
        </p>
      </div>
    </main>
  );
}
