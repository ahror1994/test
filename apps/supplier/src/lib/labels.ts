import type { DeliveryMethod, PaymentMethod, SubOrderStatus } from '@taptym/shared';
import type { IconName } from '@/components/ui';
import type { TKey } from '../i18n';
import type { T } from './useT';
import { minutesSince } from './time';

export const statusKey = (s: SubOrderStatus) => `st_${s}` as TKey;
export const statusTone = (s: SubOrderStatus) =>
  (({ new: 'danger', confirmed: 'primary', assembling: 'warning', ready: 'info', in_delivery: 'info', delivered: 'success', cancelled: 'neutral', rejected: 'neutral' }) as const)[s];

export const deliveryIcon: Record<DeliveryMethod, IconName> = { supplier: 'car-outline', courier: 'bicycle-outline', yandex: 'car-sport-outline', pickup: 'walk-outline' };
export const deliveryKey = (m: DeliveryMethod) => `dm_${m}` as TKey;

export const paymentIcon: Record<PaymentMethod, IconName> = { qr: 'qr-code-outline', card: 'card-outline', cash: 'cash-outline', invoice: 'document-text-outline', coins_only: 'medal-outline' };
export const paymentKey = (m: PaymentMethod) => `pm_${m}` as TKey;

export function timeAgo(t: T, iso: string) {
  const m = minutesSince(iso);
  if (m < 1) return t('just_now');
  if (m < 60) return t('min_ago', { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('h_ago', { n: h });
  return t('d_ago', { n: Math.floor(h / 24) });
}

/** Label for the one big "next step" button of an order. */
export function nextActionKey(to: SubOrderStatus, method: DeliveryMethod): TKey {
  if (to === 'confirmed') return 'act_confirm';
  if (to === 'assembling') return 'act_assemble';
  if (to === 'ready') return 'act_ready';
  if (to === 'in_delivery') return method === 'supplier' ? 'act_go_deliver' : 'act_handover';
  if (to === 'delivered') return method === 'pickup' ? 'act_issued' : 'act_delivered';
  return 'act_confirm';
}

export const nextActionIcon = (to: SubOrderStatus): IconName =>
  (({ confirmed: 'checkmark-circle', assembling: 'cube', ready: 'bag-check', in_delivery: 'bicycle', delivered: 'checkmark-done-circle' }) as Partial<Record<SubOrderStatus, IconName>>)[to] ?? 'arrow-forward-circle';

export function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
