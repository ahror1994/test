import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { errorText } from '@/i18n';
import { serverReady, serverUrl, useServer } from './server';
import { toast, useApp } from './store';

/** Current server base URL (`''` on web = same origin). Changeable at runtime on native. */
export const apiUrl = serverUrl;

/** Uploaded files come back as relative `/uploads/...` paths. */
export function img(u?: string | null): string | null {
  if (!u) return null;
  return u.startsWith('/') ? serverUrl() + u : u;
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

// RN's Android HTTP client has no timeouts of its own, so an unreachable LAN host would spin forever.
const TIMEOUT_MS = 12_000;
const UPLOAD_TIMEOUT_MS = 90_000;

export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  await serverReady();
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
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.form ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS);
  try {
    res = await fetch(`${serverUrl()}/api/c${path}`, { method: opts.method ?? (body ? 'POST' : 'GET'), headers, body, signal: ctrl.signal });
  } catch {
    clearTimeout(timer);
    throw new ApiError('network', 0);
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // A body cut off by the timeout is a connection problem, not an empty answer.
    if (ctrl.signal.aborted) throw new ApiError('network', 0);
  } finally {
    clearTimeout(timer);
  }
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
  const server = useServer((s) => s.url);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);
  const hasData = useRef(false);
  useEffect(() => {
    hasData.current = data != null;
  }, [data]);
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
        // With data already on screen the error view stays hidden, so a failed pull-to-refresh needs a toast.
        if (mode === 'refresh' && hasData.current) toast(errorText(e), 'error');
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
  }, [load, blocked, token, needsAuth, server]);

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
