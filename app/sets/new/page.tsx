import type { Metadata } from "next";
import { SetForm } from "@/components/SetForm";
import { createSet } from "@/lib/actions";
import { requireSignedInPage } from "@/lib/auth/guard";
import { getTunes } from "@/lib/data";
import { withoutSha } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New set · Pancake Tunes" };

export default async function NewSetPage() {
  await requireSignedInPage("/sets/new");
  const tunes = await getTunes();

  return (
    <div className="stack">
      <h2>New set</h2>
      <SetForm action={createSet} tunes={tunes.map(withoutSha)} />
    </div>
  );
}
