"use client";
import { ArrowRight, MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Card, Field, Input, LinkButton, Pill, Screen, Title } from "../ui";
import { useHunts } from "../useSession";

export function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const hunts = useHunts() ?? [];

  function join(e: FormEvent) {
    e.preventDefault();
    const clean = code.trim().toUpperCase().replace(/[\s-]/g, "");
    if (clean) router.push(`/e/${clean}`);
  }

  return (
    <Screen>
      <div className="mb-10 mt-6 flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-lg bg-brand text-white">
          <MapPin className="size-6" />
        </span>
        <div>
          <Title>Walkspot</Title>
          <p className="text-muted">Challenges, proof photos, points. Walk it.</p>
        </div>
      </div>

      <form onSubmit={join} className="mb-6 space-y-3">
        <Field label="Got a hunt code?" hint="Six letters — ask whoever organized it.">
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABC234" autoCapitalize="characters" autoCorrect="off" spellCheck={false} maxLength={8} className="text-center font-mono text-2xl tracking-[0.3em]" />
        </Field>
        <Button type="submit" className="w-full" disabled={code.trim().length < 6}>
          Join the hunt <ArrowRight className="size-4" />
        </Button>
      </form>

      <p className="mb-10 text-center text-sm text-muted">
        Organizing one?{" "}
        <Link href="/new" className="font-semibold text-brand-deep underline">
          Create a hunt
        </Link>
      </p>

      {hunts.length ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Your hunts on this device</h2>
          {hunts.map((h) => (
            <Card key={h.code} className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{h.name}</div>
                <div className="text-sm text-muted">
                  {h.code}
                  {h.as ? ` · you are ${h.as}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                {h.role !== "organizer" ? <LinkButton to={`/e/${h.code}`} variant="secondary">Play</LinkButton> : null}
                {h.role !== "participant" ? <LinkButton to={`/o/${h.code}`} variant="secondary">Organize</LinkButton> : null}
              </div>
            </Card>
          ))}
        </section>
      ) : null}
      <p className="mt-12 text-center text-xs text-muted">
        <Pill>no accounts</Pill> Your spot lives on this phone. Only an organizer can move it.
      </p>
    </Screen>
  );
}
