"use client";
/**
 * ChallengeDetail — one challenge, and the proof form. Upload is three
 * steps (slot → PUT → file), each reported, because a walk is exactly where
 * an upload stalls and "Uploading…" for a minute needs to say which part.
 */
import { Camera, Images, MapPin, Users } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api, putFile, type Submission } from "../api";
import { formatAgo, formatDistance, formatPoints } from "../format";
import { locate } from "../geo";
import { prepare } from "../image";
import { Map } from "../map";
import { Button, Card, Field, Heading, Media, Notice, Pill, Screen, Spinner, Textarea, cx, messageOf } from "../ui";
import { useAsync } from "../ui/useAsync";
import { useHunt } from "./context";
import { StatusPill } from "./status";

type Step = "idle" | "locating" | "preparing" | "uploading" | "filing";
const STEP_LABEL: Record<Step, string> = { idle: "Send proof", locating: "Getting your location…", preparing: "Preparing photo…", uploading: "Uploading…", filing: "Filing proof…" };

export function ChallengeDetail({ id }: { id: string }) {
  const { code, event, me } = useHunt();
  const all = useAsync(() => api.challenges(code, "participant"), [code]);
  const people = useAsync(() => api.people(code), [code]);
  const mine = useAsync(() => api.feed(code, "participant", { challenge: id, mine: true }), [code, id]);

  const challenge = all.data?.challenges.find((c) => c.id === id);
  const others = useMemo(() => (people.data?.participants ?? []).filter((p) => p.id !== me.id), [people.data, me.id]);

  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [tagged, setTagged] = useState<Set<string>>(new Set());
  const [caption, setCaption] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Submission | null>(null);

  function pick(capture: boolean) {
    const input = fileInput.current!;
    if (capture) input.setAttribute("capture", "environment");
    else input.removeAttribute("capture");
    input.click();
  }

  function onFile(f: File | null) {
    setFile(f);
    setSent(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  const worth = challenge ? Math.round(challenge.points * (1 + Math.min(event.group_bonus_cap, event.group_bonus_pct * tagged.size) / 100)) : 0;

  async function send() {
    if (!file || !challenge) return;
    setError(null);
    try {
      setStep("locating");
      const fix = challenge.lat != null ? await locate().catch(() => null) : await locate().catch(() => null);
      setStep("preparing");
      const { blob, contentType } = await prepare(file);
      setStep("uploading");
      const slot = await api.uploadUrl(code, { challenge_id: challenge.id, content_type: contentType, size: blob.size });
      await putFile(slot.url, blob, contentType);
      setStep("filing");
      const { submission } = await api.submit(code, {
        challenge_id: challenge.id,
        path: slot.path,
        caption: caption.trim() || null,
        member_ids: [...tagged],
        lat: fix?.lat ?? null,
        lng: fix?.lng ?? null,
      });
      setSent(submission);
      onFile(null);
      setCaption("");
      setTagged(new Set());
      void mine.reload();
      void all.reload();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setStep("idle");
    }
  }

  if (!all.data && all.loading) return <Screen><Spinner /></Screen>;
  if (!challenge) {
    return (
      <Screen>
        <Notice tone="danger">{all.error ?? "This challenge is gone."}</Notice>
        <Link href={`/e/${code}`} className="mt-4 inline-block underline">Back to challenges</Link>
      </Screen>
    );
  }

  const located = challenge.lat != null && challenge.lng != null;

  return (
    <Screen>
      <Link href={`/e/${code}`} className="text-sm text-muted">← All challenges</Link>
      <div className="mt-3 flex items-start justify-between gap-3">
        <Heading className="text-2xl">{challenge.title}</Heading>
        <div className="shrink-0 text-right">
          <div className="font-display text-2xl font-semibold text-brand-deep">{challenge.points}</div>
          <div className="text-xs text-muted">pts</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {located ? <Pill tone="brand"><MapPin className="size-3" /> at a place</Pill> : <Pill>anywhere</Pill>}
        {challenge.mine ? <StatusPill status={challenge.mine.status} /> : null}
      </div>
      {challenge.description ? <p className="mt-3 whitespace-pre-line">{challenge.description}</p> : null}
      {located ? (
        <div className="mt-4">
          <Map pins={[{ id: challenge.id, lat: challenge.lat!, lng: challenge.lng!, label: "•", title: challenge.title }]} className="h-52 w-full rounded-lg" />
        </div>
      ) : null}

      <section className="mt-8">
        <Heading>Prove it</Heading>
        <p className="mb-3 text-sm text-muted">
          A photo or video of the challenge done. Tag whoever's in it with you — {event.group_bonus_pct > 0 ? `each extra person adds ${event.group_bonus_pct}% (up to ${event.group_bonus_cap}%), for everyone tagged.` : "everyone tagged gets the points."}
        </p>
        <input ref={fileInput} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        {sent ? <div className="mb-3"><Notice tone="ok">Proof sent{sent.status === "approved" ? ` — ${formatPoints(sent.points)} for ${sent.members.length === 1 ? "you" : `${sent.members.length} of you`}.` : ". An organizer will review it."}</Notice></div> : null}
        {!file ? (
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => pick(true)}><Camera className="size-4" /> Camera</Button>
            <Button variant="secondary" onClick={() => pick(false)}><Images className="size-4" /> Library</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Card className="overflow-hidden p-0">
              {preview ? <Media url={preview} type={file.type.startsWith("video/") ? "video" : "image"} className="max-h-96" /> : null}
              <div className="flex items-center justify-between px-4 py-2 text-sm text-muted">
                <span className="truncate">{file.name}</span>
                <button className="font-semibold text-brand-deep" onClick={() => onFile(null)}>Change</button>
              </div>
            </Card>
            {others.length ? (
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold"><Users className="size-4" /> Who's in it with you?</div>
                <div className="flex flex-wrap gap-2">
                  {others.map((p) => {
                    const on = tagged.has(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setTagged((prev) => { const next = new Set(prev); if (on) next.delete(p.id); else next.add(p.id); return next; })}
                        className={cx("min-h-10 rounded-full border px-3.5 text-sm font-semibold transition", on ? "border-brand bg-brand text-white" : "border-hairline bg-paper-soft")}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-sm text-muted">Worth <span className="font-semibold text-ink">{formatPoints(worth)}</span> to each of the {tagged.size + 1} of you.</p>
              </div>
            ) : null}
            <Field label="Caption" hint="Optional.">
              <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={500} className="min-h-16" />
            </Field>
            {error ? <Notice tone="danger">{error}</Notice> : null}
            <Button className="w-full" busy={step !== "idle"} onClick={send}>{STEP_LABEL[step]}</Button>
          </div>
        )}
      </section>

      {mine.data?.submissions.length ? (
        <section className="mt-8 space-y-3">
          <Heading>Your proofs here</Heading>
          {mine.data.submissions.map((s) => (
            <Card key={s.id} className="overflow-hidden p-0">
              <Media url={s.media_url} type={s.media_type} className="max-h-80" />
              <div className="space-y-1 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusPill status={s.status} />
                  {s.status === "approved" ? <Pill tone="brand">{formatPoints(s.points)}</Pill> : null}
                  {s.distance_m != null ? <Pill>{formatDistance(s.distance_m)} from the spot</Pill> : null}
                </div>
                <div className="text-muted">{s.members.map((m) => m.name).join(", ")} · {formatAgo(s.created_at)}</div>
                {s.caption ? <div>{s.caption}</div> : null}
                {s.review_note ? <div className="text-danger">Organizer: {s.review_note}</div> : null}
              </div>
            </Card>
          ))}
        </section>
      ) : null}
    </Screen>
  );
}
