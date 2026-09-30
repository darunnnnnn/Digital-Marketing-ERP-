import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Runs an async read and tracks its state.
 *
 * The old build fetched on the server and shipped finished HTML. Here each page
 * fetches its own data, so every page needs the same three things: what came
 * back, whether it is still coming, and a way to fetch it again after a change.
 *
 * Two details that matter:
 *   - a result that arrives after the inputs changed is discarded, so a slow
 *     earlier request can't overwrite a newer one;
 *   - `reload()` keeps the current data on screen while refetching, so saving
 *     something doesn't blank the page.
 */
export function useAsync<T>(run: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Held in a ref so `run` can change every render without restarting the fetch.
  const runRef = useRef(run);
  runRef.current = run;

  // Bumped on every fetch; only the newest one may write to state.
  const seq = useRef(0);

  const fetch = useCallback(async (quiet: boolean) => {
    const mine = ++seq.current;
    if (!quiet) setLoading(true);
    try {
      const result = await runRef.current();
      if (mine === seq.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (mine === seq.current) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const reload = useCallback(() => fetch(true), [fetch]);

  return { data, error, loading, reload };
}
