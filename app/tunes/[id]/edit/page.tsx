import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TuneForm } from "@/components/TuneForm";
import { updateTune } from "@/lib/actions";
import { requireSignedInPage } from "@/lib/auth/guard";
import { getTune } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit tune · Pancake Tunes" };

export default async function EditTunePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSignedInPage(`/tunes/${id}/edit`);

  const tune = await getTune(id);
  if (!tune) notFound();

  return (
    <div className="stack">
      <h2>Edit tune</h2>
      <TuneForm action={updateTune} tune={tune} />
    </div>
  );
}
