/**
 * OrganizerLayout — the organizer shell. No session on this device → the
 * passphrase form. A session → validate once via /me, then tabs.
 */
import { Camera, ListChecks, Settings as SettingsIcon, ShieldCheck, Trophy, Users } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useParams } from "react-router";
import { api, onSessionChange, store, type Event } from "../api";
import { getHunt, setOrganizer } from "../session";
import { Button, Field, Input, Notice, Screen, Spinner, Title, cx, messageOf } from "../ui";
import { OrgContext } from "./context";

const TABS = [
  { to: "", label: "People", icon: Users },
  { to: "challenges", label: "Challenges", icon: ListChecks },
  { to: "review", label: "Review", icon: ShieldCheck },
  { to: "feed", label: "Feed", icon: Camera },
  { to: "board", label: "Board", icon: Trophy },
  { to: "settings", label: "Setup", icon: SettingsIcon },
];

export function OrganizerLayout() {
  const code = (useParams().code ?? "").toUpperCase();
  const [, bump] = useState(0);
  const [event, setEvent] = useState<Event | null>(null);
  const [error, setError] = useState<string | null>(null);
  const session = getHunt(store, code).organizer;

  useEffect(() => onSessionChange(() => bump((n) => n + 1)), []);

  useEffect(() => {
    setEvent(null);
    if (!session) return;
    api.me(code, "organizer").then((res) => setEvent(res.event)).catch((err) => setError(messageOf(err)));
  }, [code, session?.token]);

  if (!session) return <Login code={code} onSignedIn={() => bump((n) => n + 1)} />;
  if (!event) return <Screen>{error ? <Notice tone="danger">{error}</Notice> : <Spinner />}</Screen>;

  return (
    <OrgContext.Provider value={{ code, event, setEvent }}>
      <header className="sticky top-0 z-[500] border-b border-hairline bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <div className="truncate font-display text-lg font-semibold text-brand-deep">{event.name}</div>
            <div className="text-xs text-muted">organizing · code <span className="font-mono font-semibold text-ink">{code}</span></div>
          </div>
          <Link to={`/e/${code}`} className="shrink-0 text-xs font-semibold text-brand-deep underline">Player view</Link>
        </div>
      </header>
      <Outlet />
      <nav className="fixed inset-x-0 bottom-0 z-[500] border-t border-hairline bg-paper-soft pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-2xl grid-cols-6">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={`/o/${code}${t.to ? `/${t.to}` : ""}`}
              end={!t.to}
              className={({ isActive }) => cx("flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", isActive ? "text-brand-deep" : "text-muted")}
            >
              <t.icon className="size-5" />
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </OrgContext.Provider>
  );
}

function Login({ code, onSignedIn }: { code: string; onSignedIn: () => void }) {
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
      onSignedIn();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Link to="/" className="text-sm text-muted">← Walkspot</Link>
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
        Just playing? <Link to={`/e/${code}`} className="font-semibold text-brand-deep underline">Join as a participant</Link>
      </p>
    </Screen>
  );
}
