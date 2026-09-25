import type { AdminPermission } from '@taptym/shared';

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export const SUB_STATUS: Record<string, { label: string; tone: Tone; action?: string }> = {
  new: { label: 'Новый', tone: 'primary' },
  confirmed: { label: 'Подтверждён', tone: 'info', action: 'Подтвердить' },
  assembling: { label: 'Собирается', tone: 'info', action: 'Собирается' },
  ready: { label: 'Готов', tone: 'warning', action: 'Готов к отправке' },
  in_delivery: { label: 'В пути', tone: 'warning', action: 'Передан в доставку' },
  delivered: { label: 'Доставлен', tone: 'success', action: 'Доставлен' },
  cancelled: { label: 'Отменён', tone: 'danger', action: 'Отменить' },
  rejected: { label: 'Отклонён', tone: 'danger', action: 'Отклонить' },
};

export const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  placed: { label: 'Оформлен', tone: 'primary' },
  in_progress: { label: 'В работе', tone: 'warning' },
  completed: { label: 'Выполнен', tone: 'success' },
  cancelled: { label: 'Отменён', tone: 'danger' },
};

export const PAYMENT_METHOD: Record<string, string> = {
  qr: 'QR-оплата',
  card: 'Карта',
  cash: 'Наличные',
  invoice: 'Счёт (безнал)',
  coins_only: 'Монетами',
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'Ждёт оплаты', tone: 'warning' },
  paid: { label: 'Оплачен', tone: 'success' },
  cash_on_delivery: { label: 'При получении', tone: 'info' },
  awaiting_invoice: { label: 'Ждём по счёту', tone: 'warning' },
  refunded: { label: 'Возврат', tone: 'neutral' },
  failed: { label: 'Ошибка оплаты', tone: 'danger' },
};

export const DELIVERY_METHOD: Record<string, string> = {
  supplier: 'Доставка магазина',
  courier: 'Курьер Taptym',
  yandex: 'Яндекс Доставка',
  pickup: 'Самовывоз',
};

export const PAYOUT_METHOD: Record<string, string> = {
  mbank: 'MBank',
  bank_account: 'Расчётный счёт',
  cash: 'Наличными',
};

export const PAYOUT_STATUS: Record<string, { label: string; tone: Tone }> = {
  requested: { label: 'Новый запрос', tone: 'warning' },
  confirmed: { label: 'Подтверждён', tone: 'info' },
  paid: { label: 'Выплачено', tone: 'success' },
  rejected: { label: 'Отклонён', tone: 'danger' },
};

export const PROMO_TYPE: Record<string, string> = {
  percent: 'Скидка %',
  fixed: 'Скидка в сомах',
  free_delivery: 'Бесплатная доставка',
};

export const PROMO_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: 'Активен', tone: 'success' },
  pending: { label: 'На одобрении', tone: 'warning' },
  rejected: { label: 'Отклонён', tone: 'danger' },
  disabled: { label: 'Выключен', tone: 'neutral' },
};

export const FUNDED_BY: Record<string, string> = {
  platform: 'За счёт площадки',
  supplier: 'За счёт магазина',
  shared: 'Пополам',
};

export const PLACEMENT: Record<string, { label: string; hint: string }> = {
  home_top: { label: 'Главная — верхняя карусель', hint: 'Самое заметное место, первый экран' },
  home_middle: { label: 'Главная — середина', hint: 'Между подборками товаров' },
  search: { label: 'Поиск', hint: 'Над результатами поиска' },
  category: { label: 'Категории', hint: 'Вверху страницы категории' },
};

export const SERVICE_TYPE: Record<string, string> = {
  banner: 'Баннер',
  top_search: 'Топ в поиске',
  featured: 'Рекомендуемый',
  catalog_upload: 'Загрузка каталога',
  courier_plan: 'Тариф курьера',
};

export const SERVICE_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: 'Активна', tone: 'success' },
  pending: { label: 'Ждёт одобрения', tone: 'warning' },
  finished: { label: 'Завершена', tone: 'neutral' },
  cancelled: { label: 'Отменена', tone: 'danger' },
};

export const LEDGER_TYPE: Record<string, string> = {
  sale: 'Продажа',
  commission: 'Комиссия',
  promotion: 'Продвижение',
  service: 'Услуга',
  payout: 'Выплата',
  cash_collected: 'Наличные у магазина',
  promo_discount: 'Скидка магазина',
  refund: 'Возврат',
  adjustment: 'Корректировка',
};

export const SUPPLIER_ROLE: Record<string, string> = {
  owner: 'Владелец',
  manager: 'Менеджер',
  cashier: 'Кассир',
  warehouse: 'Склад',
};

export const ADMIN_ROLE: Record<string, string> = {
  owner: 'Владелец',
  operator: 'Оператор',
  accountant: 'Бухгалтер',
  moderator: 'Модератор',
  custom: 'Свои права',
};

export const PERMISSION_LABEL: Record<AdminPermission, { label: string; hint: string }> = {
  dashboard: { label: 'Дашборд', hint: 'Сводка и графики' },
  orders: { label: 'Заказы', hint: 'Статусы, курьер, отметка оплаты' },
  suppliers: { label: 'Поставщики', hint: 'Блокировки, пробный период, услуги' },
  customers: { label: 'Покупатели', hint: 'Бан, начисление монет' },
  products: { label: 'Товары и отзывы', hint: 'Модерация каталога' },
  payouts: { label: 'Выплаты', hint: 'Подтверждение и отправка денег' },
  promos: { label: 'Промокоды', hint: 'Создание, одобрение заявок' },
  banners: { label: 'Баннеры и реклама', hint: 'Позиции, платная реклама' },
  support: { label: 'Поддержка', hint: 'Чаты с клиентами и магазинами' },
  reports: { label: 'Отчёты', hint: 'Финансы, выгрузка CSV' },
  settings: { label: 'Настройки и интеграции', hint: 'Комиссия, доставка, API-ключи' },
  staff: { label: 'Сотрудники', hint: 'Доступы и права' },
};

export const ROLE_PRESETS: Record<string, AdminPermission[]> = {
  operator: ['dashboard', 'orders', 'customers', 'support', 'suppliers'],
  accountant: ['dashboard', 'payouts', 'reports'],
  moderator: ['dashboard', 'products', 'banners', 'promos', 'support'],
  custom: ['dashboard'],
};

export const SEASON: Record<string, string> = {
  back_to_school: '🎒 Снова в школу',
  new_year: '🎄 Новый год',
  none: 'Без сезонной темы',
};
