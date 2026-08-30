import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/DeleteButton";
import { deleteSet } from "@/lib/actions";
import { isSignedIn } from "@/lib/auth/session";
import { getResolvedSet } from "@/lib/data";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const set = await getResolvedSet((await params).id);
  return { title: set ? `${set.name} · Pancake Tunes` : "Not found" };
}

export default async function SetPage({ params }: Params) {
  const { id } = await params;
  const [set, canEdit] = await Promise.all([getResolvedSet(id), isSignedIn()]);
  if (!set) notFound();

  return (
    <div className="stack">
      <Link href="/?view=sets" className="backlink">
        ← All sets
      </Link>

      <header className="stack-tight">
        <h2>{set.name}</h2>
        {set.description && <p className="meta">{set.description}</p>}
      </header>

      {set.tunes.length === 0 ? (
        <p className="empty">No tunes in this set yet.</p>
      ) : (
        <ol className="ordered">
          {set.tunes.map(({ id: tuneId, tune }, index) => (
            <li key={`${tuneId}-${index}`}>
              {tune ? (
                <Link href={`/tunes/${tune.id}`} className="item">
                  <div>
                    <div className="title">{tune.title}</div>
                    <div className="meta">
                      {[tune.type, tune.key, tune.status === "backlog" && "backlog"]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                </Link>
              ) : (
                // The tune was deleted but the set still points at it. Say so
                // plainly rather than rendering a dead link.
                <div className="item">
                  <div>
                    <div className="title">Missing tune</div>
                    <div className="meta">&ldquo;{tuneId}&rdquo; is no longer in the collection</div>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {set.notes && (
        <section>
          <h3>Notes</h3>
          <p className="prose">{set.notes}</p>
        </section>
      )}

      {set.tags.length > 0 && (
        <section>
          <h3>Tags</h3>
          <div className="tags">
            {set.tags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        </section>
      )}

      {canEdit && (
        <>
          <hr />
          <div className="actions">
            <Link href={`/sets/${set.id}/edit`} className="btn">
              Edit
            </Link>
            <DeleteButton action={deleteSet} id={set.id} label={set.name} />
          </div>
        </>
      )}
    </div>
  );
}
