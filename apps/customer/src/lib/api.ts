import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useApp } from './store';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

/** Uploaded files come back as relative `/uploads/...` paths. */
export function img(u?: string | null): string | null {
  if (!u) return null;
  return u.startsWith('/') ? API_URL + u : u;
}

export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

type Opts = { method?: string; body?: unknown; form?: FormData };

export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const token = useApp.getState().token;
  const headers: Record<string, string> = { accept: 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  let body: any;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/c${path}`, { method: opts.method ?? (body ? 'POST' : 'GET'), headers, body });
  } catch {
    throw new ApiError('network', 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const code = (data && data.error) || 'server';
    if (res.status === 401 && token) useApp.getState().logout();
    throw new ApiError(code, res.status);
  }
  return data as T;
}

export async function uploadImage(asset: { uri: string; mimeType?: string | null; fileName?: string | null; file?: File }) {
  const form = new FormData();
  const name = asset.fileName || `photo-${Date.now()}.jpg`;
  if (Platform.OS === 'web') {
    const blob = asset.file ?? (await (await fetch(asset.uri)).blob());
    form.append('file', blob, name);
  } else {
    form.append('file', { uri: asset.uri, name, type: asset.mimeType || 'image/jpeg' } as any);
  }
  return api<{ url: string }>('/upload', { form });
}

type QueryOpts = { refetchOnFocus?: boolean; interval?: number; auth?: boolean };

/** Minimal data hook: initial load, pull-to-refresh, silent refetch on focus / interval. */
export function useQuery<T>(path: string | null, opts: QueryOpts = {}) {
  const token = useApp((s) => s.token);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);
  const needsAuth = !!opts.auth;
  const blocked = !path || (needsAuth && !token);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent') => {
      if (!path || (needsAuth && !useApp.getState().token)) return;
      const id = ++seq.current;
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      try {
        const d = await api<T>(path);
        if (id !== seq.current) return;
        setData(d);
        setError(null);
      } catch (e) {
        if (id !== seq.current) return;
        if (mode !== 'silent') setError(e as ApiError);
      } finally {
        if (id === seq.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [path, needsAuth],
  );

  useEffect(() => {
    if (blocked) {
      setLoading(false);
      if (needsAuth) setData(null);
      return;
    }
    load('initial');
  }, [load, blocked, token, needsAuth]);

  const firstFocus = useRef(true);
  const refetchOnFocus = !!opts.refetchOnFocus;
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      if (refetchOnFocus) load('silent');
    }, [load, refetchOnFocus]),
  );

  const interval = opts.interval ?? 0;
  useEffect(() => {
    if (!interval || blocked) return;
    const h = setInterval(() => load('silent'), interval);
    return () => clearInterval(h);
  }, [interval, blocked, load]);

  return {
    data,
    setData,
    error,
    loading,
    refreshing,
    refresh: () => load('refresh'),
    reload: () => load('silent'),
  };
}
