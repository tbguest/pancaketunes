import { z } from "zod";
import { TUNE_TYPES } from "./types";

/**
 * Zod is the single source of truth for what a valid record looks like. Both
 * the form handlers and the storage reader run data through these schemas, so a
 * hand-edited JSON file in the repo is validated the same way a form submission
 * is.
 *
 * To extend the schema: add an optional field here with a sensible default and
 * every existing JSON file stays valid.
 */

const idSchema = z
  .string()
  .min(1, "Missing id")
  .regex(/^[a-z0-9-]+$/, "Ids may only contain lowercase letters, numbers and dashes");

const linkSchema = z.object({
  label: z.string().trim().default(""),
  url: z.string().trim().url("Recording links must be full URLs (https://...)"),
});

/** Blank strings from form inputs should become "absent", not "". */
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

export const tuneSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1, "A tune needs a title"),
  alternateTitles: z.array(z.string().trim().min(1)).default([]),
  type: z.enum(TUNE_TYPES),
  key: z.string().trim().default(""),
  composer: optionalText,
  notes: optionalText,
  tags: z.array(z.string().trim().min(1)).default([]),
  links: z.array(linkSchema).default([]),
  abc: optionalText,
  sheetMusicUrl: optionalText.refine(
    (v) => v === undefined || /^https?:\/\//.test(v),
    "Sheet music link must be a full URL (https://...)",
  ),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const setSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1, "A set needs a name"),
  description: optionalText,
  tuneIds: z.array(idSchema).default([]),
  notes: optionalText,
  tags: z.array(z.string().trim().min(1)).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TuneInput = z.input<typeof tuneSchema>;
export type SetInput = z.input<typeof setSchema>;

/** Flatten a ZodError into a single readable sentence for the UI. */
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}
