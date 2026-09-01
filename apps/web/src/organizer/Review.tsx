/**
 * Review — proofs, pending first. The distance badge is the GPS fix against
 * the challenge radius; it advises, the organizer decides.
 */
import { Check, X } from "lucide-react";
import { useState } from "react";
import { api, type Submission } from "../api";
import { formatAgo, formatDistance, formatPoints } from "../format";
import { StatusPill } from "../hunt/status";
import { Button, Card, Empty, Heading, Media, Notice, Pill, Screen, Spinner, cx, messageOf } from "../ui";
import { useAsync } from "../ui/useAsync";
import { useOrg } from "./context";

const FILTERS = ["pending", "approved", "rejected", "all"] as const;

export function Review() {
  const { code, event } = useOrg();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>(event.auto_approve ? "all" : "pending");
  const { data, error, loading, setData } = useAsync(() => api.feed(code, "organizer", filter === "all" ? {} : { status: filter }), [code, filter]);
  const challenges = useAsync(() => api.challenges(code, "organizer"), [code]);
  const [actionError, setActionError] = useState<string | null>(null);
  const radiusOf = new globalThis.Map(challenges.data?.challenges.map((c) => [c.id, c.radius_m]) ?? []);

  async function review(s: Submission, status: "approved" | "rejected") {
    setActionError(null);
    const note = status === "rejected" ? window.prompt("Why? (shown to them; optional)") ?? "" : "";
    try {
      const { submission } = await api.review(code, s.id, status, note.trim() || null);
      setData((prev) => prev && { submissions: prev.submissions.map((x) => (x.id === submission.id ? submission : x)) });
    } catch (err) {
      setActionError(messageOf(err));
    }
  }

  return (
    <Screen>
      <Heading className="mb-3">Review</Heading>
      <div className="mb-4 flex gap-1 rounded-md bg-hairline/40 p-1">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cx("min-h-9 flex-1 rounded-sm text-sm font-semibold capitalize", filter === f ? "bg-paper-soft text-brand-deep shadow-sm" : "text-muted")}>{f}</button>
        ))}
      </div>
      {actionError ? <div className="mb-3"><Notice tone="danger">{actionError}</Notice></div> : null}
      {loading && !data ? <Spinner /> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {data && !data.submissions.length ? <Empty>Nothing {filter === "all" ? "yet" : filter}.</Empty> : null}
      <div className="space-y-3">
        {data?.submissions.map((s) => {
          const radius = s.challenge ? radiusOf.get(s.challenge.id) : null;
          const far = s.distance_m != null && radius != null && s.distance_m > radius;
          return (
            <Card key={s.id} className="overflow-hidden p-0">
              <Media url={s.media_url} type={s.media_type} className="max-h-[60vh]" />
              <div className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold">{s.challenge?.title ?? "—"}</span>
                  <StatusPill status={s.status} />
                  {s.status === "approved" ? <Pill tone="brand">{formatPoints(s.points)} each</Pill> : null}
                  {s.distance_m != null ? (
                    <Pill tone={far ? "danger" : "ok"}>{formatDistance(s.distance_m)} from the spot{radius != null ? ` (radius ${radius} m)` : ""}</Pill>
                  ) : s.challenge && radius != null ? (
                    <Pill tone="muted">no GPS fix</Pill>
                  ) : null}
                </div>
                <div className="text-sm text-muted">
                  by <span className="font-semibold text-ink">{s.submitter?.name ?? "?"}</span>
                  {s.members.length > 1 ? ` with ${s.members.filter((m) => m.id !== s.participant_id).map((m) => m.name).join(", ")}` : ""} · {formatAgo(s.created_at)}
                </div>
                {s.caption ? <p className="text-sm">{s.caption}</p> : null}
                {s.review_note ? <p className="text-sm text-danger">Note: {s.review_note}</p> : null}
                <div className="flex gap-2 pt-1">
                  {s.status !== "approved" ? <Button className="flex-1" onClick={() => review(s, "approved")}><Check className="size-4" /> Approve</Button> : null}
                  {s.status !== "rejected" ? <Button variant="danger" className="flex-1" onClick={() => review(s, "rejected")}><X className="size-4" /> Reject</Button> : null}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </Screen>
  );
}
