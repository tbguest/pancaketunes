/**
 * Ids are slugs derived from the title. They are stable: renaming a tune does
 * not change its id, so sets never break.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents (Ó Riada -> O Riada)
    .toLowerCase()
    .replace(/['’]/g, "") // Cooley's -> cooleys
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Appends -2, -3, ... until the slug is free. */
export function uniqueSlug(base: string, taken: Set<string>): string {
  const seed = base || "untitled";
  if (!taken.has(seed)) return seed;
  for (let n = 2; ; n += 1) {
    const candidate = `${seed}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
