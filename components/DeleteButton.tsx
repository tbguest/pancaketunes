"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/actions";
import { SubmitButton } from "./SubmitButton";

/**
 * Delete is destructive and permanent-looking (though every version is still in
 * the git history), so it always goes through a confirm prompt. `warning` is
 * used to spell out knock-on effects, e.g. sets that reference this tune.
 */
export function DeleteButton({
  action,
  id,
  label,
  warning,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  id: string;
  label: string;
  warning?: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form
      action={formAction}
      style={{ flex: 1 }}
      onSubmit={(event) => {
        const message = warning ? `Delete "${label}"?\n\n${warning}` : `Delete "${label}"?`;
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton className="btn btn-secondary btn-block" pendingLabel="Deleting…">
        Delete
      </SubmitButton>
      {state.error && (
        <p className="notice" role="alert" style={{ marginTop: "0.5rem" }}>
          {state.error}
        </p>
      )}
    </form>
  );
}
