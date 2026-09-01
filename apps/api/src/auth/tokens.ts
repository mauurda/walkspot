/**
 * tokens.ts — the credentials Walkspot mints, and how they are stored.
 *
 * Two kinds, told apart by prefix so a token can never be tried against the
 * wrong table:
 *
 *   wsp_…  a participant's claim — the device that holds a roster spot
 *   wso_…  an organizer session  — a device that knows the event passphrase
 *
 * Only the SHA-256 of a token is stored. A leaked database therefore leaks no
 * usable credential, and lookup stays an indexed equality on token_hash.
 *
 * Passphrases are scrypt-hashed with a per-event salt: they are chosen by
 * people, so they are guessable in a way random tokens are not.
 */
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export type Role = "participant" | "organizer";

const PREFIX: Record<Role, string> = { participant: "wsp_", organizer: "wso_" };

export function mintToken(role: Role): string {
  return PREFIX[role] + randomBytes(32).toString("base64url");
}

export function roleOf(token: string): Role | null {
  if (token.startsWith(PREFIX.participant)) return "participant";
  if (token.startsWith(PREFIX.organizer)) return "organizer";
  return null;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const SCRYPT_KEYLEN = 32;

export function hashPassphrase(passphrase: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(passphrase.normalize("NFKC"), salt, SCRYPT_KEYLEN).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassphrase(passphrase: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(passphrase.normalize("NFKC"), salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
