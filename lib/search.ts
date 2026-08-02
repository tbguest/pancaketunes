import type { Tune, TuneSet } from "./types";

/**
 * Search runs entirely in the browser. The whole repertoire ships with the
 * page (a few hundred tunes is tens of kilobytes), so filtering is synchronous
 * and there is no network round-trip between keystroke and result — which is
 * the point when someone is looking a tune up mid-session.
 *
 * If the collection ever grows past a few thousand tunes, swap the linear scan
 * here for a prebuilt index; nothing outside this module needs to change.
 */

/** Lowercase, strip accents, collapse punctuation. "Ó Riada's" -> "o riadas". */
function normalise(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Sort key that ignores a leading article, the way tune books and
 * thesession.org do — otherwise half the repertoire files under "The".
 */
export function collationKey(title: string): string {
  return normalise(title).replace(/^(the|a|an) /, "");
}

export type Searchable<T> = { record: T; haystack: string; sortKey: string };

function indexed<T>(record: T, sortKey: string, parts: Array<string | undefined>): Searchable<T> {
  return {
    record,
    haystack: normalise(parts.filter(Boolean).join(" ")),
    sortKey: normalise(sortKey),
  };
}

export function indexTunes(tunes: Tune[]): Searchable<Tune>[] {
  return tunes.map((tune) =>
    indexed(tune, tune.title, [
      tune.title,
      ...tune.alternateTitles,
      tune.type,
      tune.key,
      tune.composer,
      tune.notes,
      ...tune.tags,
    ]),
  );
}

/**
 * Sets are searchable by the titles of the tunes they contain, so "cooleys"
 * finds the set that opens with it.
 */
export function indexSets(sets: TuneSet[], tunes: Tune[]): Searchable<TuneSet>[] {
  const titlesById = new Map(tunes.map((tune) => [tune.id, tune.title]));
  return sets.map((set) =>
    indexed(set, set.name, [
      set.name,
      set.description,
      set.notes,
      ...set.tags,
      ...set.tuneIds.map((id) => titlesById.get(id) ?? ""),
    ]),
  );
}

/**
 * Every whitespace-separated token must appear. Records whose own title starts
 * with the query float to the top, so typing "kes" puts "The Kesh" first.
 */
export function search<T>(items: Searchable<T>[], query: string): T[] {
  const normalised = normalise(query);
  if (!normalised) return items.map((item) => item.record);

  const tokens = normalised.split(" ");
  const matches: Array<{ record: T; rank: number }> = [];

  for (const item of items) {
    if (!tokens.every((token) => item.haystack.includes(token))) continue;

    const rank = item.sortKey.startsWith(normalised)
      ? 0
      : item.sortKey.includes(normalised)
        ? 1
        : 2;
    matches.push({ record: item.record, rank });
  }

  // Stable sort keeps the alphabetical order the server sent within each rank.
  return matches.sort((a, b) => a.rank - b.rank).map((match) => match.record);
}
