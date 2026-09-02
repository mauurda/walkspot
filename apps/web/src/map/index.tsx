/**
 * The map is browser-only (Leaflet touches `window` at import), so every
 * screen loads it through this dynamic import and never on the server.
 */
import dynamic from "next/dynamic";

export type { Pin } from "./Map";

export const Map = dynamic(() => import("./Map").then((m) => m.Map), {
  ssr: false,
  loading: () => <div className="h-72 w-full animate-pulse rounded-lg bg-hairline/40" />,
});
