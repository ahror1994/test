import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';

export const SERVER_KEY = 'taptym.apiUrl';

/** Only the native app can be pointed at another computer; the web build is served by the API itself. */
export const SERVER_EDITABLE = Platform.OS !== 'web';

// The owner's computer on the home LAN acts as the server; used when the APK was built without EXPO_PUBLIC_API_URL.
const NATIVE_FALLBACK = 'http://192.168.0.4:3000';

/** Accepts `host`, `host:port`, `http(s)://host[:port][/path]`; returns `http://host:port` without a trailing slash. */
export function normalizeServerUrl(input: string): string | null {
  let v = input.trim().replace(/\s+/g, '');
  if (!v) return null;
  // Repair typos such as `http//host` or `http:/host`.
  v = v.replace(/^(https?)(?::\/\/|[:;/]+)/i, '$1://');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = `http://${v}`;
  v = v.replace(/\/+$/, '').replace(/\/api$/i, '');
  const m = /^(https?):\/\/([a-z0-9.-]+|\[[0-9a-f:.]+\])(:(\d{1,5}))?(\/[^?#]*)?$/i.exec(v);
  if (!m || /^[.-]|[.-]$|\.\./.test(m[2]) || m[5]?.includes('//')) return null;
  if (m[4] && (Number(m[4]) < 1 || Number(m[4]) > 65535)) return null;
  return `${m[1].toLowerCase()}://${m[2].toLowerCase()}${m[3] ?? ''}${(m[5] ?? '').replace(/\/+$/, '')}`;
}

function envUrl(): string {
  const env = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
  if (!SERVER_EDITABLE) return __DEV__ ? env.replace(/\/+$/, '') : '';
  return (env && normalizeServerUrl(env)) || NATIVE_FALLBACK;
}

export const DEFAULT_SERVER_URL = envUrl();

type ServerState = { url: string; ready: boolean; sheet: boolean; opened: number };

export const useServer = create<ServerState>()(() => ({ url: DEFAULT_SERVER_URL, ready: !SERVER_EDITABLE, sheet: false, opened: 0 }));

const loaded: Promise<void> = SERVER_EDITABLE
  ? AsyncStorage.getItem(SERVER_KEY)
      .then((v) => useServer.setState({ url: (v && normalizeServerUrl(v)) || DEFAULT_SERVER_URL, ready: true }))
      .catch(() => useServer.setState({ ready: true }))
  : Promise.resolve();

/** Resolves once the saved override (if any) has been read; `api()` waits for it before the first request. */
export const serverReady = () => loaded;
export const serverUrl = () => useServer.getState().url;

export async function saveServerUrl(url: string) {
  useServer.setState({ url });
  // Saving the build default drops the override, so a rebuilt APK with a new default takes effect.
  if (url === DEFAULT_SERVER_URL) await AsyncStorage.removeItem(SERVER_KEY).catch(() => {});
  else await AsyncStorage.setItem(SERVER_KEY, url).catch(() => {});
}

// `opened` remounts the sheet so every opening starts from the saved address.
export const openServerSheet = () => useServer.setState((s) => ({ sheet: true, opened: s.opened + 1 }));
export const closeServerSheet = () => useServer.setState({ sheet: false });

export type ServerCheck = { ok: true } | { ok: false; reason: 'bad_url' | 'timeout' | 'network' | 'status' | 'foreign'; status?: number };

export const CHECK_TIMEOUT_S = 6;

/** GET `{url}/api/health`, which answers `{ ok: true }` on a Taptym server. */
export async function checkServer(url: string): Promise<ServerCheck> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CHECK_TIMEOUT_S * 1000);
  try {
    const res = await fetch(`${url}/api/health`, { headers: { accept: 'application/json' }, signal: ctrl.signal });
    if (!res.ok) return { ok: false, reason: 'status', status: res.status };
    const data = await res.json().catch(() => null);
    return data && data.ok === true ? { ok: true } : { ok: false, reason: 'foreign' };
  } catch {
    return { ok: false, reason: ctrl.signal.aborted ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}
