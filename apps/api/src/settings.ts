import type { PlatformSettings } from '@taptym/shared';
import { get, run, json } from './db.ts';

export const DEFAULT_SETTINGS: PlatformSettings = {
  commissionPercent: 7,
  trialDays: 30,
  freeFirstCourierDelivery: true,
  freeBannerFirstMonth: true,
  catalogUploadHourlyRate: 300,
  courierEnabled: true,
  courierMoped: { base: 120, perKm: 20, includedKm: 2 },
  courierCar: { base: 250, perKm: 35, includedKm: 2 },
  carFromSubtotal: 8000,
  freeDeliveryFrom: 3000,
  yandexEnabled: true,
  yandexEstimate: { base: 150, perKm: 25 },
  sameDayCutoffHour: 17,
  coinsPer100: 1,
  coinValue: 1,
  coinsMaxPercent: 30,
  referralBonusCoins: 100,
  referralFriendCoins: 100,
  cashDebtLimit: 5000,
  supportPhone: '+996 700 000 000',
  supportTelegram: '@taptym_support',
  seasonalTheme: 'back_to_school',
};

export function getSettings(): PlatformSettings {
  const row = get<{ value: string }>('SELECT value FROM settings WHERE key = ?', 'platform');
  return { ...DEFAULT_SETTINGS, ...json<Partial<PlatformSettings>>(row?.value, {}) };
}

export function saveSettings(patch: Partial<PlatformSettings>): PlatformSettings {
  const next = { ...getSettings(), ...patch };
  run(
    'INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    'platform',
    JSON.stringify(next),
  );
  return next;
}

/**
 * Integration credentials. Each value can also come from an env var (shown in `env`),
 * which wins over the value saved in the admin panel.
 */
export interface IntegrationField {
  key: string;
  label: string;
  env: string;
  secret?: boolean;
}
export interface IntegrationDef {
  id: string;
  title: string;
  description: string;
  fields: IntegrationField[];
}

export const INTEGRATIONS: IntegrationDef[] = [
  {
    id: 'mbank',
    title: 'MBank — QR-оплата и выплаты',
    description: 'Приём оплаты по QR и переводы поставщикам через бизнес-API MBank.',
    fields: [
      { key: 'baseUrl', label: 'API URL', env: 'MBANK_BASE_URL' },
      { key: 'merchantId', label: 'Merchant ID', env: 'MBANK_MERCHANT_ID' },
      { key: 'apiKey', label: 'API ключ', env: 'MBANK_API_KEY', secret: true },
      { key: 'webhookSecret', label: 'Секрет вебхука', env: 'MBANK_WEBHOOK_SECRET', secret: true },
    ],
  },
  {
    id: 'bakai',
    title: 'Бакай Банк — QR-оплата',
    description: 'Второй банк для QR-оплаты (по желанию).',
    fields: [
      { key: 'baseUrl', label: 'API URL', env: 'BAKAI_BASE_URL' },
      { key: 'merchantId', label: 'Merchant ID', env: 'BAKAI_MERCHANT_ID' },
      { key: 'apiKey', label: 'API ключ', env: 'BAKAI_API_KEY', secret: true },
    ],
  },
  {
    id: 'yandexDelivery',
    title: 'Яндекс Доставка',
    description: 'Расчёт стоимости и вызов курьера Яндекса (API «Доставка в тот же день»).',
    fields: [
      { key: 'baseUrl', label: 'API URL', env: 'YANDEX_DELIVERY_BASE_URL' },
      { key: 'token', label: 'OAuth токен', env: 'YANDEX_DELIVERY_TOKEN', secret: true },
    ],
  },
  {
    id: 'sms',
    title: 'SMS-коды входа',
    description: 'SMS-шлюз (например, Nikita.kg) для кодов подтверждения.',
    fields: [
      { key: 'baseUrl', label: 'API URL', env: 'SMS_BASE_URL' },
      { key: 'login', label: 'Логин', env: 'SMS_LOGIN' },
      { key: 'password', label: 'Пароль', env: 'SMS_PASSWORD', secret: true },
      { key: 'sender', label: 'Имя отправителя', env: 'SMS_SENDER' },
    ],
  },
  {
    id: 'telegram',
    title: 'Telegram-уведомления',
    description: 'Бот присылает вам и поставщикам новые заказы, запросы выплат и сообщения.',
    fields: [
      { key: 'botToken', label: 'Токен бота', env: 'TELEGRAM_BOT_TOKEN', secret: true },
      { key: 'adminChatId', label: 'Chat ID админов', env: 'TELEGRAM_ADMIN_CHAT_ID' },
    ],
  },
  {
    id: 'whatsapp',
    title: 'WhatsApp Business',
    description: 'Уведомления клиентам через WhatsApp Cloud API.',
    fields: [
      { key: 'token', label: 'Access token', env: 'WHATSAPP_TOKEN', secret: true },
      { key: 'phoneNumberId', label: 'Phone number ID', env: 'WHATSAPP_PHONE_NUMBER_ID' },
    ],
  },
  {
    id: 'expoPush',
    title: 'Push-уведомления',
    description: 'Push на Android/iOS через Expo Push Service.',
    fields: [{ key: 'accessToken', label: 'Expo access token', env: 'EXPO_ACCESS_TOKEN', secret: true }],
  },
  {
    id: 'fiscal',
    title: 'Фискализация (ККМ онлайн)',
    description: 'Фискальные чеки через оператора ККМ по требованиям ГНС КР.',
    fields: [
      { key: 'baseUrl', label: 'API URL', env: 'FISCAL_BASE_URL' },
      { key: 'token', label: 'Токен', env: 'FISCAL_TOKEN', secret: true },
    ],
  },
];

type Stored = Record<string, Record<string, string>>;

function stored(): Stored {
  const row = get<{ value: string }>('SELECT value FROM settings WHERE key = ?', 'integrations');
  return json<Stored>(row?.value, {});
}

export function integrationConfig(id: string): Record<string, string> {
  const def = INTEGRATIONS.find((d) => d.id === id);
  const saved = stored()[id] ?? {};
  const out: Record<string, string> = {};
  for (const f of def?.fields ?? []) {
    const v = process.env[f.env] || saved[f.key] || '';
    if (v) out[f.key] = v;
  }
  return out;
}

/** Configured = every secret field has a value. */
export function isConfigured(id: string): boolean {
  const def = INTEGRATIONS.find((d) => d.id === id);
  if (!def) return false;
  const cfg = integrationConfig(id);
  const required = def.fields.filter((f) => f.secret);
  return required.length > 0 && required.every((f) => !!cfg[f.key]);
}

export function integrationsForAdmin() {
  const saved = stored();
  return INTEGRATIONS.map((def) => ({
    ...def,
    configured: isConfigured(def.id),
    values: Object.fromEntries(
      def.fields.map((f) => {
        const fromEnv = !!process.env[f.env];
        const v = process.env[f.env] || saved[def.id]?.[f.key] || '';
        const shown = f.secret && v ? '••••' + v.slice(-4) : v;
        return [f.key, { value: shown, fromEnv, set: !!v }];
      }),
    ),
  }));
}

export function saveIntegration(id: string, values: Record<string, string>) {
  const all = stored();
  const cur = all[id] ?? {};
  for (const [k, v] of Object.entries(values)) {
    if (v.startsWith('••••')) continue; // masked value sent back unchanged
    if (v === '') delete cur[k];
    else cur[k] = v;
  }
  all[id] = cur;
  run(
    'INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    'integrations',
    JSON.stringify(all),
  );
}
