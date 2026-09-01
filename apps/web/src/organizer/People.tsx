/**
 * People — the roster and its claims. "Release" is the one undo the app has:
 * it logs that device out and reopens the name.
 */
import { Lock, Unlock, UserMinus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../api";
import { formatAgo } from "../format";
import { Button, Card, Empty, Field, Heading, Notice, Pill, Screen, Spinner, Textarea, messageOf } from "../ui";
import { useAsync } from "../ui/useAsync";
import { useOrg } from "./context";

export function People() {
  const { code } = useOrg();
  const { data, error, loading, reload } = useAsync(() => api.roster(code), [code]);
  const [names, setNames] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setActionError(null);
    try {
      const { created, skipped } = await api.addPeople(code, names);
      setNote(`Added ${created.length}${skipped.length ? `, ${skipped.length} already there` : ""}.`);
      setNames("");
      await reload();
    } catch (err) {
      setActionError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function act(label: string, fn: () => Promise<unknown>) {
    if (!window.confirm(label)) return;
    setActionError(null);
    try {
      await fn();
      await reload();
    } catch (err) {
      setActionError(messageOf(err));
    }
  }

  const people = data?.participants ?? [];
  const claimed = people.filter((p) => p.claim).length;

  return (
    <Screen>
      <form onSubmit={add} className="space-y-3">
        <Field label="Add people" hint="One per line or comma-separated. These are the names players pick from.">
          <Textarea value={names} onChange={(e) => setNames(e.target.value)} placeholder={"Ana\nBob\nCarla"} />
        </Field>
        {note ? <Notice tone="ok">{note}</Notice> : null}
        <Button type="submit" busy={busy} disabled={!names.trim()} className="w-full">Add to roster</Button>
      </form>

      <div className="mb-3 mt-8 flex items-baseline justify-between">
        <Heading>Roster</Heading>
        <span className="text-sm text-muted">{claimed} of {people.length} claimed</span>
      </div>
      {actionError ? <div className="mb-3"><Notice tone="danger">{actionError}</Notice></div> : null}
      {loading && !data ? <Spinner /> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {data && !people.length ? <Empty>Nobody yet. Add names above, then share the code.</Empty> : null}
      <div className="space-y-2">
        {people.map((p) => (
          <Card key={p.id} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-semibold">{p.name}</div>
              <div className="mt-0.5 text-xs text-muted">
                {p.claim ? (
                  <Pill tone="brand"><Lock className="size-3" /> {p.claim.device_label ?? "a device"} · claimed {formatAgo(p.claim.created_at)}</Pill>
                ) : (
                  <Pill>open</Pill>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              {p.claim ? (
                <Button variant="secondary" className="px-3" title="Release this spot" onClick={() => act(`Release ${p.name}'s spot? Their phone is signed out and anyone can claim the name again. Their proofs and points stay.`, () => api.releaseSpot(code, p.id))}>
                  <Unlock className="size-4" /> Release
                </Button>
              ) : null}
              <Button variant="danger" className="px-3" title="Remove from roster" onClick={() => act(`Remove ${p.name} from the roster?`, () => api.removePerson(code, p.id))}>
                <UserMinus className="size-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </Screen>
  );
}
