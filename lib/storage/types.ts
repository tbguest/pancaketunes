/**
 * The storage contract. Two implementations satisfy it: `github.ts` (production)
 * and `local.ts` (development, writes straight to the working tree). Everything
 * above this layer is unaware of which one is in play.
 */

export type RawFile = {
  /** File name without the .json extension — this is the record id. */
  name: string;
  text: string;
  /** Git blob sha, used for optimistic-concurrency checks on write. */
  sha: string;
};

export type Collection = "tunes" | "sets";

export interface StorageAdapter {
  readonly kind: "github" | "local";
  /** Reads every tune and set in one shot. */
  readAll(): Promise<Record<Collection, RawFile[]>>;
  /** Creates or updates a file. Omit `sha` to create; pass it to update. */
  write(
    collection: Collection,
    id: string,
    text: string,
    sha: string | undefined,
    message: string,
  ): Promise<void>;
  remove(collection: Collection, id: string, sha: string, message: string): Promise<void>;
}

export function filePath(collection: Collection, id: string): string {
  return `data/${collection}/${id}.json`;
}
