/**
 * http.ts — the one adapter between Next route handlers and the domain.
 *
 * A route file under app/api exports `GET = eventRoute("anyone", fn)` and
 * nothing else. This wrapper resolves the hunt from `:code`, identifies the
 * caller from the bearer token, parses the body, and turns an AppError into
 * `{ error, code }` with its status — so the handlers read as the rules and
 * not as plumbing.
 */
import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { AppError } from "./errors";
import { findEvent } from "./events/load";
import { identify, type Actor } from "./auth/identify";
import type { Event } from "./supabase";

export type Auth = "none" | "participant" | "organizer" | "anyone";

export type Ctx = {
  req: NextRequest;
  params: Record<string, string>;
  /** Parsed JSON body for POST/PATCH/PUT; `{}` when absent or malformed. */
  body: Record<string, unknown>;
  query: URLSearchParams;
  ua: string | undefined;
};

export type EventCtx = Ctx & { event: Event } & Actor;

type NextHandler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export function json(body: unknown, status = 200): Response {
  return NextResponse.json(body, { status });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

async function context(req: NextRequest, params: Promise<Record<string, string>>): Promise<Ctx> {
  const hasBody = req.method === "POST" || req.method === "PATCH" || req.method === "PUT";
  const raw: unknown = hasBody ? await req.json().catch(() => ({})) : {};
  const body = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return { req, params: await params, body, query: req.nextUrl.searchParams, ua: req.headers.get("user-agent") ?? undefined };
}

function reply(err: unknown): Response {
  if (err instanceof AppError) return json({ error: err.message, code: err.code }, err.status);
  console.error("[api]", err);
  Sentry.captureException(err);
  return json({ error: "Something went wrong", code: "INTERNAL_ERROR" }, 500);
}

/** A route with no hunt in the URL (create, health). */
export function route(fn: (ctx: Ctx) => Promise<Response>): NextHandler {
  return async (req, { params }) => {
    try {
      return await fn(await context(req, params));
    } catch (err) {
      return reply(err);
    }
  };
}

/** A route under /api/events/:code — the hunt is loaded and the caller identified first. */
export function eventRoute(auth: Auth, fn: (ctx: EventCtx) => Promise<Response>): NextHandler {
  return async (req, { params }) => {
    try {
      const ctx = await context(req, params);
      const event = await findEvent(ctx.params.code);
      const actor = await identify(req.headers.get("authorization"), event);
      if (auth === "participant" && !actor.participant) throw new AppError("Claim a spot first", 401, "CLAIM_REQUIRED");
      if (auth === "organizer" && !actor.organizer) throw new AppError("Organizer sign-in required", 401, "ORGANIZER_REQUIRED");
      if (auth === "anyone" && !actor.participant && !actor.organizer) throw new AppError("Sign in to this hunt first", 401, "AUTH_REQUIRED");
      return await fn({ ...ctx, event, ...actor });
    } catch (err) {
      return reply(err);
    }
  };
}
