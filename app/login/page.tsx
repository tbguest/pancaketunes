import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { isSignedIn } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in · Pancake Tunes" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (await isSignedIn()) redirect("/");

  // Guard against `?next=//evil.example` being used as an open redirect.
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/";

  return (
    <div className="stack">
      <h2>Sign in to edit</h2>
      <p className="meta">Browsing is open to everyone. The password is only needed for changes.</p>
      <LoginForm next={safeNext} />
    </div>
  );
}
