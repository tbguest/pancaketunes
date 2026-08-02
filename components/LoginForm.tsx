"use client";

import { useActionState } from "react";
import { login } from "@/lib/auth/actions";
import { SubmitButton } from "./SubmitButton";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(login, {});

  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="next" value={next} />

      {state.error && (
        <p className="notice" role="alert">
          {state.error}
        </p>
      )}

      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          // Signals to password managers that this is a shared, not personal, login.
          autoComplete="current-password"
        />
      </div>

      <SubmitButton className="btn btn-block" pendingLabel="Checking…">
        Sign in
      </SubmitButton>
    </form>
  );
}
