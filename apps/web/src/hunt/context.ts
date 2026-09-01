import { createContext, useContext } from "react";
import type { Event, Person } from "../api";

export type Hunt = { code: string; event: Event; me: Person; refreshEvent: () => Promise<void> };

export const HuntContext = createContext<Hunt | null>(null);

export function useHunt(): Hunt {
  const hunt = useContext(HuntContext);
  if (!hunt) throw new Error("useHunt outside HuntLayout");
  return hunt;
}
