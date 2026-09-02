/** board/handlers.ts — the leaderboard. One read, both roles. */
import { eventRoute, json } from "../http";
import { listRoster } from "../participants/roster";
import { leaderboard } from "../submissions/scoring";
import { loadScoring } from "../submissions/load";

// GET /board
export const getBoard = eventRoute("anyone", async ({ event }) => {
  const [scoring, roster] = await Promise.all([loadScoring(event), listRoster(event.id)]);
  const total = [...scoring.challenges.values()].reduce((sum, c) => sum + c.points, 0);
  return json({ rows: leaderboard(scoring, roster), challenges: scoring.challenges.size, total_points: total });
});
