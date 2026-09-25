import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

/** Fetch `path`, refetching when it changes; `null` skips. */
export function useApi<T>(path: string | null, opts: { poll?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(!!path);
  const seq = useRef(0);

  const load = useCallback(
    async (silent = false) => {
      if (!path) return;
      const my = ++seq.current;
      if (!silent) setLoading(true);
      try {
        const d = await api<T>(path);
        if (my === seq.current) {
          setData(d);
          setError(null);
        }
      } catch (e) {
        if (my === seq.current) setError(e as Error);
      } finally {
        if (my === seq.current) setLoading(false);
      }
    },
    [path],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!opts.poll || !path) return;
    const t = setInterval(() => load(true), opts.poll);
    return () => clearInterval(t);
  }, [opts.poll, load, path]);

  return { data, error, loading, reload: () => load(true), setData };
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
