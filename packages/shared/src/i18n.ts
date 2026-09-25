import type { Lang } from './types';

export const LANGS: { code: Lang; label: string; native: string; flag: string }[] = [
  { code: 'ru', label: 'Русский', native: 'Русский', flag: '🇷🇺' },
  { code: 'ky', label: 'Кыргызский', native: 'Кыргызча', flag: '🇰🇬' },
  { code: 'uz', label: 'Узбекский', native: "O'zbekcha", flag: '🇺🇿' },
  { code: 'kk', label: 'Казахский', native: 'Қазақша', flag: '🇰🇿' },
];

export const DEFAULT_LANG: Lang = 'ru';

export type Dict = Record<string, Partial<Record<Lang, string>> & { ru: string }>;

/** Missing translations fall back to Russian, then to the key itself. */
export function createTranslator<D extends Dict>(dict: D) {
  return function t(lang: Lang, key: keyof D & string, vars?: Record<string, string | number>): string {
    const entry = dict[key];
    let s = entry ? (entry[lang] ?? entry.ru) : key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    }
    return s;
  };
}

export function pluralRu(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
