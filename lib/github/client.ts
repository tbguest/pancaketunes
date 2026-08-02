import "server-only";

/**
 * Thin GitHub API wrapper. Nothing in here is ever imported by a client
 * component — `server-only` makes that a build error rather than a leak.
 */

export type GitHubConfig = {
  token: string;
  owner: string;
  repo: string;
  branch: string;
};

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

/** Thrown when a write is rejected because the file changed underneath us. */
export class ConflictError extends Error {
  constructor(message = "This item was changed by someone else. Refresh and try again.") {
    super(message);
    this.name = "ConflictError";
  }
}

let cachedConfig: GitHubConfig | null | undefined;

/**
 * Returns null when GitHub isn't configured, which is the signal to fall back
 * to the local filesystem adapter during development.
 */
export function getGitHubConfig(): GitHubConfig | null {
  if (cachedConfig !== undefined) return cachedConfig;

  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;

  if (!token || !repository) {
    cachedConfig = null;
    return null;
  }

  const [owner, repo] = repository.split("/");
  if (!owner || !repo) {
    throw new Error(`GITHUB_REPOSITORY must look like "owner/repo", got "${repository}"`);
  }

  cachedConfig = { token, owner, repo, branch: process.env.GITHUB_BRANCH || "main" };
  return cachedConfig;
}

function headers(config: GitHubConfig) {
  return {
    Authorization: `Bearer ${config.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

export async function restRequest<T>(
  config: GitHubConfig,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { ...headers(config), ...(init.headers ?? {}) },
    // Data freshness is managed by our own cache in lib/data.ts.
    cache: "no-store",
  });

  if (response.status === 409 || response.status === 422) {
    throw new ConflictError();
  }

  if (!response.ok) {
    const body = await response.text();
    throw new GitHubError(
      `GitHub ${init.method ?? "GET"} ${path} failed (${response.status}): ${body.slice(0, 300)}`,
      response.status,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function graphqlRequest<T>(
  config: GitHubConfig,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: headers(config),
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new GitHubError(
      `GitHub GraphQL failed (${response.status}): ${body.slice(0, 300)}`,
      response.status,
    );
  }

  const payload = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (payload.errors?.length) {
    throw new GitHubError(
      `GitHub GraphQL error: ${payload.errors.map((e) => e.message).join("; ")}`,
      500,
    );
  }
  if (!payload.data) throw new GitHubError("GitHub GraphQL returned no data", 500);

  return payload.data;
}
