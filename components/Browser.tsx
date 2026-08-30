"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { indexSets, indexTunes, search } from "@/lib/search";
import { TUNE_TYPES, type Tune, type TuneSet, type TuneType } from "@/lib/types";

/**
 * The home screen: one search box, three tabs, one column. All filtering is
 * client-side against data embedded in the page, so results update as fast as
 * the user can type.
 *
 * The backlog is a third tab rather than a filter chip: it is a different list
 * with a different purpose (tunes nobody plays yet), and keeping it off the
 * Tunes tab is the whole reason it exists.
 */

type View = "tunes" | "sets" | "backlog";

function hrefForView(view: View): string {
  return view === "tunes" ? "/" : `/?view=${view}`;
}

type Props = {
  tunes: Tune[];
  sets: TuneSet[];
  initialView: View;
  canEdit: boolean;
};

export function Browser({ tunes, sets, initialView, canEdit }: Props) {
  const [view, setView] = useState<View>(initialView);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TuneType | "all">("all");

  // Keeps typing responsive if the list ever gets long enough to matter.
  const deferredQuery = useDeferredValue(query);

  const repertoire = useMemo(() => tunes.filter((tune) => tune.status !== "backlog"), [tunes]);
  const backlog = useMemo(() => tunes.filter((tune) => tune.status === "backlog"), [tunes]);

  // An empty backlog is worth nobody's attention, so the tab only shows up once
  // there is something in it — or for someone signed in who can put it there.
  const showBacklog = backlog.length > 0 || canEdit;
  const active: View = view === "backlog" && !showBacklog ? "tunes" : view;

  const tuneIndex = useMemo(() => indexTunes(tunes), [tunes]);
  // Sets index against every tune: a planned set may well reach into the backlog.
  const setIndex = useMemo(() => indexSets(sets, tunes), [sets, tunes]);

  // Searching once over everything and splitting afterwards keeps the two tune
  // tabs in step — the same query, the same ranking, just a different half.
  const matchedTunes = useMemo(() => {
    const found = search(tuneIndex, deferredQuery);
    return type === "all" ? found : found.filter((tune) => tune.type === type);
  }, [tuneIndex, deferredQuery, type]);

  const matchedRepertoire = useMemo(
    () => matchedTunes.filter((tune) => tune.status !== "backlog"),
    [matchedTunes],
  );
  const matchedBacklog = useMemo(
    () => matchedTunes.filter((tune) => tune.status === "backlog"),
    [matchedTunes],
  );

  const matchedSets = useMemo(() => search(setIndex, deferredQuery), [setIndex, deferredQuery]);

  const listed = active === "backlog" ? backlog : repertoire;

  // Only offer filters for types actually present in the list being shown.
  const availableTypes = useMemo(() => {
    const present = new Set(listed.map((tune) => tune.type));
    return TUNE_TYPES.filter((candidate) => present.has(candidate));
  }, [listed]);

  // A type chosen on one tab rarely makes sense on another, so switching clears it.
  // replaceState (not the router) keeps the URL in step with the tab so a refresh
  // opens the same list, without refetching the page or stacking history entries.
  function show(next: View) {
    setView(next);
    setType("all");
    window.history.replaceState(null, "", hrefForView(next));
  }

  const matched =
    active === "tunes" ? matchedRepertoire : active === "backlog" ? matchedBacklog : matchedSets;
  const noun = active === "sets" ? "set" : "tune";

  return (
    <div className="stack">
      <input
        className="search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`Search ${active === "sets" ? "sets" : active === "backlog" ? "the backlog" : "tunes"}…`}
        aria-label={`Search ${active === "sets" ? "sets" : active === "backlog" ? "the backlog" : "tunes"}`}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
      />

      <div className="tabs" role="tablist">
        <a
          role="tab"
          href={hrefForView("tunes")}
          aria-current={active === "tunes" ? "page" : undefined}
          aria-selected={active === "tunes"}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            show("tunes");
          }}
        >
          Tunes ({matchedRepertoire.length})
        </a>
        <a
          role="tab"
          href={hrefForView("sets")}
          aria-current={active === "sets" ? "page" : undefined}
          aria-selected={active === "sets"}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            show("sets");
          }}
        >
          Sets ({matchedSets.length})
        </a>
        {showBacklog && (
          <a
            role="tab"
            href={hrefForView("backlog")}
            aria-current={active === "backlog" ? "page" : undefined}
            aria-selected={active === "backlog"}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              show("backlog");
            }}
          >
            Backlog ({matchedBacklog.length})
          </a>
        )}
      </div>

      {active !== "sets" && availableTypes.length > 1 && (
        <div className="filters">
          <button
            type="button"
            className="chip"
            aria-pressed={type === "all"}
            onClick={() => setType("all")}
          >
            All
          </button>
          {availableTypes.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className="chip"
              aria-pressed={type === candidate}
              onClick={() => setType(type === candidate ? "all" : candidate)}
            >
              {candidate}
            </button>
          ))}
        </div>
      )}

      <div aria-live="polite" role="status" className="count">
        {matched.length} {noun}
        {matched.length === 1 ? "" : "s"}
        {active === "backlog" && " waiting to be learned"}
      </div>

      {active === "sets" ? (
        <SetList sets={matchedSets} tunes={tunes} empty={sets.length === 0} />
      ) : (
        <TuneList
          tunes={active === "backlog" ? matchedBacklog : matchedRepertoire}
          empty={listed.length === 0}
          emptyMessage={
            active === "backlog"
              ? "Nothing in the backlog. Park a tune here to suggest it to the group."
              : "No tunes yet. Sign in to add the first one."
          }
        />
      )}

      {canEdit && (
        <Link
          href={
            active === "sets"
              ? "/sets/new"
              : active === "backlog"
                ? "/tunes/new?status=backlog"
                : "/tunes/new"
          }
          className="btn btn-secondary btn-block"
        >
          {active === "sets" ? "+ New set" : active === "backlog" ? "+ New backlog tune" : "+ New tune"}
        </Link>
      )}
    </div>
  );
}

function TuneList({
  tunes,
  empty,
  emptyMessage,
}: {
  tunes: Tune[];
  empty: boolean;
  emptyMessage: string;
}) {
  // Distinguish "nothing here yet" from "nothing matched your search".
  if (empty) return <p className="empty">{emptyMessage}</p>;
  if (tunes.length === 0) return <p className="empty">No tunes match.</p>;

  return (
    <ul className="list">
      {tunes.map((tune) => (
        <li key={tune.id}>
          <Link href={`/tunes/${tune.id}`} className="item">
            <div className="title">{tune.title}</div>
            <div className="meta">
              {[tune.type, tune.key].filter(Boolean).join(" · ")}
              {tune.alternateTitles.length > 0 && ` · aka ${tune.alternateTitles[0]}`}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SetList({ sets, tunes, empty }: { sets: TuneSet[]; tunes: Tune[]; empty: boolean }) {
  const titlesById = useMemo(() => new Map(tunes.map((tune) => [tune.id, tune.title])), [tunes]);

  if (empty) return <p className="empty">No sets yet. Sign in to build one.</p>;
  if (sets.length === 0) return <p className="empty">No sets match.</p>;

  return (
    <ul className="list">
      {sets.map((set) => (
        <li key={set.id}>
          <Link href={`/sets/${set.id}`} className="item">
            <div className="title">{set.name}</div>
            <div className="meta">
              {set.tuneIds.map((id) => titlesById.get(id) ?? "?").join(" → ") || "Empty set"}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
