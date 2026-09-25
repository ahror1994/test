import { BRAND } from './brand';

let currencyLabel: string = BRAND.currency;

/** Uzbek (Latin) spells the currency «so'm»; the other interface languages use «сом». */
export function setPriceLocale(lang: string) {
  currencyLabel = lang === 'uz' ? "so'm" : BRAND.currency;
}

export function formatPrice(value: number, withCurrency = true): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '−' : '';
  const s = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  return withCurrency ? `${sign}${s}\u00a0${currencyLabel}` : `${sign}${s}`;
}

export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('996')) {
    return `+996 ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}`;
  }
  return phone;
}

export function normalizePhone(input: string): string {
  let d = input.replace(/\D/g, '');
  if (d.startsWith('0') && d.length === 10) d = '996' + d.slice(1);
  if (d.length === 9) d = '996' + d;
  return '+' + d;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}
