import { Platform } from 'react-native';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

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
  if (u.startsWith('/uploads/')) return API_URL + u;
  return u;
}

/** Absolute URL for a file download that authenticates through `?token=`. */
export function downloadUrl(path: string, params: Record<string, string> = {}) {
  const q = new URLSearchParams({ ...params, token: authToken ?? '' }).toString();
  return `${API_URL}${path}?${q}`;
}

type Opts = { method?: string; body?: unknown; form?: FormData };

export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (authToken) headers.authorization = `Bearer ${authToken}`;
  let body: any;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(API_URL + path, { method: opts.method ?? (body ? 'POST' : 'GET'), headers, body });
  } catch {
    throw new ApiError('network', 0);
  }
  let data: any = null;
  const text = await res.text();
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
