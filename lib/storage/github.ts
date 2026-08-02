import "server-only";
import {
  ConflictError,
  type GitHubConfig,
  graphqlRequest,
  restRequest,
} from "../github/client";
import { type Collection, filePath, type RawFile, type StorageAdapter } from "./types";

/**
 * One GraphQL round-trip pulls the text of every tune and set file. This is the
 * whole reason the app can keep a file-per-record layout (great git history)
 * without paying an HTTP request per tune.
 */
const READ_ALL_QUERY = `
  query ReadAll($owner: String!, $repo: String!, $tunesRef: String!, $setsRef: String!) {
    repository(owner: $owner, name: $repo) {
      tunes: object(expression: $tunesRef) {
        ... on Tree {
          entries { name type object { ... on Blob { oid text } } }
        }
      }
      sets: object(expression: $setsRef) {
        ... on Tree {
          entries { name type object { ... on Blob { oid text } } }
        }
      }
    }
  }
`;

type TreeEntry = {
  name: string;
  type: string;
  object: { oid: string; text: string | null } | null;
};

type ReadAllResponse = {
  repository: {
    tunes: { entries?: TreeEntry[] } | null;
    sets: { entries?: TreeEntry[] } | null;
  } | null;
};

function toRawFiles(tree: { entries?: TreeEntry[] } | null): RawFile[] {
  if (!tree?.entries) return [];
  return tree.entries
    .filter((entry) => entry.type === "blob" && entry.name.endsWith(".json"))
    .filter((entry): entry is TreeEntry & { object: { oid: string; text: string } } =>
      typeof entry.object?.text === "string",
    )
    .map((entry) => ({
      name: entry.name.replace(/\.json$/, ""),
      text: entry.object.text,
      sha: entry.object.oid,
    }));
}

export function createGitHubAdapter(config: GitHubConfig): StorageAdapter {
  async function commit(
    method: "PUT" | "DELETE",
    collection: Collection,
    id: string,
    message: string,
    body: Record<string, unknown>,
  ) {
    const path = filePath(collection, id);
    await restRequest(config, `/repos/${config.owner}/${config.repo}/contents/${path}`, {
      method,
      body: JSON.stringify({ message, branch: config.branch, ...body }),
    });
  }

  return {
    kind: "github",

    async readAll() {
      const data = await graphqlRequest<ReadAllResponse>(config, READ_ALL_QUERY, {
        owner: config.owner,
        repo: config.repo,
        tunesRef: `${config.branch}:data/tunes`,
        setsRef: `${config.branch}:data/sets`,
      });

      if (!data.repository) {
        throw new Error(
          `Repository ${config.owner}/${config.repo} not found, or the token cannot read it.`,
        );
      }

      return {
        tunes: toRawFiles(data.repository.tunes),
        sets: toRawFiles(data.repository.sets),
      };
    },

    async write(collection, id, text, sha, message) {
      try {
        await commit("PUT", collection, id, message, {
          content: Buffer.from(text, "utf8").toString("base64"),
          ...(sha ? { sha } : {}),
        });
      } catch (error) {
        // Creating a file that already exists comes back as 422, which our
        // client maps to ConflictError. Give it a clearer message.
        if (error instanceof ConflictError && !sha) {
          throw new ConflictError("Something with that id already exists. Try a different title.");
        }
        throw error;
      }
    },

    async remove(collection, id, sha, message) {
      await commit("DELETE", collection, id, message, { sha });
    },
  };
}
