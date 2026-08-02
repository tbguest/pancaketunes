import "server-only";
import { getGitHubConfig } from "../github/client";
import { createGitHubAdapter } from "./github";
import { createLocalAdapter } from "./local";
import type { StorageAdapter } from "./types";

export { ConflictError } from "../github/client";
export type { Collection, RawFile, StorageAdapter } from "./types";

let adapter: StorageAdapter | undefined;

/**
 * Picks the adapter once per process: GitHub when credentials are present,
 * otherwise the local filesystem. Set `GITHUB_TOKEN` + `GITHUB_REPOSITORY` in
 * `.env.local` to exercise the real thing locally.
 */
export function getStorage(): StorageAdapter {
  if (!adapter) {
    const config = getGitHubConfig();
    adapter = config ? createGitHubAdapter(config) : createLocalAdapter();
  }
  return adapter;
}
