/**
 * media.ts — what may be uploaded as proof, and where it lives. Pure.
 *
 * Paths are `<event>/<challenge>/<participant>/<random>.<ext>`: the API mints
 * them, and on submit it checks the path a client hands back still starts
 * with that device's own prefix, so nobody files somebody else's file as
 * their proof.
 */
export const MAX_BYTES = 50 * 1024 * 1024; // matches the bucket's file_size_limit

const TYPES: Record<string, { ext: string; media: "image" | "video" }> = {
  "image/jpeg": { ext: "jpg", media: "image" },
  "image/png": { ext: "png", media: "image" },
  "image/webp": { ext: "webp", media: "image" },
  "image/heic": { ext: "heic", media: "image" },
  "video/mp4": { ext: "mp4", media: "video" },
  "video/quicktime": { ext: "mov", media: "video" },
  "video/webm": { ext: "webm", media: "video" },
};

export function describeMedia(contentType: unknown, size: unknown): { ext: string; media: "image" | "video" } | null {
  if (typeof contentType !== "string" || typeof size !== "number") return null;
  if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) return null;
  return TYPES[contentType.toLowerCase()] ?? null;
}

export function mediaTypeOfPath(path: string): "image" | "video" | null {
  const ext = path.split(".").pop()?.toLowerCase();
  const hit = Object.values(TYPES).find((t) => t.ext === ext);
  return hit?.media ?? null;
}

export function proofPrefix(eventId: string, challengeId: string, participantId: string): string {
  return `${eventId}/${challengeId}/${participantId}/`;
}
