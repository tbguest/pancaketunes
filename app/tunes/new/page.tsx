import type { Metadata } from "next";
import { TuneForm } from "@/components/TuneForm";
import { createTune } from "@/lib/actions";
import { requireSignedInPage } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New tune · Pancake Tunes" };

export default async function NewTunePage() {
  await requireSignedInPage("/tunes/new");

  return (
    <div className="stack">
      <h2>New tune</h2>
      <TuneForm action={createTune} />
    </div>
  );
}
