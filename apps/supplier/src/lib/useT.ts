import { Platform } from 'react-native';
import { createTranslator, pluralRu, type Lang } from '@taptym/shared';
import { dict, type TKey } from '../i18n';
import { useStore } from './store';
import { ApiError } from './api';

const base = createTranslator(dict);

/** Russian plurals inline: "{n} {n|товар|товара|товаров}". */
function translate(lang: Lang, key: TKey, vars?: Record<string, string | number>) {
  const s = base(lang, key, vars);
  if (!vars || !s.includes('|')) return s;
  return s.replace(/\{(\w+)\|([^|}]*)\|([^|}]*)\|([^}]*)\}/g, (_, k: string, one: string, few: string, many: string) => pluralRu(Number(vars[k]) || 0, one, few, many));
}

export type T = (key: TKey, vars?: Record<string, string | number>) => string;

export function useT(): T {
  const lang = useStore((s) => s.lang);
  return (key, vars) => translate(lang, key, vars);
}

export function tr(lang: Lang, key: TKey, vars?: Record<string, string | number>) {
  return translate(lang, key, vars);
}

const ERRORS: Record<string, TKey> = {
  network: 'err_network',
  bad_phone: 'err_bad_phone',
  bad_code: 'err_bad_code',
  name_address_required: 'err_name_address',
  supplier_banned: 'err_banned',
  forbidden: 'err_forbidden',
  unauthorized: 'err_unauthorized',
  price_required: 'err_price_required',
  title_required: 'err_title_required',
  offer_exists: 'err_offer_exists',
  file_required: 'err_file_required',
  file_too_large: 'err_file_too_large',
  file_type_not_allowed: 'err_file_type',
  bad_amount: 'err_bad_amount',
  insufficient_balance: 'err_insufficient',
  unknown_service: 'err_generic',
  code_exists: 'err_code_exists',
  bad_type: 'err_generic',
  bad_role: 'err_generic',
  staff_exists: 'err_staff_exists',
  cannot_edit_owner: 'err_cannot_edit_owner',
  moysklad_not_connected: 'err_moysklad',
  text_required: 'err_text_required',
  order_not_found: 'err_not_found',
  product_not_found: 'err_not_found',
  thread_not_found: 'err_not_found',
};

export function errorText(t: T, e: unknown): string {
  const code = e instanceof ApiError ? e.code : 'network';
  if (code === 'network' && Platform.OS === 'web') return t('err_network_web');
  if (code.startsWith('bad_transition')) return t('err_transition');
  return t(ERRORS[code] ?? 'err_generic');
}
