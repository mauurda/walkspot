/** One vocabulary for a proof's state, used by cards on both sides. */
import { Check, Clock, X } from "lucide-react";
import { Pill } from "../ui";

export function StatusPill({ status }: { status: "todo" | "pending" | "approved" | "rejected" }) {
  if (status === "approved") return <Pill tone="ok"><Check className="size-3" /> done</Pill>;
  if (status === "pending") return <Pill tone="accent"><Clock className="size-3" /> waiting for review</Pill>;
  if (status === "rejected") return <Pill tone="danger"><X className="size-3" /> not accepted</Pill>;
  return null;
}
