/**
 * names.ts — the roster as an organizer types it. Pure.
 */
export const NAME_MAX = 60;

export function parseNames(input: unknown): string[] | null {
  const raw: unknown[] = Array.isArray(input) ? input : typeof input === "string" ? input.split(/[\n,]/) : [];
  if (!raw.length) return null;
  const seen = new Set<string>();
  const names: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") return null;
    const name = item.trim().replace(/\s+/g, " ");
    if (!name) continue;
    if (name.length > NAME_MAX) return null;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names.length ? names : null;
}
