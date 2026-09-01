import { LocateFixed, MapPin } from "lucide-react";
import { Link } from "react-router";
import { api } from "../api";
import { formatDistance, formatPoints } from "../format";
import { distanceM, useLocation } from "../geo";
import { Button, Card, Empty, Notice, Pill, Screen, Spinner } from "../ui";
import { useAsync } from "../ui/useAsync";
import { useHunt } from "./context";
import { StatusPill } from "./status";

export function Challenges() {
  const { code, event } = useHunt();
  const { data, error, loading } = useAsync(() => api.challenges(code, "participant"), [code]);
  const loc = useLocation();

  const challenges = data?.challenges ?? [];
  const earned = challenges.reduce((s, c) => s + (c.mine?.points ?? 0), 0);
  const done = challenges.filter((c) => c.mine?.status === "approved").length;

  return (
    <Screen>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <div className="text-sm text-muted">your score</div>
          <div className="font-display text-4xl font-bold text-brand-deep">{earned}</div>
          <div className="text-sm text-muted">
            {done} of {challenges.length} done
          </div>
        </div>
        <Button variant="secondary" onClick={() => loc.refresh()} busy={loc.busy}>
          <LocateFixed className="size-4" /> {loc.fix ? "Update location" : "Show distances"}
        </Button>
      </div>
      {loc.error ? <div className="mb-3"><Notice tone="danger">{loc.error}</Notice></div> : null}
      {event.description ? <p className="mb-5 whitespace-pre-line text-sm text-muted">{event.description}</p> : null}

      {loading && !data ? <Spinner /> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {data && !challenges.length ? <Empty>No challenges yet. The organizer is still setting up.</Empty> : null}

      <div className="space-y-2">
        {challenges.map((c) => (
          <Link key={c.id} to={`/e/${code}/c/${c.id}`} className="block">
            <Card className="flex items-start justify-between gap-3 hover:border-brand">
              <div className="min-w-0">
                <div className="font-semibold">{c.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  {c.lat != null && c.lng != null ? (
                    <Pill tone="brand">
                      <MapPin className="size-3" />
                      {loc.fix ? formatDistance(distanceM(loc.fix, { lat: c.lat, lng: c.lng })) : "on the map"}
                    </Pill>
                  ) : (
                    <Pill>anywhere</Pill>
                  )}
                  {c.mine ? <StatusPill status={c.mine.status} /> : null}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-display text-xl font-semibold text-brand-deep">{c.mine?.status === "approved" ? c.mine.points : c.points}</div>
                <div className="text-xs text-muted">{c.mine?.status === "approved" ? "earned" : "pts"}</div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-muted">{formatPoints(challenges.reduce((s, c) => s + c.points, 0))} on the table, before group bonuses.</p>
    </Screen>
  );
}
