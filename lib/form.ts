/**
 * Helpers for the "one item per line" text inputs the editor forms use. Typing
 * a list into a textarea is far quicker on a phone than tapping through a
 * dynamic row-builder, which matters when someone is editing mid-session.
 */

import type { Link } from "./types";

export function linesToArray(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Tags accept either commas or newlines as separators. */
export function tagsToArray(value: FormDataEntryValue | null): string[] {
  const tags = String(value ?? "")
    .split(/[,\n]/)
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(tags)];
}

/** Each line is `https://...` or `Label | https://...`. */
export function linesToLinks(value: FormDataEntryValue | null): Link[] {
  return linesToArray(value).map((line) => {
    const separator = line.indexOf("|");
    if (separator === -1) return { label: "", url: line };
    return {
      label: line.slice(0, separator).trim(),
      url: line.slice(separator + 1).trim(),
    };
  });
}

export function linksToLines(links: Link[]): string {
  return links.map((link) => (link.label ? `${link.label} | ${link.url}` : link.url)).join("\n");
}

/** Best-effort display name for a bare URL. */
export function linkLabel(link: Link): string {
  if (link.label) return link.label;
  try {
    return new URL(link.url).hostname.replace(/^www\./, "");
  } catch {
    return link.url;
  }
}
