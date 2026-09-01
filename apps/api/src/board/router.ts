/** board/router.ts — the leaderboard. One read, both roles. */
import { Router } from "express";
import { wrap } from "../errors.js";
import { requireAnyone } from "../auth/middleware.js";
import { listRoster } from "../participants/roster.js";
import { leaderboard } from "../submissions/scoring.js";
import { loadScoring } from "../submissions/load.js";

export const boardRouter: Router = Router();

boardRouter.get(
  "/",
  requireAnyone,
  wrap(async (req, res) => {
    const event = req.event!;
    const [scoring, roster] = await Promise.all([loadScoring(event), listRoster(event.id)]);
    const total = [...scoring.challenges.values()].reduce((sum, c) => sum + c.points, 0);
    res.json({
      rows: leaderboard(scoring, roster),
      challenges: scoring.challenges.size,
      total_points: total,
    });
  }),
);
