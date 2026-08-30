"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/lib/actions";
import { linksToLines } from "@/lib/form";
import { TUNE_TYPES, type Stored, type Tune, type TuneStatus } from "@/lib/types";
import { SubmitButton } from "./SubmitButton";

/**
 * One form for both create and edit — the only difference is whether `tune` is
 * supplied and, on edit, the hidden id/sha pair that lets the server detect a
 * concurrent change.
 *
 * List-ish fields are plain textareas (one item per line) rather than dynamic
 * row builders: fewer taps, and it degrades gracefully on a phone.
 */
export function TuneForm({
  action,
  tune,
  defaultStatus = "repertoire",
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  tune?: Stored<Tune>;
  /** Preselected on a new tune, so "add to backlog" lands on the right setting. */
  defaultStatus?: TuneStatus;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="stack">
      {tune && (
        <>
          <input type="hidden" name="id" value={tune.id} />
          <input type="hidden" name="sha" value={tune._sha} />
        </>
      )}

      {state.error && (
        <p className="notice" role="alert">
          {state.error}
        </p>
      )}

      <div className="field">
        <label htmlFor="title">Title</label>
        <input
          id="title"
          name="title"
          defaultValue={state.values?.title ?? tune?.title}
          required
          autoComplete="off"
          autoFocus={!tune}
        />
      </div>

      <div className="field">
        <label htmlFor="type">Type</label>
        <select id="type" name="type" defaultValue={state.values?.type ?? tune?.type ?? "reel"}>
          {TUNE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="key">Key</label>
        <input
          id="key"
          name="key"
          defaultValue={state.values?.key ?? tune?.key}
          placeholder="D major, Ador, Em…"
          autoComplete="off"
        />
      </div>

      <div className="field">
        <label htmlFor="status">Status</label>
        <span className="hint">The backlog is for tunes the group hasn’t taken up yet.</span>
        <select
          id="status"
          name="status"
          defaultValue={state.values?.status ?? tune?.status ?? defaultStatus}
        >
          <option value="repertoire">In the setlist</option>
          <option value="backlog">Backlog</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="alternateTitles">Other titles</label>
        <span className="hint">One per line.</span>
        <textarea
          id="alternateTitles"
          name="alternateTitles"
          defaultValue={state.values?.alternateTitles ?? tune?.alternateTitles.join("\n")}
          rows={2}
        />
      </div>

      <div className="field">
        <label htmlFor="composer">Composer</label>
        <input
          id="composer"
          name="composer"
          defaultValue={state.values?.composer ?? tune?.composer}
          placeholder="Trad."
          autoComplete="off"
        />
      </div>

      <div className="field">
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" defaultValue={state.values?.notes ?? tune?.notes} rows={3} />
      </div>

      <div className="field">
        <label htmlFor="tags">Tags</label>
        <span className="hint">Comma separated.</span>
        <input
          id="tags"
          name="tags"
          defaultValue={state.values?.tags ?? tune?.tags.join(", ")}
          placeholder="session, learning, dad"
          autoComplete="off"
        />
      </div>

      <div className="field">
        <label htmlFor="links">Recordings</label>
        <span className="hint">
          One per line. Either a URL, or <code>Label | URL</code>.
        </span>
        <textarea
          id="links"
          name="links"
          defaultValue={state.values?.links ?? (tune ? linksToLines(tune.links) : "")}
          rows={3}
          placeholder="Bothy Band | https://youtube.com/watch?v=…"
          spellCheck={false}
        />
      </div>

      <div className="field">
        <label htmlFor="sheetMusicUrl">Sheet music link</label>
        <input
          id="sheetMusicUrl"
          name="sheetMusicUrl"
          type="url"
          defaultValue={state.values?.sheetMusicUrl ?? tune?.sheetMusicUrl}
          placeholder="https://…"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className="field">
        <label htmlFor="abc">ABC notation</label>
        <textarea
          id="abc"
          name="abc"
          className="code"
          defaultValue={state.values?.abc ?? tune?.abc}
          rows={6}
          spellCheck={false}
        />
      </div>

      <div className="field">
        <label htmlFor="accompaniment">Accompaniment</label>
        <span className="hint">Chord progressions, backup patterns, etc.</span>
        <textarea
          id="accompaniment"
          name="accompaniment"
          className="code"
          defaultValue={state.values?.accompaniment ?? tune?.accompaniment}
          rows={6}
          spellCheck={false}
          placeholder={"A: G · C · G · D\nB: Em · C · G · D"}
        />
      </div>

      <div className="actions">
        <SubmitButton>{tune ? "Save changes" : "Add tune"}</SubmitButton>
        <Link href={tune ? `/tunes/${tune.id}` : "/"} className="btn btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
