"use client";
/** Settings — the event's fields, and the two links to share. */
import { Copy } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { describeBonus } from "../format";
import { Button, Card, Field, Heading, Input, Notice, Screen, Textarea, Toggle, messageOf } from "../ui";
import { useOrg } from "./context";

export function Settings() {
  const { code, event, setEvent } = useOrg();
  const [name, setName] = useState(event.name);
  const [description, setDescription] = useState(event.description ?? "");
  const [autoApprove, setAutoApprove] = useState(event.auto_approve);
  const [bonus, setBonus] = useState(event.group_bonus_pct);
  const [cap, setCap] = useState(event.group_bonus_cap);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Read after mount: there is no window on the server.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const joinUrl = `${origin}/e/${code}`;
  const orgUrl = `${origin}/o/${code}`;

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      window.prompt("Copy this link", text);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await api.updateEvent(code, { name: name.trim(), description: description.trim() || null, auto_approve: autoApprove, group_bonus_pct: bonus, group_bonus_cap: cap });
      setEvent(res.event);
      setNote("Saved.");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Heading className="mb-3">Share</Heading>
      <Card className="space-y-3">
        <div>
          <div className="text-sm text-muted">Players join with the code</div>
          <div className="font-mono text-4xl font-bold tracking-[0.2em] text-brand-deep">{code}</div>
        </div>
        <div className="flex items-center gap-2">
          <Input readOnly value={joinUrl} className="font-mono text-sm" />
          <Button variant="secondary" className="shrink-0 px-3" onClick={() => copy(joinUrl)}><Copy className="size-4" /> {copied === joinUrl ? "Copied" : "Copy"}</Button>
        </div>
        <div className="flex items-center gap-2">
          <Input readOnly value={orgUrl} className="font-mono text-sm" />
          <Button variant="secondary" className="shrink-0 px-3" onClick={() => copy(orgUrl)}><Copy className="size-4" /> {copied === orgUrl ? "Copied" : "Copy"}</Button>
        </div>
        <p className="text-xs text-muted">Co-organizers open the second link and enter the passphrase.</p>
      </Card>

      <Heading className="mb-3 mt-8">Hunt</Heading>
      <form onSubmit={save} className="space-y-5">
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} /></Field>
        <Field label="Description"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} /></Field>
        <Toggle checked={autoApprove} onChange={setAutoApprove} label="Count proofs immediately" hint={autoApprove ? "Points land on upload; reject later if needed." : "Every proof waits in Review."} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Group bonus %"><Input type="number" min={0} max={500} value={bonus} onChange={(e) => setBonus(Number(e.target.value))} /></Field>
          <Field label="Bonus cap %"><Input type="number" min={0} max={500} value={cap} onChange={(e) => setCap(Number(e.target.value))} /></Field>
        </div>
        <Notice tone="brand">{describeBonus(bonus, cap)}. Changing it re-scores every proof — nothing is stored, points are always derived.</Notice>
        {note ? <Notice tone="ok">{note}</Notice> : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button type="submit" busy={busy} className="w-full">Save</Button>
      </form>
    </Screen>
  );
}
