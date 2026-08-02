"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { indexSets, indexTunes, search } from "@/lib/search";
import { TUNE_TYPES, type Tune, type TuneSet, type TuneType } from "@/lib/types";

/**
 * The home screen: one search box, two tabs, one column. All filtering is
 * client-side against data embedded in the page, so results update as fast as
 * the user can type.
 */

type View = "tunes" | "sets";

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

  const tuneIndex = useMemo(() => indexTunes(tunes), [tunes]);
  const setIndex = useMemo(() => indexSets(sets, tunes), [sets, tunes]);

  const matchedTunes = useMemo(() => {
    const found = search(tuneIndex, deferredQuery);
    return type === "all" ? found : found.filter((tune) => tune.type === type);
  }, [tuneIndex, deferredQuery, type]);

  const matchedSets = useMemo(() => search(setIndex, deferredQuery), [setIndex, deferredQuery]);

  // Only offer filters for types actually present in the repertoire.
  const availableTypes = useMemo(() => {
    const present = new Set(tunes.map((tune) => tune.type));
    return TUNE_TYPES.filter((candidate) => present.has(candidate));
  }, [tunes]);

  const showing = view === "tunes" ? matchedTunes.length : matchedSets.length;

  return (
    <div className="stack">
      <input
        className="search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={view === "tunes" ? "Search tunes…" : "Search sets…"}
        aria-label={view === "tunes" ? "Search tunes" : "Search sets"}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
      />

      <div className="tabs" role="tablist">
        <a
          role="tab"
          href="#"
          aria-current={view === "tunes" ? "page" : undefined}
          aria-selected={view === "tunes"}
          onClick={(event) => {
            event.preventDefault();
            setView("tunes");
          }}
        >
          Tunes ({matchedTunes.length})
        </a>
        <a
          role="tab"
          href="#"
          aria-current={view === "sets" ? "page" : undefined}
          aria-selected={view === "sets"}
          onClick={(event) => {
            event.preventDefault();
            setView("sets");
          }}
        >
          Sets ({matchedSets.length})
        </a>
      </div>

      {view === "tunes" && availableTypes.length > 1 && (
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
        {showing} {view === "tunes" ? "tune" : "set"}
        {showing === 1 ? "" : "s"}
      </div>

      {view === "tunes" ? (
        <TuneList tunes={matchedTunes} empty={tunes.length === 0} />
      ) : (
        <SetList sets={matchedSets} tunes={tunes} empty={sets.length === 0} />
      )}

      {canEdit && (
        <Link
          href={view === "tunes" ? "/tunes/new" : "/sets/new"}
          className="btn btn-secondary btn-block"
        >
          + New {view === "tunes" ? "tune" : "set"}
        </Link>
      )}
    </div>
  );
}

function TuneList({ tunes, empty }: { tunes: Tune[]; empty: boolean }) {
  // Distinguish "nothing here yet" from "nothing matched your search".
  if (empty) return <p className="empty">No tunes yet. Sign in to add the first one.</p>;
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
