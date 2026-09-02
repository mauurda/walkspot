/**
 * code.ts — join codes. Six characters from an alphabet without look-alikes
 * (no 0/O, 1/I/L), so a code read aloud across a room survives the trip.
 * Stored uppercase; matched case-insensitively.
 */
import { randomInt } from "node:crypto";

export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;

export function mintCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** Normalize what a person typed: trim, uppercase, drop separators. Null if it can't be a code. */
export function normalizeCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const code = input.trim().toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== CODE_LENGTH) return null;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return null;
  return code;
}
