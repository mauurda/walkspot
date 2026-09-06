"use client";
/**
 * ProofCard — one proof, the way it reads everywhere: the feed and a player's
 * own page show the same card, so a proof never looks like two things.
 */
import type { Submission } from "../api";
import { formatAgo, formatDistance, formatPoints } from "../format";
import { Card, Media, Pill } from "../ui";
import { StatusPill } from "./status";

export function ProofCard({ submission: s }: { submission: Submission }) {
  return (
    <Card className="overflow-hidden p-0">
      <Media url={s.media_url} type={s.media_type} className="max-h-[70vh]" />
      <div className="space-y-1.5 px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold">{s.challenge?.title ?? "—"}</span>
          {s.status === "approved" ? (
            <Pill tone="brand">{formatPoints(s.points)}{s.members.length > 1 ? " each" : ""}</Pill>
          ) : (
            <StatusPill status={s.status} />
          )}
          {s.repeat_key ? <Pill tone="brand">{s.repeat_key}</Pill> : null}
          {s.distance_m != null ? <Pill>{formatDistance(s.distance_m)} from the spot</Pill> : null}
        </div>
        <div className="text-sm text-muted">
          {s.members.map((m) => m.name).join(", ")} · {formatAgo(s.created_at)}
        </div>
        {s.caption ? <p className="text-sm">{s.caption}</p> : null}
      </div>
    </Card>
  );
}
