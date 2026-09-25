import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import type { CartLine, CustomerProfile, Lang } from '@taptym/shared';
import { errorText, tNow } from '@/i18n';
import { api } from './api';
import { haptic } from './haptics';
import { toast, useApp } from './store';

export async function refreshMe() {
  if (!useApp.getState().token) return;
  try {
    const me = await api<CustomerProfile & { unread: number }>('/me');
    const { unread, ...profile } = me;
    useApp.getState().setProfile(profile);
    useApp.getState().setUnread(unread ?? 0);
  } catch {
    // offline or logged out — keep cached profile
  }
}

export function setLanguage(lang: Lang) {
  useApp.getState().setLang(lang);
  if (useApp.getState().token) {
    api<CustomerProfile>('/me', { method: 'PATCH', body: { lang } })
      .then((p) => useApp.getState().setProfile(p))
      .catch(() => {});
  }
}

/** Sends guests to login and brings them back to `next` afterwards. */
export function requireAuth(next: string): boolean {
  if (useApp.getState().token) return true;
  toast(tNow('login_required'));
  router.push({ pathname: '/login', params: { next } });
  return false;
}

export function addLines(lines: CartLine[], message?: string) {
  useApp.getState().mergeCart(lines);
  haptic.success();
  if (message) toast(message, 'success');
}

export async function addSchoolList(id: string) {
  try {
    const r = await api<{ lines: CartLine[]; missing: string[] }>(`/school-lists/${id}/cart`, { method: 'POST' });
    const n = r.lines.reduce((a, l) => a + l.qty, 0);
    addLines(r.lines, tNow('set_added', { n }));
    return r;
  } catch (e) {
    toast(errorText(e), 'error');
    return null;
  }
}

/** Banner links: `school`, `promo:CODE`, `supplier:ID`, `coins`, `category:ID`, or a URL/path. */
export async function openBannerLink(link: string) {
  haptic.tap();
  const [kind, arg] = link.split(':');
  if (kind === 'school') return router.push('/school');
  if (kind === 'coins') return router.push('/coins');
  if (kind === 'supplier' && arg) return router.push(`/store/${arg}`);
  if (kind === 'category' && arg) return router.push(`/category/${arg}`);
  if (kind === 'product' && arg) return router.push(`/product/${arg}`);
  if (kind === 'promo' && arg) {
    useApp.getState().setPromo(arg);
    await Clipboard.setStringAsync(arg).catch(() => {});
    toast(tNow('promo_saved', { code: arg }), 'success');
    return;
  }
  if (link.startsWith('/')) router.push(link as never);
}
