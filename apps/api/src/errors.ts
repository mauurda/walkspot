import type { ErrorRequestHandler, RequestHandler } from "express";

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

/**
 * Wrap an async handler so a rejected promise reaches the error middleware.
 * Express 4 does not do this itself: without the wrapper an async throw becomes
 * an unhandled rejection and the request hangs until the client times out.
 */
export function wrap(handler: RequestHandler): RequestHandler {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

/** Turn a Supabase error into a 500 with its message; keeps routers to one line per query. */
export function dbError(error: { message: string } | null): never {
  throw new AppError(error?.message ?? "Database error", 500, "INTERNAL_ERROR");
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  console.error("[error]", err);
  return res.status(500).json({ error: "Something went wrong", code: "INTERNAL_ERROR" });
};
