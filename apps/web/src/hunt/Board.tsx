"use client";
/** Board — the leaderboard, one read, both roles. */
import { api, type Role } from "../api";
import { useHuntSession } from "../useSession";
import { Empty, Heading, Notice, Screen, Spinner, cx } from "../ui";
import { useAsync } from "../ui/useAsync";

export function Board({ code, role }: { code: string; role: Role }) {
  const { data, error, loading } = useAsync(() => api.board(code, role), [code, role]);
  const meId = useHuntSession(code)?.participant?.id;

  return (
    <Screen>
      <div className="mb-4 flex items-baseline justify-between">
        <Heading>Board</Heading>
        {data ? <span className="text-sm text-muted">{data.challenges} challenges · {data.total_points} base pts</span> : null}
      </div>
      {loading && !data ? <Spinner /> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {data && !data.rows.length ? <Empty>Nobody on the roster yet.</Empty> : null}
      <ol className="divide-y divide-hairline rounded-lg border border-hairline bg-paper-soft">
        {data?.rows.map((r) => (
          <li key={r.participant_id} className={cx("flex items-center gap-3 px-4 py-3", r.participant_id === meId && "bg-brand-soft/50")}>
            <span className={cx("w-8 text-center font-display text-xl font-semibold", r.rank <= 3 ? "text-accent" : "text-muted")}>{r.rank}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{r.name}{r.participant_id === meId ? " (you)" : ""}</span>
              <span className="block text-xs text-muted">
                {r.completed} done{r.pending ? ` · ${r.pending} in review` : ""}
              </span>
            </span>
            <span className="font-display text-xl font-semibold text-brand-deep">{r.points}</span>
          </li>
        ))}
      </ol>
    </Screen>
  );
}
