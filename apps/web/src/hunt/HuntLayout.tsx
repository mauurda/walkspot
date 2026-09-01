/**
 * HuntLayout — the participant shell. No claim on this device → Join. A
 * claim → validate it once against /me (a released spot clears itself
 * there), then tabs.
 */
import { Camera, ListChecks, Map as MapIcon, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useParams } from "react-router";
import { api, onSessionChange, store, type Event } from "../api";
import { Join } from "../join/Join";
import { getHunt } from "../session";
import { Screen, Spinner, cx } from "../ui";
import { HuntContext } from "./context";

const TABS = [
  { to: "", label: "Challenges", icon: ListChecks },
  { to: "map", label: "Map", icon: MapIcon },
  { to: "feed", label: "Feed", icon: Camera },
  { to: "board", label: "Board", icon: Trophy },
];

export function HuntLayout() {
  const code = (useParams().code ?? "").toUpperCase();
  const [, bump] = useState(0);
  const [event, setEvent] = useState<Event | null>(null);
  const claim = getHunt(store, code).participant;

  useEffect(() => onSessionChange(() => bump((n) => n + 1)), []);

  async function refreshEvent() {
    const res = await api.me(code, "participant");
    setEvent(res.event);
  }

  useEffect(() => {
    setEvent(null);
    if (claim) refreshEvent().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, claim?.token]);

  if (!claim) return <Join code={code} onClaimed={() => bump((n) => n + 1)} />;
  if (!event) return <Screen><Spinner /></Screen>;

  return (
    <HuntContext.Provider value={{ code, event, me: { id: claim.id, name: claim.name }, refreshEvent }}>
      <header className="sticky top-0 z-[500] border-b border-hairline bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <div className="truncate font-display text-lg font-semibold text-brand-deep">{event.name}</div>
            <div className="text-xs text-muted">
              you are <span className="font-semibold text-ink">{claim.name}</span> · {code}
            </div>
          </div>
        </div>
      </header>
      <Outlet />
      <nav className="fixed inset-x-0 bottom-0 z-[500] border-t border-hairline bg-paper-soft pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-2xl grid-cols-4">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={`/e/${code}${t.to ? `/${t.to}` : ""}`}
              end={!t.to}
              className={({ isActive }) => cx("flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold", isActive ? "text-brand-deep" : "text-muted")}
            >
              <t.icon className="size-5" />
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </HuntContext.Provider>
  );
}
