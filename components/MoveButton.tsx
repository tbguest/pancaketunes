"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/actions";
import type { TuneStatus } from "@/lib/types";
import { SubmitButton } from "./SubmitButton";

/**
 * Promotes a backlog tune into the setlist, or demotes one back out. Both are
 * reversible and one field wide, so unlike delete this needs no confirmation —
 * just a button that says which way it goes.
 */
export function MoveButton({
  action,
  id,
  status,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  id: string;
  status: TuneStatus;
}) {
  const [state, formAction] = useActionState(action, {});
  const target: TuneStatus = status === "backlog" ? "repertoire" : "backlog";

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={target} />
      <SubmitButton className="btn btn-secondary btn-block" pendingLabel="Moving…">
        {target === "repertoire" ? "Add to the setlist" : "Move to backlog"}
      </SubmitButton>
      {state.error && (
        <p className="notice" role="alert" style={{ marginTop: "0.5rem" }}>
          {state.error}
        </p>
      )}
    </form>
  );
}
