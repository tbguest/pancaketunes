/**
 * Core domain types.
 *
 * Everything persisted lives in `/data` as one JSON file per record. The `_sha`
 * field is *not* persisted — it is the git blob sha attached at read time and
 * handed back on write so GitHub can reject stale updates (see lib/storage).
 */

export const TUNE_TYPES = [
  "reel",
  "jig",
  "slip jig",
  "slide",
  "hornpipe",
  "polka",
  "march",
  "waltz",
  "mazurka",
  "barndance",
  "strathspey",
  "air",
  "song",
  "other",
] as const;

export type TuneType = (typeof TUNE_TYPES)[number];

export type Link = {
  label: string;
  url: string;
};

export type Tune = {
  id: string;
  title: string;
  alternateTitles: string[];
  type: TuneType;
  key: string;
  composer?: string;
  notes?: string;
  tags: string[];
  links: Link[];
  abc?: string;
  sheetMusicUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type TuneSet = {
  id: string;
  name: string;
  description?: string;
  tuneIds: string[];
  notes?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

/** A record as loaded from storage, carrying its git blob sha. */
export type Stored<T> = T & { _sha: string };

/**
 * Drops the git sha before handing a record to a client component — only the
 * edit forms need it, and it has no business in the browse payload.
 */
export function withoutSha<T extends object>(record: Stored<T>): T {
  const { _sha: _ignored, ...rest } = record;
  return rest as T;
}

/** A set with its tune references resolved. Missing ids surface as `null`. */
export type ResolvedSet = TuneSet & {
  tunes: Array<{ id: string; tune: Tune | null }>;
};
