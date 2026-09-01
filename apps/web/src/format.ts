/** format.ts — numbers the way a person on a walk reads them. Pure. */

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}

export function formatDuration(s: number): string {
  const min = Math.round(s / 60);
  if (min < 1) return "under a minute";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

export function formatPoints(n: number): string {
  return `${n} pt${n === 1 ? "" : "s"}`;
}

/** "3 min ago", "yesterday" — enough for a feed. */
export function formatAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86_400);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

/** Group bonus as the participant should read it. */
export function describeBonus(pct: number, cap: number): string {
  if (pct <= 0) return "No group bonus";
  return `+${pct}% per extra person in the shot, up to +${cap}%`;
}
