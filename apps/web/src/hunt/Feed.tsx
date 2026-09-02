"use client";
/** Feed — everyone's proofs, newest first. Both roles read the same list. */
import { api, type Role } from "../api";
import { formatAgo, formatDistance, formatPoints } from "../format";
import { Card, Empty, Heading, Media, Notice, Pill, Screen, Spinner } from "../ui";
import { useAsync } from "../ui/useAsync";
import { StatusPill } from "./status";

export function Feed({ code, role }: { code: string; role: Role }) {
  const { data, error, loading } = useAsync(() => api.feed(code, role), [code, role]);

  return (
    <Screen>
      <Heading className="mb-4">Proofs</Heading>
      {loading && !data ? <Spinner /> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {data && !data.submissions.length ? <Empty>Nothing yet. The first proof lands here.</Empty> : null}
      <div className="space-y-3">
        {data?.submissions.map((s) => (
          <Card key={s.id} className="overflow-hidden p-0">
            <Media url={s.media_url} type={s.media_type} className="max-h-[70vh]" />
            <div className="space-y-1.5 px-4 py-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold">{s.challenge?.title ?? "—"}</span>
                {s.status === "approved" ? <Pill tone="brand">{formatPoints(s.points)}{s.members.length > 1 ? " each" : ""}</Pill> : <StatusPill status={s.status} />}
                {s.distance_m != null ? <Pill>{formatDistance(s.distance_m)} from the spot</Pill> : null}
              </div>
              <div className="text-sm text-muted">
                {s.members.map((m) => m.name).join(", ")} · {formatAgo(s.created_at)}
              </div>
              {s.caption ? <p className="text-sm">{s.caption}</p> : null}
            </div>
          </Card>
        ))}
      </div>
    </Screen>
  );
}
