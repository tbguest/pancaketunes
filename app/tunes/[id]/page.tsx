import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/DeleteButton";
import { MoveButton } from "@/components/MoveButton";
import { deleteTune, moveTune } from "@/lib/actions";
import { isSignedIn } from "@/lib/auth/session";
import { getSetsContaining, getTune } from "@/lib/data";
import { linkLabel } from "@/lib/form";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const tune = await getTune((await params).id);
  return { title: tune ? `${tune.title} · Pancake Tunes` : "Not found" };
}

export default async function TunePage({ params }: Params) {
  const { id } = await params;
  const [tune, canEdit] = await Promise.all([getTune(id), isSignedIn()]);
  if (!tune) notFound();

  const inSets = await getSetsContaining(id);
  const summary = [tune.type, tune.key, tune.composer].filter(Boolean).join(" · ");
  const backlogged = tune.status === "backlog";

  return (
    <div className="stack">
      <Link href={backlogged ? "/?view=backlog" : "/"} className="backlink">
        ← {backlogged ? "Backlog" : "All tunes"}
      </Link>

      <header className="stack-tight">
        <h2>{tune.title}</h2>
        {tune.alternateTitles.length > 0 && (
          <p className="meta">aka {tune.alternateTitles.join(" · ")}</p>
        )}
        <p className="meta">{summary}</p>
        {backlogged && (
          <p className="meta">
            <span className="tag">Backlog</span> Not in the setlist yet.
          </p>
        )}
      </header>

      {tune.notes && (
        <section>
          <h3>Notes</h3>
          <p className="prose">{tune.notes}</p>
        </section>
      )}

      {tune.links.length > 0 && (
        <section>
          <h3>Recordings</h3>
          <ul className="list">
            {tune.links.map((link) => (
              <li key={link.url}>
                <a
                  className="item"
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="title">{linkLabel(link)} ↗</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tune.sheetMusicUrl && (
        <a
          className="btn btn-secondary btn-block"
          href={tune.sheetMusicUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Sheet music ↗
        </a>
      )}

      {tune.abc && (
        <section>
          <h3>ABC notation</h3>
          {/* Rendered as text for now; see PLAN.md for wiring up abcjs. */}
          <pre
            className="prose"
            style={{
              margin: 0,
              overflowX: "auto",
              fontSize: "0.875rem",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
              padding: "0.75rem",
            }}
          >
            {tune.abc}
          </pre>
        </section>
      )}

      {tune.accompaniment && (
        <section>
          <h3>Accompaniment</h3>
          <pre
            className="prose"
            style={{
              margin: 0,
              overflowX: "auto",
              fontSize: "0.875rem",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
              padding: "0.75rem",
            }}
          >
            {tune.accompaniment}
          </pre>
        </section>
      )}

      {tune.tags.length > 0 && (
        <section>
          <h3>Tags</h3>
          <div className="tags">
            {tune.tags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        </section>
      )}

      {inSets.length > 0 && (
        <section>
          <h3>Played in</h3>
          <ul className="list">
            {inSets.map((set) => (
              <li key={set.id}>
                <Link href={`/sets/${set.id}`} className="item">
                  <span className="title">{set.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canEdit && (
        <>
          <hr />
          <MoveButton action={moveTune} id={tune.id} status={tune.status} />
          <div className="actions">
            <Link href={`/tunes/${tune.id}/edit`} className="btn">
              Edit
            </Link>
            <DeleteButton
              action={deleteTune}
              id={tune.id}
              label={tune.title}
              warning={
                inSets.length > 0
                  ? `It is used in ${inSets.length} set${inSets.length === 1 ? "" : "s"}: ${inSets
                      .map((set) => set.name)
                      .join(", ")}.`
                  : undefined
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
