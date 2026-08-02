"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verifyPassword } from "./password";
import { createSession, destroySession } from "./session";

export type LoginState = { error?: string };

/** Small constant delay to blunt brute-force attempts against the shared password. */
function throttle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 400));
}

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  // Only allow same-origin paths, so `?next=` can't be used as an open redirect.
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));
  const hash = process.env.EDIT_PASSWORD_HASH;

  if (!hash) {
    return { error: "EDIT_PASSWORD_HASH is not set on the server. See the README." };
  }

  await throttle();

  if (!(await verifyPassword(password, hash))) {
    return { error: "That password is not right." };
  }

  await createSession();
  revalidatePath("/", "layout");
  redirect(next);
}

export async function logout(): Promise<void> {
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/");
}
