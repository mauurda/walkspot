import { createContext, useContext } from "react";
import type { Event } from "../api";

export type Org = { code: string; event: Event; setEvent: (e: Event) => void };

export const OrgContext = createContext<Org | null>(null);

export function useOrg(): Org {
  const org = useContext(OrgContext);
  if (!org) throw new Error("useOrg outside OrganizerLayout");
  return org;
}
