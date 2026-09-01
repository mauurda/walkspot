/**
 * app.ts — compose the routers. Keep it thin: anything with logic in it belongs
 * in the resource folder it serves.
 */
import "./instrument.js"; // first, so Sentry is initialized before express loads
import express from "express";
import cors from "cors";
import * as Sentry from "@sentry/node";
import { eventsRouter } from "./events/router.js";
import { participantsRouter } from "./participants/router.js";
import { challengesRouter } from "./challenges/router.js";
import { submissionsRouter } from "./submissions/router.js";
import { boardRouter } from "./board/router.js";
import { routeRouter } from "./route/router.js";
import { loadEvent } from "./events/load.js";
import { errorHandler } from "./errors.js";

export function createApp() {
  const app = express();

  app.use(cors());
  // Media never travels through this API — files go straight to Storage on a
  // signed URL — so the JSON body stays small.
  app.use(express.json({ limit: "1mb" }));
  app.set("trust proxy", true);

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/events", eventsRouter);
  // Everything under an event resolves the code once, then the resource
  // router decides who may do what with its own middleware.
  app.use("/events/:code/participants", loadEvent, participantsRouter);
  app.use("/events/:code/challenges", loadEvent, challengesRouter);
  app.use("/events/:code/submissions", loadEvent, submissionsRouter);
  app.use("/events/:code/board", loadEvent, boardRouter);
  app.use("/events/:code/route", loadEvent, routeRouter);

  // Captures 5xx to Sentry, then passes the error on — so it sits between the
  // routers and our handler. Expected 4xx (AppError validation, auth) stay out.
  Sentry.setupExpressErrorHandler(app);

  app.use(errorHandler); // last — it only sees what the routers pass to next()
  return app;
}
