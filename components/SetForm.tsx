"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import type { FormState } from "@/lib/actions";
import { indexTunes, search } from "@/lib/search";
import type { Stored, Tune, TuneSet } from "@/lib/types";
import { SubmitButton } from "./SubmitButton";

/**
 * Set editor. The ordered tune list is held in React state and submitted as a
 * single hidden comma-separated field, which keeps the server action's parsing
 * trivial and avoids fighting with FormData array encoding.
 */
export function SetForm({
  action,
  tunes,
  set,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  tunes: Tune[];
  set?: Stored<TuneSet>;
}) {
  const [state, formAction] = useActionState(action, {});
  const [picked, setPicked] = useState<string[]>(set?.tuneIds ?? []);
  const [query, setQuery] = useState("");

  const byId = useMemo(() => new Map(tunes.map((tune) => [tune.id, tune])), [tunes]);
  const index = useMemo(() => indexTunes(tunes), [tunes]);

  // Only offer results once the user types, so the picker isn't a wall of tunes.
  const candidates = useMemo(() => {
    if (!query.trim()) return [];
    return search(index, query).slice(0, 8);
  }, [index, query]);

  function add(id: string) {
    // A tune can legitimately appear twice in a set (e.g. returning to the
    // first tune at the end), so duplicates are allowed.
    setPicked((current) => [...current, id]);
    setQuery("");
  }

  function move(from: number, to: number) {
    setPicked((current) => {
      if (to < 0 || to >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function remove(index: number) {
    setPicked((current) => current.filter((_, i) => i !== index));
  }

  return (
    <form action={formAction} className="stack">
      {set && (
        <>
          <input type="hidden" name="id" value={set.id} />
          <input type="hidden" name="sha" value={set._sha} />
        </>
      )}
      <input type="hidden" name="tuneIds" value={picked.join(",")} />

      {state.error && (
        <p className="notice" role="alert">
          {state.error}
        </p>
      )}

      <div className="field">
        <label htmlFor="name">Set name</label>
        <input
          id="name"
          name="name"
          defaultValue={state.values?.name ?? set?.name}
          required
          autoComplete="off"
          autoFocus={!set}
        />
      </div>

      <div className="field">
        <label htmlFor="description">Description</label>
        <input
          id="description"
          name="description"
          defaultValue={state.values?.description ?? set?.description}
          placeholder="How we usually open"
          autoComplete="off"
        />
      </div>

      <div className="field">
        <label id="tunes-label">Tunes in order</label>
        {picked.length === 0 ? (
          <span className="hint">Nothing added yet — search below.</span>
        ) : (
          <ul className="picked" aria-labelledby="tunes-label">
            {picked.map((id, index) => (
              <li key={`${id}-${index}`}>
                <span className="name">{byId.get(id)?.title ?? `Missing: ${id}`}</span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => move(index, index - 1)}
                  disabled={index === 0}
                  aria-label={`Move ${byId.get(id)?.title ?? id} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => move(index, index + 1)}
                  disabled={index === picked.length - 1}
                  aria-label={`Move ${byId.get(id)?.title ?? id} down`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => remove(index)}
                  aria-label={`Remove ${byId.get(id)?.title ?? id}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="field">
        <label htmlFor="tune-search">Add a tune</label>
        <input
          id="tune-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tunes…"
          autoComplete="off"
          spellCheck={false}
          // Enter picks the top result instead of submitting the whole form.
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (candidates[0]) add(candidates[0].id);
            }
          }}
        />
        {candidates.length > 0 && (
          <ul className="picked">
            {candidates.map((tune) => (
              <li key={tune.id}>
                <span className="name">{tune.title}</span>
                <span className="meta">{tune.type}</span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => add(tune.id)}
                  aria-label={`Add ${tune.title}`}
                >
                  +
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="field">
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" defaultValue={state.values?.notes ?? set?.notes} rows={3} />
      </div>

      <div className="field">
        <label htmlFor="tags">Tags</label>
        <span className="hint">Comma separated.</span>
        <input
          id="tags"
          name="tags"
          defaultValue={state.values?.tags ?? set?.tags.join(", ")}
          autoComplete="off"
        />
      </div>

      <div className="actions">
        <SubmitButton>{set ? "Save changes" : "Add set"}</SubmitButton>
        <Link href={set ? `/sets/${set.id}` : "/?view=sets"} className="btn btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
