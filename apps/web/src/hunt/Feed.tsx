"use client";
/** Feed — everyone's proofs, newest first. Both roles read the same list. */
import { api, type Role } from "../api";
import { Empty, Heading, Notice, Screen, Spinner } from "../ui";
import { useAsync } from "../ui/useAsync";
import { ProofCard } from "./ProofCard";

export function Feed({ code, role }: { code: string; role: Role }) {
  const { data, error, loading } = useAsync(() => api.feed(code, role), [code, role], { refreshMs: 20_000 });

  return (
    <Screen>
      <Heading className="mb-4">Proofs</Heading>
      {loading && !data ? <Spinner /> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {data && !data.submissions.length ? <Empty>Nothing yet. The first proof lands here.</Empty> : null}
      <div className="space-y-3">
        {data?.submissions.map((s) => <ProofCard key={s.id} submission={s} />)}
      </div>
    </Screen>
  );
}
