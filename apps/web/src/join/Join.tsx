"use client";
/**
 * Join — pick who you are. This is the irreversible step: once a name is
 * claimed on this device, only an organizer can release it, and the screen
 * says so before the tap that does it.
 */
import { Lock } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { api, notifySessionChange, store, type Spot } from "../api";
import { setParticipant } from "../session";
import { Button, Notice, Screen, Title, cx, messageOf } from "../ui";
import { useAsync } from "../ui/useAsync";

export function Join({ code }: { code: string }) {
  const { data, error, loading, reload } = useAsync(() => api.event(code), [code]);
  const [picked, setPicked] = useState<Spot | null>(null);
  const [busy, setBusy] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  async function claim(spot: Spot) {
    setBusy(true);
    setClaimError(null);
    try {
      const { token, participant } = await api.claim(code, spot.id);
      setParticipant(store, code, data!.event.name, { token, id: participant.id, name: participant.name });
      notifySessionChange();
    } catch (err) {
      setClaimError(messageOf(err));
      setPicked(null);
      void reload();
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <Screen>Loading…</Screen>;
  if (error || !data) {
    return (
      <Screen>
        <Title>Hmm.</Title>
        <p className="mt-2 text-muted">{error ?? "No hunt here."}</p>
        <Link href="/" className="mt-6 inline-block font-semibold text-brand-deep underline">
          Try another code
        </Link>
      </Screen>
    );
  }

  const { event, participants } = data;
  const open = participants.filter((p) => !p.claimed);

  return (
    <Screen>
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">{event.code}</p>
      <Title className="mt-1">{event.name}</Title>
      {event.description ? <p className="mt-2 whitespace-pre-line text-muted">{event.description}</p> : null}

      <h2 className="mb-3 mt-8 font-semibold">Who are you?</h2>
      {claimError ? (
        <div className="mb-3">
          <Notice tone="danger">{claimError}</Notice>
        </div>
      ) : null}
      {!participants.length ? <Notice>The organizer hasn't added anyone yet. Ask them to add your name.</Notice> : null}
      {participants.length && !open.length ? <Notice>Every spot is taken. If one of them is you, ask an organizer to release it.</Notice> : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {participants.map((p) => (
          <button
            key={p.id}
            disabled={p.claimed || busy}
            onClick={() => setPicked(p)}
            className={cx(
              "min-h-14 rounded-lg border px-3 text-left font-semibold transition",
              p.claimed ? "border-hairline bg-hairline/30 text-muted" : "border-hairline bg-paper-soft hover:border-brand",
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="truncate">{p.name}</span>
              {p.claimed ? <Lock className="size-4 shrink-0" /> : null}
            </span>
            {p.claimed ? <span className="block text-xs font-normal">taken</span> : null}
          </button>
        ))}
      </div>

      {picked ? (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-ink/50 p-4 sm:items-center" onClick={() => !busy && setPicked(null)}>
          <div className="w-full max-w-md rounded-xl bg-paper p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-2xl font-semibold text-brand-deep">You're {picked.name}?</h3>
            <p className="mt-2 text-muted">
              This phone becomes {picked.name} for the whole hunt. It can't be undone here — only an organizer can release the spot.
            </p>
            <div className="mt-5 flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setPicked(null)} disabled={busy}>
                Not me
              </Button>
              <Button className="flex-1" busy={busy} onClick={() => claim(picked)}>
                Yes, that's me
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <p className="mt-10 text-center text-sm text-muted">
        Organizing this hunt?{" "}
        <Link href={`/o/${code}`} className="font-semibold text-brand-deep underline">
          Sign in as organizer
        </Link>
      </p>
    </Screen>
  );
}
