import "server-only";
import { cache } from "react";
import { setSchema, tuneSchema } from "./schema";
import { collationKey } from "./search";
import { getStorage } from "./storage";
import type { RawFile } from "./storage";
import type { ResolvedSet, Stored, Tune, TuneSet } from "./types";

/**
 * Read layer. Two levels of caching:
 *
 *  1. `cache()` dedupes reads within a single render pass.
 *  2. A module-level TTL cache survives across requests in a warm serverless
 *     instance, so a browsing session costs roughly one GitHub call per minute.
 *     Mutations call `invalidateData()` so the editor always sees its own write.
 */

const TTL_MS = 60_000;

export type Dataset = {
  tunes: Stored<Tune>[];
  sets: Stored<TuneSet>[];
  /** Files that failed validation — surfaced in the UI rather than silently dropped. */
  problems: string[];
};

let snapshot: { data: Dataset; expiresAt: number } | null = null;

export function invalidateData(): void {
  snapshot = null;
}

function parseCollection<T>(
  files: RawFile[],
  schema: { safeParse: (v: unknown) => { success: boolean; data?: unknown; error?: unknown } },
  label: string,
  problems: string[],
): Stored<T>[] {
  const records: Stored<T>[] = [];

  for (const file of files) {
    let json: unknown;
    try {
      json = JSON.parse(file.text);
    } catch {
      problems.push(`${label}/${file.name}.json is not valid JSON`);
      continue;
    }

    // The filename is authoritative for the id, so a renamed file can never
    // drift from the id stored inside it.
    const result = schema.safeParse({ ...(json as object), id: file.name });
    if (!result.success) {
      problems.push(`${label}/${file.name}.json failed validation`);
      continue;
    }

    records.push({ ...(result.data as T), _sha: file.sha });
  }

  return records;
}

async function loadDataset(): Promise<Dataset> {
  const now = Date.now();
  if (snapshot && snapshot.expiresAt > now) return snapshot.data;

  const raw = await getStorage().readAll();
  const problems: string[] = [];

  const tunes = parseCollection<Tune>(raw.tunes, tuneSchema, "tunes", problems);
  const sets = parseCollection<TuneSet>(raw.sets, setSchema, "sets", problems);

  tunes.sort((a, b) => collationKey(a.title).localeCompare(collationKey(b.title)));
  sets.sort((a, b) => collationKey(a.name).localeCompare(collationKey(b.name)));

  const data: Dataset = { tunes, sets, problems };
  snapshot = { data, expiresAt: now + TTL_MS };
  return data;
}

export const getDataset = cache(loadDataset);

export async function getTunes(): Promise<Stored<Tune>[]> {
  return (await getDataset()).tunes;
}

export async function getSets(): Promise<Stored<TuneSet>[]> {
  return (await getDataset()).sets;
}

export async function getTune(id: string): Promise<Stored<Tune> | null> {
  const { tunes } = await getDataset();
  return tunes.find((tune) => tune.id === id) ?? null;
}

export async function getSet(id: string): Promise<Stored<TuneSet> | null> {
  const { sets } = await getDataset();
  return sets.find((set) => set.id === id) ?? null;
}

/** A set plus its tunes, in order. Deleted tunes resolve to `null` so the UI can flag them. */
export async function getResolvedSet(id: string): Promise<ResolvedSet | null> {
  const { tunes, sets } = await getDataset();
  const set = sets.find((s) => s.id === id);
  if (!set) return null;

  const byId = new Map(tunes.map((tune) => [tune.id, tune as Tune]));
  return {
    ...set,
    tunes: set.tuneIds.map((tuneId) => ({ id: tuneId, tune: byId.get(tuneId) ?? null })),
  };
}

/** Sets that contain a given tune — shown on the tune detail page. */
export async function getSetsContaining(tuneId: string): Promise<TuneSet[]> {
  const { sets } = await getDataset();
  return sets.filter((set) => set.tuneIds.includes(tuneId));
}

export async function getAllTags(): Promise<string[]> {
  const { tunes, sets } = await getDataset();
  const tags = new Set<string>();
  for (const record of [...tunes, ...sets]) record.tags.forEach((tag) => tags.add(tag));
  return [...tags].sort();
}
