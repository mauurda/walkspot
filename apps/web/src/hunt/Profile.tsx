"use client";
/**
 * Profile — your hunt, on one screen: where you stand, and every proof you
 * are credited on. Credited, not uploaded: a proof someone else shot and
 * tagged you into is as much yours as one you sent, and it pays you the same
 * points, so it belongs here.
 */
import { api } from "../api";
import { formatPoints } from "../format";
import { Card, Empty, Heading, Notice, Screen, Spinner } from "../ui";
import { useAsync } from "../ui/useAsync";
import { useHunt } from "./context";
import { ProofCard } from "./ProofCard";

export function Profile() {
  const { code, me } = useHunt();
  const board = useAsync(() => api.board(code, "participant"), [code], { refreshMs: 30_000 });
  const proofs = useAsync(() => api.feed(code, "participant", { mine: true }), [code], { refreshMs: 30_000 });

  const row = board.data?.rows.find((r) => r.participant_id === me.id);
  const submissions = proofs.data?.submissions ?? [];

  return (
    <Screen>
      <Heading className="mb-4">{me.name}</Heading>

      <Card className="mb-6 grid grid-cols-3 gap-2 text-center">
        <Stat value={row ? formatPoints(row.points) : "—"} label="points" />
        <Stat value={row ? `#${row.rank}` : "—"} label={`of ${board.data?.rows.length ?? 0}`} />
        <Stat value={row ? `${row.completed}` : "—"} label={`of ${board.data?.challenges ?? 0} done`} />
      </Card>
      {row?.pending ? (
        <div className="mb-6"><Notice>{row.pending} {row.pending === 1 ? "proof is" : "proofs are"} waiting on a review.</Notice></div>
      ) : null}

      <Heading className="mb-3">Your proofs</Heading>
      {(board.loading && !board.data) || (proofs.loading && !proofs.data) ? <Spinner /> : null}
      {proofs.error ? <Notice tone="danger">{proofs.error}</Notice> : null}
      {proofs.data && !submissions.length ? (
        <Empty>Nothing yet. Prove a challenge, or get someone to tag you into theirs.</Empty>
      ) : null}
      <div className="space-y-3">
        {submissions.map((s) => <ProofCard key={s.id} submission={s} />)}
      </div>
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-semibold text-brand-deep">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
