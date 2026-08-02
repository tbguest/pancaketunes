import "server-only";
import { redirect } from "next/navigation";
import { isSignedIn } from "./session";

/**
 * Page-level gate for the editor routes. This is convenience, not security —
 * the real check happens inside each Server Action (see requireSession), since
 * actions are reachable without ever loading a page.
 */
export async function requireSignedInPage(returnTo: string): Promise<void> {
  if (!(await isSignedIn())) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }
}
