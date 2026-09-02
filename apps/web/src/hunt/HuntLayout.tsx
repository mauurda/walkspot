"use client";
/**
 * HuntLayout — the participant shell. No claim on this device → Join. A
 * claim → validate it once against /me (a released spot clears itself
 * there), then tabs around the page.
 */
import { Camera, ListChecks, Map as MapIcon, Trophy } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { api, type Event } from "../api";
import { Join } from "../join/Join";
import { Screen, Spinner } from "../ui";
import { Tabs } from "../ui/Tabs";
import { useHuntSession } from "../useSession";
import { HuntContext } from "./context";

const TABS = [
  { to: "", label: "Challenges", icon: ListChecks },
  { to: "map", label: "Map", icon: MapIcon },
  { to: "feed", label: "Feed", icon: Camera },
  { to: "board", label: "Board", icon: Trophy },
];

export function HuntLayout({ code, children }: { code: string; children: ReactNode }) {
  const session = useHuntSession(code);
  const claim = session?.participant;
  const [event, setEvent] = useState<Event | null>(null);

  async function refreshEvent() {
    const res = await api.me(code, "participant");
    setEvent(res.event);
  }

  useEffect(() => {
    setEvent(null);
    if (claim) refreshEvent().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, claim?.token]);

  if (!session) return <Screen><Spinner /></Screen>;
  if (!claim) return <Join code={code} />;
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
      {children}
      <Tabs base={`/e/${code}`} tabs={TABS} />
    </HuntContext.Provider>
  );
}
