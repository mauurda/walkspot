/**
 * useSession — this device's sessions, read after mount. Pages are
 * server-rendered with no session (there is no localStorage on the server),
 * so a read during render would hydrate against the wrong screen. `null`
 * means "not read yet"; screens show a spinner for that instant.
 */
import { useEffect, useState } from "react";
import { onSessionChange, store } from "./api";
import { getHunt, listHunts, type HuntSession } from "./session";

export function useHuntSession(code: string): HuntSession | null {
  const [session, setSession] = useState<HuntSession | null>(null);
  useEffect(() => {
    const read = () => setSession(getHunt(store, code));
    read();
    return onSessionChange(read);
  }, [code]);
  return session;
}

export function useHunts(): ReturnType<typeof listHunts> | null {
  const [hunts, setHunts] = useState<ReturnType<typeof listHunts> | null>(null);
  useEffect(() => {
    const read = () => setHunts(listHunts(store));
    read();
    return onSessionChange(read);
  }, []);
  return hunts;
}
