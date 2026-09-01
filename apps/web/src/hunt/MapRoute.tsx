/**
 * MapRoute — every located challenge on a map, and a plan: from where you
 * stand, in what order, along which streets. The order comes from the API;
 * the participant decides which stops are in.
 */
import { Footprints, LocateFixed, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { api, type Route } from "../api";
import { formatDistance, formatDuration } from "../format";
import { useLocation } from "../geo";
import { Map, type Pin } from "../map/Map";
import { Button, Card, Empty, Notice, Pill, Screen, Spinner, cx, messageOf } from "../ui";
import { useAsync } from "../ui/useAsync";
import { useHunt } from "./context";

export function MapRoute() {
  const { code } = useHunt();
  const { data, error, loading } = useAsync(() => api.challenges(code, "participant"), [code]);
  const loc = useLocation();
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const located = useMemo(() => (data?.challenges ?? []).filter((c) => c.lat != null && c.lng != null), [data]);

  // Default selection: everything not yet done.
  useEffect(() => {
    if (data && selected === null) setSelected(new Set(located.filter((c) => c.mine?.status !== "approved").map((c) => c.id)));
  }, [data, located, selected]);

  useEffect(() => {
    void loc.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function plan() {
    if (!selected?.size) return;
    setPlanning(true);
    setPlanError(null);
    try {
      const from = loc.fix ?? (await loc.refresh());
      setRoute(await api.route(code, "participant", { from: from ? { lat: from.lat, lng: from.lng } : null, challenge_ids: [...selected] }));
    } catch (err) {
      setPlanError(messageOf(err));
    } finally {
      setPlanning(false);
    }
  }

  function toggle(id: string) {
    setRoute(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const orderOf = new globalThis.Map(route?.stops.map((s, i) => [s.id, i + 1]) ?? []);
  const pins: Pin[] = located.map((c, i) => ({
    id: c.id,
    lat: c.lat!,
    lng: c.lng!,
    label: String(orderOf.get(c.id) ?? i + 1),
    title: `${c.title} · ${c.points} pts`,
    tone: c.mine?.status === "approved" ? "done" : selected?.has(c.id) ? "brand" : "off",
  }));

  if (loading && !data) return <Screen><Spinner /></Screen>;

  return (
    <Screen className="pt-0">
      <Map pins={pins} me={loc.fix} line={route?.coordinates} dashed={route?.source === "straight"} className="h-[46vh] w-full" />
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="text-sm text-muted">
          {located.length} place{located.length === 1 ? "" : "s"} · {selected?.size ?? 0} in your plan
        </div>
        <Button variant="ghost" onClick={() => loc.refresh()} busy={loc.busy} className="px-2">
          <LocateFixed className="size-4" /> {loc.fix ? `±${Math.round(loc.fix.accuracy_m)} m` : "Locate me"}
        </Button>
      </div>
      {loc.error ? <div className="mt-2"><Notice tone="danger">{loc.error} — routes will start from the first stop.</Notice></div> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {data && !located.length ? <div className="mt-3"><Empty>None of the challenges are tied to a place, so there's nothing to route. Do them anywhere!</Empty></div> : null}

      {located.length ? (
        <div className="mt-3 flex gap-2">
          <Button className="flex-1" busy={planning} disabled={!selected?.size} onClick={plan}>
            <Footprints className="size-4" /> {route ? "Re-plan" : "Plan my route"}
          </Button>
          {route ? <Button variant="ghost" onClick={() => setRoute(null)}><RotateCcw className="size-4" /></Button> : null}
        </div>
      ) : null}
      {planError ? <div className="mt-2"><Notice tone="danger">{planError}</Notice></div> : null}

      {route ? (
        <Card className="mt-3">
          <div className="flex items-baseline justify-between">
            <div className="font-display text-xl font-semibold text-brand-deep">{formatDistance(route.total.distance_m)} · {formatDuration(route.total.duration_s)}</div>
            <Pill tone={route.source === "streets" ? "brand" : "muted"}>{route.source === "streets" ? "along streets" : "as the crow flies"}</Pill>
          </div>
          <ol className="mt-3 space-y-2">
            {route.stops.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3">
                <span className="ws-pin">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <Link to={`/e/${code}/c/${s.id}`} className="block truncate font-semibold">{s.title}</Link>
                  <div className="text-xs text-muted">
                    {route.legs[i + (route.from ? 0 : -1)] ? `${formatDistance(route.legs[i + (route.from ? 0 : -1)]!.distance_m)} · ${formatDuration(route.legs[i + (route.from ? 0 : -1)]!.duration_s)} ${i === 0 && route.from ? "from you" : "from the previous stop"}` : "start here"}
                  </div>
                </div>
                <span className="text-sm text-muted">{s.points} pts</span>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {located.length ? (
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Stops to include</h2>
          <div className="space-y-1.5">
            {located.map((c, i) => {
              const done = c.mine?.status === "approved";
              const on = selected?.has(c.id) ?? false;
              return (
                <button key={c.id} onClick={() => toggle(c.id)} className={cx("flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left", on ? "border-brand bg-brand-soft/50" : "border-hairline bg-paper-soft")}>
                  <span className={cx("ws-pin", done && "done", !on && !done && "off")}>{orderOf.get(c.id) ?? i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{c.title}</span>
                    <span className="block text-xs text-muted">{done ? "done" : `${c.points} pts`}{loc.fix ? ` · ${formatDistance(distance(loc.fix, c))} away` : ""}</span>
                  </span>
                  <span className="text-xs font-semibold text-muted">{on ? "in" : "out"}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </Screen>
  );
}

function distance(a: { lat: number; lng: number }, c: { lat: number | null; lng: number | null }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(c.lat! - a.lat);
  const dLng = toRad(c.lng! - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(c.lat!)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}
