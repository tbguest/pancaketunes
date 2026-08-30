"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession, UnauthorizedError } from "./auth/session";
import { getDataset, invalidateData } from "./data";
import { linesToArray, linesToLinks, tagsToArray } from "./form";
import { formatZodError, setSchema, tuneSchema } from "./schema";
import { ConflictError, getStorage } from "./storage";
import { slugify, uniqueSlug } from "./slug";
import { TUNE_STATUSES, TUNE_TYPES, type TuneStatus, type TuneType } from "./types";

/**
 * Every mutation funnels through here. The shape is always the same:
 * authorise -> parse -> validate -> commit -> invalidate -> redirect.
 *
 * Errors come back as form state rather than thrown exceptions so the editor
 * can keep the user's typing on screen.
 */

export type FormState = {
  error?: string;
  /**
   * The raw submitted fields, echoed back on failure. React resets uncontrolled
   * inputs to their `defaultValue` once a form action settles, so the forms bind
   * `defaultValue` to these — that turns the reset into a restore and the user
   * keeps their typing when a save is rejected.
   */
  values?: Record<string, string>;
};

const EMPTY: FormState = {};

function echo(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

/** JSON written to the repo: stable key order, trailing newline, no `_sha`. */
function serialise(record: Record<string, unknown>): string {
  const { _sha: _ignored, ...rest } = record;
  return `${JSON.stringify(rest, null, 2)}\n`;
}

function describe(error: unknown): string {
  if (error instanceof UnauthorizedError) return error.message;
  if (error instanceof ConflictError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

/**
 * Wraps an action body so thrown errors become form state. Next signals
 * redirects by throwing, so those must be re-thrown untouched.
 */
async function run(formData: FormData, body: () => Promise<never | void>): Promise<FormState> {
  try {
    await body();
    return EMPTY;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest: unknown }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_")
    ) {
      throw error;
    }
    return { error: describe(error), values: echo(formData) };
  }
}

function refreshRoutes() {
  invalidateData();
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------- tunes

function readStatus(formData: FormData): TuneStatus {
  const status = String(formData.get("status") ?? "");
  return (TUNE_STATUSES as readonly string[]).includes(status)
    ? (status as TuneStatus)
    : "repertoire";
}

function parseTuneForm(formData: FormData) {
  const type = String(formData.get("type") ?? "");
  return {
    title: String(formData.get("title") ?? "").trim(),
    alternateTitles: linesToArray(formData.get("alternateTitles")),
    type: (TUNE_TYPES as readonly string[]).includes(type) ? (type as TuneType) : "other",
    key: String(formData.get("key") ?? "").trim(),
    status: readStatus(formData),
    composer: String(formData.get("composer") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    tags: tagsToArray(formData.get("tags")),
    links: linesToLinks(formData.get("links")),
    abc: String(formData.get("abc") ?? ""),
    accompaniment: String(formData.get("accompaniment") ?? ""),
    sheetMusicUrl: String(formData.get("sheetMusicUrl") ?? ""),
  };
}

export async function createTune(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(formData, async () => {
    await requireSession();

    const input = parseTuneForm(formData);
    const { tunes } = await getDataset();
    const id = uniqueSlug(slugify(input.title), new Set(tunes.map((tune) => tune.id)));
    const now = new Date().toISOString();

    const parsed = tuneSchema.safeParse({ ...input, id, createdAt: now, updatedAt: now });
    if (!parsed.success) throw new Error(formatZodError(parsed.error));

    await getStorage().write(
      "tunes",
      id,
      serialise(parsed.data),
      undefined,
      parsed.data.status === "backlog"
        ? `Add backlog tune: ${parsed.data.title}`
        : `Add tune: ${parsed.data.title}`,
    );

    refreshRoutes();
    redirect(`/tunes/${id}`);
  });
}

export async function updateTune(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(formData, async () => {
    await requireSession();

    const id = String(formData.get("id") ?? "");
    const sha = String(formData.get("sha") ?? "");
    const { tunes } = await getDataset();
    const existing = tunes.find((tune) => tune.id === id);
    if (!existing) throw new Error("That tune no longer exists.");

    const input = parseTuneForm(formData);
    const parsed = tuneSchema.safeParse({
      ...input,
      id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    });
    if (!parsed.success) throw new Error(formatZodError(parsed.error));

    await getStorage().write(
      "tunes",
      id,
      serialise(parsed.data),
      sha,
      `Update tune: ${parsed.data.title}`,
    );

    refreshRoutes();
    redirect(`/tunes/${id}`);
  });
}

export async function deleteTune(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(formData, async () => {
    await requireSession();

    const id = String(formData.get("id") ?? "");
    const { tunes } = await getDataset();
    const existing = tunes.find((tune) => tune.id === id);
    if (!existing) throw new Error("That tune no longer exists.");

    await getStorage().remove("tunes", id, existing._sha, `Delete tune: ${existing.title}`);

    refreshRoutes();
    redirect(existing.status === "backlog" ? "/?view=backlog" : "/");
  });
}

/**
 * Move a tune between the setlist and the backlog without opening the editor —
 * one tap is the whole point, since promoting a tune is what the backlog is for.
 */
export async function moveTune(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(formData, async () => {
    await requireSession();

    const id = String(formData.get("id") ?? "");
    const { tunes } = await getDataset();
    const existing = tunes.find((tune) => tune.id === id);
    if (!existing) throw new Error("That tune no longer exists.");

    const status = readStatus(formData);
    const parsed = tuneSchema.safeParse({
      ...existing,
      status,
      updatedAt: new Date().toISOString(),
    });
    if (!parsed.success) throw new Error(formatZodError(parsed.error));

    await getStorage().write(
      "tunes",
      id,
      serialise(parsed.data),
      existing._sha,
      status === "backlog"
        ? `Move tune to backlog: ${parsed.data.title}`
        : `Move tune to repertoire: ${parsed.data.title}`,
    );

    refreshRoutes();
  });
}

// ----------------------------------------------------------------- sets

function parseSetForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? ""),
    // The set editor submits the ordered tune list as one hidden comma-separated field.
    tuneIds: String(formData.get("tuneIds") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    notes: String(formData.get("notes") ?? ""),
    tags: tagsToArray(formData.get("tags")),
  };
}

export async function createSet(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(formData, async () => {
    await requireSession();

    const input = parseSetForm(formData);
    const { sets } = await getDataset();
    const id = uniqueSlug(slugify(input.name), new Set(sets.map((set) => set.id)));
    const now = new Date().toISOString();

    const parsed = setSchema.safeParse({ ...input, id, createdAt: now, updatedAt: now });
    if (!parsed.success) throw new Error(formatZodError(parsed.error));

    await getStorage().write(
      "sets",
      id,
      serialise(parsed.data),
      undefined,
      `Add set: ${parsed.data.name}`,
    );

    refreshRoutes();
    redirect(`/sets/${id}`);
  });
}

export async function updateSet(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(formData, async () => {
    await requireSession();

    const id = String(formData.get("id") ?? "");
    const sha = String(formData.get("sha") ?? "");
    const { sets } = await getDataset();
    const existing = sets.find((set) => set.id === id);
    if (!existing) throw new Error("That set no longer exists.");

    const input = parseSetForm(formData);
    const parsed = setSchema.safeParse({
      ...input,
      id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    });
    if (!parsed.success) throw new Error(formatZodError(parsed.error));

    await getStorage().write(
      "sets",
      id,
      serialise(parsed.data),
      sha,
      `Update set: ${parsed.data.name}`,
    );

    refreshRoutes();
    redirect(`/sets/${id}`);
  });
}

export async function deleteSet(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(formData, async () => {
    await requireSession();

    const id = String(formData.get("id") ?? "");
    const { sets } = await getDataset();
    const existing = sets.find((set) => set.id === id);
    if (!existing) throw new Error("That set no longer exists.");

    await getStorage().remove("sets", id, existing._sha, `Delete set: ${existing.name}`);

    refreshRoutes();
    redirect("/?view=sets");
  });
}
