"use client";

import { useFormStatus } from "react-dom";

/**
 * Must live inside a <form> — useFormStatus reads the pending state of the
 * nearest enclosing form, which is how a submit button disables itself while a
 * Server Action is in flight (and stops double-commits).
 */
export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  className = "btn",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
