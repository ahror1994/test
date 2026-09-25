import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/** Web is served by the API itself, so it keeps relative URLs; native apps talk to a configurable server. */
export const SERVER_CONFIGURABLE = Platform.OS !== 'web';

/** The owner's computer on the home Wi-Fi — used when the build has no EXPO_PUBLIC_API_URL. */
const FALLBACK_NATIVE_URL = 'http://192.168.0.4:3000';
const K_API_URL = 'taptym.business.apiUrl';

/**
 * Accepts what people actually type ("192.168.0.4:3000", "http://host:3000/supplier/", "192,168,0,4")
 * and returns the server origin, or '' when it is not a usable address. The API always lives at `/api`.
 */
export function normalizeApiUrl(input: string): string {
  let s = input.trim().replace(/\s+/g, '');
  if (!s) return '';
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'http://' + s.replace(/^\/+/, '');
  const m = /^(https?):\/\/([^/?#]+)/i.exec(s);
  if (!m) return '';
  const host = m[2].replace(/,/g, '.').toLowerCase();
  if (!/^([a-z0-9-]+(\.[a-z0-9-]+)*|\[[0-9a-f:.]+\])(:\d{1,5})?$/.test(host)) return '';
  return `${m[1].toLowerCase()}://${host}`;
}

// The exported web app is served by the API itself, so it stays same-origin even if the env var leaks into the build.
export const DEFAULT_API_URL = SERVER_CONFIGURABLE
  ? normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL ?? '') || FALLBACK_NATIVE_URL
  : __DEV__
    ? (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '')
    : '';

let apiUrl = DEFAULT_API_URL;
let urlLoaded: Promise<void> | null = null;

export function getApiUrl() {
  return apiUrl;
}

/** Restores the saved server override; every request waits for this before going out. */
export function loadApiUrl(): Promise<void> {
  if (!SERVER_CONFIGURABLE) return Promise.resolve();
  urlLoaded ??= AsyncStorage.getItem(K_API_URL)
    .then((v) => {
      const u = v ? normalizeApiUrl(v) : '';
      if (u) apiUrl = u;
    })
    .catch(() => {});
  return urlLoaded;
}

/** Persists a new server address; returns the normalized value ('' = invalid, nothing saved). */
export async function saveApiUrl(input: string): Promise<string> {
  const u = normalizeApiUrl(input);
  if (!u || !SERVER_CONFIGURABLE) return '';
  apiUrl = u;
  if (u === DEFAULT_API_URL) await AsyncStorage.removeItem(K_API_URL);
  else await AsyncStorage.setItem(K_API_URL, u);
  return u;
}

export type HealthResult = { ok: true } | { ok: false; reason: 'invalid' | 'timeout' | 'unreachable' | 'not_taptym' | 'http'; status?: number };

/** GET `<url>/api/health` with a timeout, so a wrong IP fails fast instead of hanging. */
export async function checkServer(input: string, timeoutMs = 6000): Promise<HealthResult> {
  const u = normalizeApiUrl(input);
  if (!u) return { ok: false, reason: 'invalid' };
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, timeoutMs);
  try {
    const res = await fetch(`${u}/api/health`, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) return { ok: false, reason: 'http', status: res.status };
    const data = await res.json().catch(() => null);
    return data && data.ok === true ? { ok: true } : { ok: false, reason: 'not_taptym' };
  } catch {
    return { ok: false, reason: timedOut ? 'timeout' : 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(t: string | null) {
  authToken = t;
}
export function getAuthToken() {
  return authToken;
}
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export function mediaUrl(u?: string | null): string | null {
  if (!u) return null;
  if (u.startsWith('/uploads/')) return apiUrl + u;
  return u;
}

/** Absolute URL for a file download that authenticates through `?token=`. */
export function downloadUrl(path: string, params: Record<string, string> = {}) {
  const q = new URLSearchParams({ ...params, token: authToken ?? '' }).toString();
  return `${apiUrl}${path}?${q}`;
}

type Opts = { method?: string; body?: unknown; form?: FormData; timeoutMs?: number };

export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (authToken) headers.authorization = `Bearer ${authToken}`;
  let body: any;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  // React Native's fetch never times out on its own: an unreachable LAN IP would spin forever.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? (opts.form ? 120000 : 8000));
  let res: Response;
  let text: string;
  try {
    await loadApiUrl();
    res = await fetch(apiUrl + path, { method: opts.method ?? (body ? 'POST' : 'GET'), headers, body, signal: ctrl.signal });
    text = await res.text();
  } catch {
    throw new ApiError('network', 0);
  } finally {
    clearTimeout(timer);
  }
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    if (res.status === 401 && authToken) onUnauthorized?.();
    throw new ApiError((data && data.error) || `http_${res.status}`, res.status);
  }
  return data as T;
}

export type PickedFile = { uri: string; name: string; mimeType?: string | null; file?: File | null };

export async function uploadFile(path: string, f: PickedFile): Promise<any> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = f.file ?? (await (await fetch(f.uri)).blob());
    form.append('file', blob as Blob, f.name);
  } else {
    form.append('file', { uri: f.uri, name: f.name, type: f.mimeType ?? 'application/octet-stream' } as any);
  }
  return api(path, { method: 'POST', form });
}
