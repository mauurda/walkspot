/**
 * An error with a status and a stable machine-readable code. The code is what
 * the client switches on — `CLAIM_REVOKED` means "forget this device's spot and
 * show the pick-your-name screen" — so it must not change casually.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status = 500,
    readonly code = "INTERNAL_ERROR",
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** Turn a Supabase error into a 500 with its message; keeps handlers to one line per query. */
export function dbError(error: { message: string } | null): never {
  throw new AppError(error?.message ?? "Database error", 500, "INTERNAL_ERROR");
}
