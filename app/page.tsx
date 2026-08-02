import { Browser } from "@/components/Browser";
import { DataProblems } from "@/components/DataProblems";
import { isSignedIn } from "@/lib/auth/session";
import { getDataset } from "@/lib/data";
import { withoutSha } from "@/lib/types";

// Reads live data and the session cookie on every request.
export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const [{ view }, { tunes, sets, problems }, canEdit] = await Promise.all([
    searchParams,
    getDataset(),
    isSignedIn(),
  ]);

  return (
    <>
      <DataProblems problems={problems} />
      <Browser
        tunes={tunes.map(withoutSha)}
        sets={sets.map(withoutSha)}
        initialView={view === "sets" ? "sets" : "tunes"}
        canEdit={canEdit}
      />
    </>
  );
}
