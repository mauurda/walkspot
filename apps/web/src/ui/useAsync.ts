/** useAsync — load once (and on demand) with the three states a screen needs. */
import { useCallback, useEffect, useState } from "react";

/**
 * `refreshMs` turns a screen live: it re-reads on that interval and the moment
 * the tab comes back to the foreground. A hunt's board is the drama of the
 * afternoon and a phone that slept through four proofs must not show a stale
 * one. Polling pauses while the tab is hidden — nobody's battery pays for a
 * leaderboard in a pocket — and a refresh never flips `loading`, so a live
 * screen doesn't blink a spinner every tick.
 *
 * It also keeps signed media URLs alive: they expire in an hour, and a screen
 * left open past that re-reads long before its images go dead.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], options: { refreshMs?: number } = {}) {
  const { refreshMs } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const run = useCallback(async (quiet: boolean) => {
    if (!quiet) setLoading(true);
    try {
      setData(await fn());
      setError(null);
    } catch (err) {
      // A failed background poll keeps the screen it already has: one flaky
      // minute on a walk must not replace a working board with an error.
      if (!quiet) setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      if (!quiet) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const reload = useCallback(() => run(false), [run]);

  useEffect(() => {
    void run(false);
  }, [run]);

  useEffect(() => {
    if (!refreshMs) return;
    const tick = () => {
      if (document.visibilityState === "visible") void run(true);
    };
    const timer = setInterval(tick, refreshMs);
    // Coming back to the app should feel current immediately, not in 30s.
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refreshMs, run]);

  return { data, error, loading, reload, setData };
}
