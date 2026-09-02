/**
 * validate.ts — what an event may be created or edited with. Pure.
 *
 * `group_bonus_pct` is the extra credit per additional person in a proof, as a
 * percentage of the challenge's points; `group_bonus_cap` bounds the total so
 * a twelve-person selfie doesn't quadruple a challenge.
 */
export const NAME_MAX = 80;
export const DESCRIPTION_MAX = 2000;
export const PASSPHRASE_MIN = 4;
export const PASSPHRASE_MAX = 200;

export type EventInput = {
  name: string;
  description: string | null;
  auto_approve: boolean;
  group_bonus_pct: number;
  group_bonus_cap: number;
};

const DEFAULTS: Omit<EventInput, "name" | "description"> = {
  auto_approve: true,
  group_bonus_pct: 25,
  group_bonus_cap: 100,
};

function text(value: unknown, max: number): string | null | undefined {
  if (value == null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > max ? undefined : trimmed || null;
}

function pct(value: unknown, fallback: number): number | undefined {
  if (value == null) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 500) return undefined;
  return value;
}

/** Full input for creation. Null when anything is off. */
export function validateEvent(body: unknown): (EventInput & { passphrase: string }) | null {
  const patch = validateEventPatch(body);
  if (!patch || !patch.name) return null;
  const { passphrase } = body as Record<string, unknown>;
  if (typeof passphrase !== "string") return null;
  const trimmed = passphrase.trim();
  if (trimmed.length < PASSPHRASE_MIN || trimmed.length > PASSPHRASE_MAX) return null;
  return { ...DEFAULTS, ...patch, name: patch.name, description: patch.description ?? null, passphrase: trimmed };
}

/** Partial input for edits: only the keys present are returned. Null when a present key is invalid. */
export function validateEventPatch(body: unknown): Partial<EventInput> | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const out: Partial<EventInput> = {};

  if ("name" in b) {
    const name = text(b.name, NAME_MAX);
    if (!name) return null;
    out.name = name;
  }
  if ("description" in b) {
    const description = text(b.description, DESCRIPTION_MAX);
    if (description === undefined) return null;
    out.description = description;
  }
  if ("auto_approve" in b) {
    if (typeof b.auto_approve !== "boolean") return null;
    out.auto_approve = b.auto_approve;
  }
  if ("group_bonus_pct" in b) {
    const v = pct(b.group_bonus_pct, DEFAULTS.group_bonus_pct);
    if (v === undefined) return null;
    out.group_bonus_pct = v;
  }
  if ("group_bonus_cap" in b) {
    const v = pct(b.group_bonus_cap, DEFAULTS.group_bonus_cap);
    if (v === undefined) return null;
    out.group_bonus_cap = v;
  }
  return out;
}
