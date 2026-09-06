"use client";
/**
 * ChallengeEditor — the list, and a form that is the same for new and edit.
 * A location is picked on the map (tap) or taken from the phone, with the
 * radius drawn as the number a reviewer will later compare against.
 */
import { ArrowDown, ArrowUp, LocateFixed, MapPin, Pencil, Plus, Repeat2, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api, type Challenge, type ChallengeInput } from "../api";
import { locate } from "../geo";
import { Map, type Pin } from "../map";
import { Button, Card, Empty, Field, Heading, Input, Notice, Pill, Screen, Spinner, Textarea, Toggle, messageOf } from "../ui";
import { useAsync } from "../ui/useAsync";
import { useOrg } from "./context";

const BLANK: ChallengeInput = { title: "", description: null, points: 10, lat: null, lng: null, radius_m: 100, repeat_label: null, repeat_options: null, max_awards: 1 };

export function ChallengeEditor() {
  const { code } = useOrg();
  const { data, error, loading, reload, setData } = useAsync(() => api.challenges(code, "organizer"), [code]);
  const [editing, setEditing] = useState<{ id: string | null; input: ChallengeInput } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const challenges = data?.challenges ?? [];

  async function move(index: number, dir: -1 | 1) {
    const ids = challenges.map((c) => c.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    try {
      const res = await api.reorderChallenges(code, ids);
      setData(res);
    } catch (err) {
      setActionError(messageOf(err));
    }
  }

  async function archive(c: Challenge) {
    if (!window.confirm(`Archive "${c.title}"? Proofs already sent for it stop counting.`)) return;
    try {
      await api.archiveChallenge(code, c.id);
      await reload();
    } catch (err) {
      setActionError(messageOf(err));
    }
  }

  if (editing) {
    return (
      <Screen>
        <ChallengeForm
          initial={editing.input}
          isNew={editing.id === null}
          others={challenges.filter((c) => c.id !== editing.id)}
          onCancel={() => setEditing(null)}
          onSave={async (input) => {
            if (editing.id) await api.updateChallenge(code, editing.id, input);
            else await api.createChallenge(code, input);
            setEditing(null);
            await reload();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <div className="mb-4 flex items-center justify-between">
        <Heading>Challenges</Heading>
        <Button onClick={() => setEditing({ id: null, input: BLANK })}><Plus className="size-4" /> New</Button>
      </div>
      {actionError ? <div className="mb-3"><Notice tone="danger">{actionError}</Notice></div> : null}
      {loading && !data ? <Spinner /> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {data && !challenges.length ? <Empty>No challenges yet. Add the first one.</Empty> : null}
      <div className="space-y-2">
        {challenges.map((c, i) => (
          <Card key={c.id} className="flex items-center gap-3">
            <div className="flex flex-col">
              <button className="p-1 text-muted disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-4" /></button>
              <button className="p-1 text-muted disabled:opacity-30" disabled={i === challenges.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-4" /></button>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{c.title}</div>
              <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                <Pill tone="brand">{c.points} pts</Pill>
                {c.lat != null ? <Pill><MapPin className="size-3" /> {c.radius_m} m</Pill> : <Pill>anywhere</Pill>}
                {c.repeat_label ? <Pill><Repeat2 className="size-3" /> ×{c.max_awards} · {c.repeat_label}</Pill> : null}
              </div>
            </div>
            <Button variant="ghost" className="px-2" onClick={() => setEditing({ id: c.id, input: { title: c.title, description: c.description, points: c.points, lat: c.lat, lng: c.lng, radius_m: c.radius_m ?? 100, repeat_label: c.repeat_label, repeat_options: c.repeat_options, max_awards: c.max_awards } })}><Pencil className="size-4" /></Button>
            <Button variant="ghost" className="px-2 text-danger" onClick={() => archive(c)}><Trash2 className="size-4" /></Button>
          </Card>
        ))}
      </div>
    </Screen>
  );
}

function ChallengeForm({ initial, isNew, others, onSave, onCancel }: { initial: ChallengeInput; isNew: boolean; others: Challenge[]; onSave: (input: ChallengeInput) => Promise<void>; onCancel: () => void }) {
  const [input, setInput] = useState<ChallengeInput>(initial);
  const [located, setLocated] = useState(initial.lat != null);
  const [repeats, setRepeats] = useState(Boolean(initial.repeat_label));
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<ChallengeInput>) => setInput((prev) => ({ ...prev, ...patch }));

  async function useMyLocation() {
    setLocating(true);
    try {
      const fix = await locate();
      set({ lat: fix.lat, lng: fix.lng });
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLocating(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (located && input.lat == null) return setError("Tap the map or use your location to place this challenge.");
    setBusy(true);
    try {
      await onSave(located ? { ...input, radius_m: input.radius_m ?? 100 } : { ...input, lat: null, lng: null, radius_m: null });
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  const otherPins: Pin[] = others.filter((c) => c.lat != null).map((c) => ({ id: c.id, lat: c.lat!, lng: c.lng!, label: "•", title: c.title, tone: "off" }));
  const pins: Pin[] = input.lat != null && input.lng != null ? [...otherPins, { id: "this", lat: input.lat, lng: input.lng, label: "★", title: input.title || "This challenge" }] : otherPins;
  const fitTo: [number, number][] | undefined = input.lat != null && input.lng != null ? [[input.lat, input.lng]] : undefined;

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex items-center justify-between">
        <Heading>{isNew ? "New challenge" : "Edit challenge"}</Heading>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
      <Field label="Title">
        <Input value={input.title} onChange={(e) => set({ title: e.target.value })} required maxLength={120} placeholder="Selfie with the bronze lion" autoFocus />
      </Field>
      <Field label="Description" hint="What counts, what doesn't.">
        <Textarea value={input.description ?? ""} onChange={(e) => set({ description: e.target.value || null })} maxLength={2000} />
      </Field>
      <Field label="Points">
        <Input type="number" min={1} max={10000} value={input.points} onChange={(e) => set({ points: Number(e.target.value) })} required />
      </Field>
      <Toggle
        checked={repeats}
        onChange={(on) => {
          setRepeats(on);
          if (!on) set({ repeat_label: null, repeat_options: null, max_awards: 1 });
          else set({ repeat_label: input.repeat_label || "Which one?", max_awards: Math.max(2, input.max_awards) });
        }}
        label="Can be done more than once"
        hint={repeats ? "Counts once per distinct answer, up to the cap." : "Counts once, however many proofs arrive."}
      />
      {repeats ? (
        <div className="space-y-3">
          <Field label="Counts once per…" hint='The question each proof answers. "Which park?", "Which city?"'>
            <Input value={input.repeat_label ?? ""} onChange={(e) => set({ repeat_label: e.target.value || null })} maxLength={80} required placeholder="Which park?" />
          </Field>
          <Field label="Cap" hint="How many distinct answers can score.">
            <Input type="number" min={1} max={50} value={input.max_awards} onChange={(e) => set({ max_awards: Number(e.target.value) })} required />
          </Field>
          <Field
            label="Answers"
            hint="One per line. Leave empty to let players type their own — a fixed list keeps spellings from splitting the board."
          >
            <Textarea
              value={(input.repeat_options ?? []).join("\n")}
              onChange={(e) => {
                const options = e.target.value.split("\n").map((o) => o.trim()).filter(Boolean);
                set({ repeat_options: options.length ? options : null });
              }}
              className="min-h-28"
              placeholder={"SF\nHyderabad\nBerlin"}
            />
          </Field>
        </div>
      ) : null}
      <Toggle checked={located} onChange={setLocated} label="Tied to a place" hint={located ? "Players see it on the map and can route to it." : "Can be done anywhere."} />
      {located ? (
        <div className="space-y-3">
          <Map pins={pins} onPick={(p) => set({ lat: p.lat, lng: p.lng })} fitTo={fitTo} className="h-64 w-full rounded-lg" />
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={useMyLocation} busy={locating}><LocateFixed className="size-4" /> Use my location</Button>
            <span className="text-sm text-muted">{input.lat != null ? `${input.lat.toFixed(5)}, ${input.lng!.toFixed(5)}` : "or tap the map"}</span>
          </div>
          <Field label="Radius (m)" hint="How close a proof's GPS fix should be. Shown to you at review, never enforced.">
            <Input type="number" min={10} max={5000} value={input.radius_m ?? 100} onChange={(e) => set({ radius_m: Number(e.target.value) })} />
          </Field>
        </div>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button type="submit" busy={busy} className="w-full">{isNew ? "Add challenge" : "Save"}</Button>
    </form>
  );
}
