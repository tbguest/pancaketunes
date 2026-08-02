import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { ConflictError } from "../github/client";
import { type Collection, type RawFile, type StorageAdapter } from "./types";

/**
 * Development adapter: reads and writes `/data` in the working tree so the app
 * is fully usable with no GitHub token. It computes real git blob shas, so
 * conflict handling behaves exactly the same as in production.
 */

const DATA_DIR = path.join(process.cwd(), "data");

function blobSha(text: string): string {
  const body = Buffer.from(text, "utf8");
  return createHash("sha1")
    .update(`blob ${body.length}\0`)
    .update(body)
    .digest("hex");
}

async function readCollection(collection: Collection): Promise<RawFile[]> {
  const dir = path.join(DATA_DIR, collection);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const files = await Promise.all(
    entries
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => {
        const text = await readFile(path.join(dir, name), "utf8");
        return { name: name.replace(/\.json$/, ""), text, sha: blobSha(text) };
      }),
  );

  return files;
}

export function createLocalAdapter(): StorageAdapter {
  return {
    kind: "local",

    async readAll() {
      const [tunes, sets] = await Promise.all([readCollection("tunes"), readCollection("sets")]);
      return { tunes, sets };
    },

    async write(collection, id, text, sha) {
      const dir = path.join(DATA_DIR, collection);
      await mkdir(dir, { recursive: true });
      const file = path.join(dir, `${id}.json`);

      let existing: string | null = null;
      try {
        existing = await readFile(file, "utf8");
      } catch {
        existing = null;
      }

      if (!sha && existing !== null) {
        throw new ConflictError("Something with that id already exists. Try a different title.");
      }
      if (sha && existing !== null && blobSha(existing) !== sha) {
        throw new ConflictError();
      }

      await writeFile(file, text, "utf8");
    },

    async remove(collection, id, sha) {
      const file = path.join(DATA_DIR, collection, `${id}.json`);
      const existing = await readFile(file, "utf8").catch(() => null);
      if (existing !== null && blobSha(existing) !== sha) {
        throw new ConflictError();
      }
      await rm(file, { force: true });
    },
  };
}
