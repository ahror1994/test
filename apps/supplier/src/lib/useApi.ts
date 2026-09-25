import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { api, ApiError } from './api';

/** Fetches `path`, refetches on screen focus, optional polling. `path = null` disables. */
export function useApi<T>(path: string | null, opts: { interval?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  // The path whose first request has settled; loading is derived from it instead of toggled in an effect.
  const [settled, setSettled] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const pathRef = useRef(path);
  useLayoutEffect(() => {
    pathRef.current = path;
  }, [path]);

  const load = useCallback(async () => {
    const p = pathRef.current;
    if (!p) return;
    try {
      const d = await api<T>(p);
      if (pathRef.current === p) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (pathRef.current === p) setError(e instanceof ApiError ? e : new ApiError('network', 0));
    } finally {
      if (pathRef.current === p) setSettled(p);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (path) void load();
  }, [path, load]);

  useFocusEffect(
    useCallback(() => {
      void load();
      if (!opts.interval) return;
      const id = setInterval(() => void load(), opts.interval);
      return () => clearInterval(id);
    }, [load, opts.interval]),
  );

  const loading = !!path && settled !== path && !data;
  return {
    data,
    setData,
    error,
    loading,
    refreshing,
    reload: load,
    refresh: () => {
      setRefreshing(true);
      return load();
    },
  };
}
