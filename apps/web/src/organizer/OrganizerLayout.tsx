"use client";
/**
 * OrganizerLayout — the organizer shell. No session on this device → the
 * passphrase form. A session → validate once via /me, then tabs.
 */
import { Camera, ListChecks, Settings as SettingsIcon, ShieldCheck, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { api, notifySessionChange, store, type Event } from "../api";
import { setOrganizer } from "../session";
import { Button, Field, Input, Notice, Screen, Spinner, Title, messageOf } from "../ui";
import { Tabs } from "../ui/Tabs";
import { useHuntSession } from "../useSession";
import { OrgContext } from "./context";

const TABS = [
  { to: "", label: "People", icon: Users },
  { to: "challenges", label: "Challenges", icon: ListChecks },
  { to: "review", label: "Review", icon: ShieldCheck },
  { to: "feed", label: "Feed", icon: Camera },
  { to: "board", label: "Board", icon: Trophy },
  { to: "settings", label: "Setup", icon: SettingsIcon },
];

export function OrganizerLayout({ code, children }: { code: string; children: ReactNode }) {
  const hunt = useHuntSession(code);
  const session = hunt?.organizer;
  const [event, setEvent] = useState<Event | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEvent(null);
    if (!session) return;
    api.me(code, "organizer").then((res) => setEvent(res.event)).catch((err) => setError(messageOf(err)));
  }, [code, session?.token]);

  if (!hunt) return <Screen><Spinner /></Screen>;
  if (!session) return <Login code={code} />;
  if (!event) return <Screen>{error ? <Notice tone="danger">{error}</Notice> : <Spinner />}</Screen>;

  return (
    <OrgContext.Provider value={{ code, event, setEvent }}>
      <header className="sticky top-0 z-[500] border-b border-hairline bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <div className="truncate font-display text-lg font-semibold text-brand-deep">{event.name}</div>
            <div className="text-xs text-muted">organizing · code <span className="font-mono font-semibold text-ink">{code}</span></div>
          </div>
          <Link href={`/e/${code}`} className="shrink-0 text-xs font-semibold text-brand-deep underline">Player view</Link>
        </div>
      </header>
      {children}
      <Tabs base={`/o/${code}`} tabs={TABS} />
    </OrgContext.Provider>
  );
}

function Login({ code }: { code: string }) {
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { event, token } = await api.organizerLogin(code, passphrase);
      setOrganizer(store, code, event.name, { token });
      notifySessionChange();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Link href="/" className="text-sm text-muted">← Walkspot</Link>
      <Title className="mt-4">Organize {code}</Title>
      <p className="mt-1 text-muted">Enter the hunt's organizer passphrase to manage it from this device.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Passphrase">
          <Input type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} autoFocus required />
        </Field>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button type="submit" busy={busy} className="w-full">Sign in</Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted">
        Just playing? <Link href={`/e/${code}`} className="font-semibold text-brand-deep underline">Join as a participant</Link>
      </p>
    </Screen>
  );
}
