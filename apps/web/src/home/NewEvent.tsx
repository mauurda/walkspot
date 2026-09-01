import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { api, store } from "../api";
import { describeBonus } from "../format";
import { setOrganizer } from "../session";
import { Button, Field, Input, Notice, Screen, Textarea, Title, Toggle, messageOf } from "../ui";

export function NewEvent() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [autoApprove, setAutoApprove] = useState(true);
  const [bonus, setBonus] = useState(25);
  const [cap, setCap] = useState(100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { event, token } = await api.createEvent({
        name: name.trim(),
        description: description.trim() || null,
        passphrase: passphrase.trim(),
        auto_approve: autoApprove,
        group_bonus_pct: bonus,
        group_bonus_cap: cap,
      });
      setOrganizer(store, event.code, event.name, { token });
      navigate(`/o/${event.code}`, { replace: true });
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Link to="/" className="text-sm text-muted">
        ← Walkspot
      </Link>
      <Title className="mb-1 mt-4">New hunt</Title>
      <p className="mb-6 text-muted">You'll add people and challenges next.</p>
      <form onSubmit={submit} className="space-y-5">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Old town Saturday" required maxLength={80} />
        </Field>
        <Field label="Description" hint="Optional. Shown to everyone who joins.">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Meet at the fountain at 10. Be back by 1." maxLength={2000} />
        </Field>
        <Field label="Organizer passphrase" hint="Share it with co-organizers. It's the only way to sign in as one from another phone.">
          <Input value={passphrase} onChange={(e) => setPassphrase(e.target.value)} placeholder="at least 4 characters" required minLength={4} autoCapitalize="off" />
        </Field>
        <Toggle checked={autoApprove} onChange={setAutoApprove} label="Count proofs immediately" hint={autoApprove ? "Points land the moment a photo is up. You can still reject later." : "Every proof waits for an organizer's approval."} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Group bonus %" hint="per extra person in the shot">
            <Input type="number" min={0} max={500} value={bonus} onChange={(e) => setBonus(Number(e.target.value))} />
          </Field>
          <Field label="Bonus cap %">
            <Input type="number" min={0} max={500} value={cap} onChange={(e) => setCap(Number(e.target.value))} />
          </Field>
        </div>
        <Notice tone="brand">{describeBonus(bonus, cap)}. Example: a 100-point challenge done as a group of three is worth {Math.round(100 * (1 + Math.min(cap, bonus * 2) / 100))} points to each of them.</Notice>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button type="submit" busy={busy} className="w-full">
          Create hunt
        </Button>
      </form>
    </Screen>
  );
}
