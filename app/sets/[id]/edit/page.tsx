import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SetForm } from "@/components/SetForm";
import { updateSet } from "@/lib/actions";
import { requireSignedInPage } from "@/lib/auth/guard";
import { getSet, getTunes } from "@/lib/data";
import { withoutSha } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit set · Pancake Tunes" };

export default async function EditSetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSignedInPage(`/sets/${id}/edit`);

  const [set, tunes] = await Promise.all([getSet(id), getTunes()]);
  if (!set) notFound();

  return (
    <div className="stack">
      <h2>Edit set</h2>
      <SetForm action={updateSet} tunes={tunes.map(withoutSha)} set={set} />
    </div>
  );
}
