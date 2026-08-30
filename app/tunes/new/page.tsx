import type { Metadata } from "next";
import { TuneForm } from "@/components/TuneForm";
import { createTune } from "@/lib/actions";
import { requireSignedInPage } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New tune · Pancake Tunes" };

export default async function NewTunePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ status }] = await Promise.all([searchParams, requireSignedInPage("/tunes/new")]);
  const backlog = status === "backlog";

  return (
    <div className="stack">
      <h2>{backlog ? "New backlog tune" : "New tune"}</h2>
      <TuneForm action={createTune} defaultStatus={backlog ? "backlog" : "repertoire"} />
    </div>
  );
}
