import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { api, ApiError } from './api';

/** Fetches `path`, refetches on screen focus, optional polling. `path = null` disables. */
export function useApi<T>(path: string | null, opts: { interval?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [refreshing, setRefreshing] = useState(false);
  const pathRef = useRef(path);
  pathRef.current = path;

  const load = useCallback(async (mode: 'initial' | 'silent' | 'pull' = 'silent') => {
    const p = pathRef.current;
    if (!p) return;
    if (mode === 'pull') setRefreshing(true);
    try {
      const d = await api<T>(p);
      if (pathRef.current === p) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (pathRef.current === p) setError(e instanceof ApiError ? e : new ApiError('network', 0));
    } finally {
      if (pathRef.current === p) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!path) return;
    setLoading(true);
    void load('initial');
  }, [path, load]);

  useFocusEffect(
    useCallback(() => {
      void load('silent');
      if (!opts.interval) return;
      const id = setInterval(() => void load('silent'), opts.interval);
      return () => clearInterval(id);
    }, [load, opts.interval]),
  );

  return { data, setData, error, loading: loading && !data, refreshing, reload: () => load('silent'), refresh: () => load('pull') };
}
