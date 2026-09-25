import type { Category } from './types';

export const CATEGORIES: Category[] = [
  {
    id: 'pens',
    icon: 'pencil',
    emoji: '🖊️',
    color: '#E8E3FF',
    sort: 1,
    name: { ru: 'Ручки и карандаши', ky: 'Калем жана карандаш', uz: 'Ruchka va qalamlar', kk: 'Қаламсап пен қарындаш' },
  },
  {
    id: 'notebooks',
    icon: 'book',
    emoji: '📓',
    color: '#DDF4E8',
    sort: 2,
    name: { ru: 'Тетради и блокноты', ky: 'Дептерлер', uz: 'Daftarlar', kk: 'Дәптерлер' },
  },
  {
    id: 'paper',
    icon: 'document',
    emoji: '📄',
    color: '#E3F0FF',
    sort: 3,
    name: { ru: 'Бумага', ky: 'Кагаз', uz: "Qog'oz", kk: 'Қағаз' },
  },
  {
    id: 'school',
    icon: 'school',
    emoji: '🎒',
    color: '#FFE9D6',
    sort: 4,
    name: { ru: 'Школа', ky: 'Мектеп', uz: 'Maktab', kk: 'Мектеп' },
  },
  {
    id: 'art',
    icon: 'color-palette',
    emoji: '🎨',
    color: '#FFE3EC',
    sort: 5,
    name: { ru: 'Творчество', ky: 'Чыгармачылык', uz: 'Ijodkorlik', kk: 'Шығармашылық' },
  },
  {
    id: 'office',
    icon: 'briefcase',
    emoji: '📎',
    color: '#EDEFF5',
    sort: 6,
    name: { ru: 'Для офиса', ky: 'Кеңсе үчүн', uz: 'Ofis uchun', kk: 'Кеңсеге' },
  },
  {
    id: 'folders',
    icon: 'folder-open',
    emoji: '🗂️',
    color: '#FFF4CC',
    sort: 7,
    name: { ru: 'Папки и хранение', ky: 'Папкалар', uz: 'Papkalar', kk: 'Папкалар' },
  },
  {
    id: 'tech',
    icon: 'calculator',
    emoji: '🧮',
    color: '#D9F6F6',
    sort: 8,
    name: { ru: 'Калькуляторы', ky: 'Калькуляторлор', uz: 'Kalkulyatorlar', kk: 'Калькуляторлар' },
  },
];

export function categoryName(id: string, lang: keyof Category['name'] = 'ru'): string {
  const c = CATEGORIES.find((x) => x.id === id);
  if (!c) return id;
  return c.name[lang] ?? c.name.ru;
}
