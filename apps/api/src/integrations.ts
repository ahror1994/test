/**
 * External providers. Every adapter has a demo fallback so the whole product works
 * without keys; once credentials are saved in Admin → Integrations (or env vars),
 * the live branch is used. Live request shapes must be checked against each
 * provider's contract documentation when it is issued together with the keys.
 */
import QRCode from 'qrcode';
import { randomBytes } from 'node:crypto';
import { integrationConfig, isConfigured } from './settings.ts';
import { run, nowIso } from './db.ts';

export const PUBLIC_URL = (process.env.PUBLIC_URL ?? '').replace(/\/$/, '');

function log(integration: string, action: string, demo: boolean, payload: unknown) {
  run(
    'INSERT INTO integration_log(integration, action, demo, payload, created_at) VALUES(?,?,?,?,?)',
    integration,
    action,
    demo ? 1 : 0,
    JSON.stringify(payload).slice(0, 4000),
    nowIso(),
  );
}

async function postJson(url: string, body: unknown, headers: Record<string, string>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${url} → ${res.status}: ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// ---------- Payments (QR / card) ----------

export interface CreatedPayment {
  id: string;
  provider: string;
  demo: boolean;
  externalId: string | null;
  qrPayload: string;
}

export async function createPayment(
  orderId: number,
  orderNumber: string,
  amount: number,
  baseUrl: string,
): Promise<CreatedPayment> {
  const id = 'pay_' + randomBytes(8).toString('hex');
  const provider = isConfigured('mbank') ? 'mbank' : isConfigured('bakai') ? 'bakai' : 'demo';
  if (provider !== 'demo') {
    const cfg = integrationConfig(provider);
    const body = {
      merchantId: cfg.merchantId,
      amount,
      currency: 'KGS',
      orderId: orderNumber,
      description: `Заказ ${orderNumber}`,
      callbackUrl: `${PUBLIC_URL || baseUrl}/api/webhooks/${provider}`,
    };
    const res = await postJson(`${cfg.baseUrl}/payments/qr`, body, { Authorization: `Bearer ${cfg.apiKey}` });
    log(provider, 'create_qr', false, { request: body, response: res });
    return {
      id,
      provider,
      demo: false,
      externalId: String(res.paymentId ?? res.id ?? ''),
      qrPayload: String(res.qrPayload ?? res.qr ?? res.paymentUrl ?? ''),
    };
  }
  // Demo: the QR opens our own "bank" page where the payer presses «Оплатить».
  const qrPayload = `${PUBLIC_URL || baseUrl}/api/pay/${id}`;
  log('payments', 'create_qr', true, { orderId, amount });
  return { id, provider: 'demo', demo: true, externalId: null, qrPayload };
}

export async function qrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, { margin: 1, width: 360, color: { dark: '#0F1222', light: '#FFFFFF' } });
}

export function bankDeepLinks(payload: string) {
  const enc = encodeURIComponent(payload);
  return [
    { bank: 'MBank', url: `https://app.mbank.kg/qr?data=${enc}` },
    { bank: 'Бакай Банк', url: `https://bakai24.app/qr?data=${enc}` },
    { bank: 'О!Деньги', url: `https://odengi.kg/qr?data=${enc}` },
  ];
}

export async function sendPayout(supplierName: string, details: string, amount: number) {
  if (isConfigured('mbank')) {
    const cfg = integrationConfig('mbank');
    const res = await postJson(
      `${cfg.baseUrl}/transfers`,
      { merchantId: cfg.merchantId, amount, currency: 'KGS', recipient: details, comment: `Выплата ${supplierName}` },
      { Authorization: `Bearer ${cfg.apiKey}` },
    );
    log('mbank', 'payout', false, res);
    return { demo: false, reference: String(res.id ?? '') };
  }
  log('payouts', 'payout', true, { supplierName, details, amount });
  return { demo: true, reference: 'DEMO-' + randomBytes(3).toString('hex').toUpperCase() };
}

// ---------- Yandex Delivery ----------

export async function yandexQuote(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  if (!isConfigured('yandexDelivery')) return null;
  const cfg = integrationConfig('yandexDelivery');
  try {
    const res = await postJson(
      `${cfg.baseUrl || 'https://b2b.taxi.yandex.net'}/b2b/cargo/integration/v2/check-price`,
      { route_points: [{ coordinates: [from.lng, from.lat] }, { coordinates: [to.lng, to.lat] }], requirements: { taxi_class: 'courier' } },
      { Authorization: `Bearer ${cfg.token}`, 'Accept-Language': 'ru' },
    );
    log('yandexDelivery', 'check_price', false, res);
    return Math.round(Number(res.price));
  } catch (e) {
    log('yandexDelivery', 'check_price_error', false, String(e));
    return null;
  }
}

export async function yandexCreateClaim(subOrderId: number, info: unknown) {
  if (!isConfigured('yandexDelivery')) {
    log('yandexDelivery', 'create_claim', true, { subOrderId, info });
    return { demo: true, claimId: 'DEMO-YA-' + subOrderId };
  }
  const cfg = integrationConfig('yandexDelivery');
  const res = await postJson(
    `${cfg.baseUrl || 'https://b2b.taxi.yandex.net'}/b2b/cargo/integration/v2/claims/create?request_id=taptym-${subOrderId}`,
    info,
    { Authorization: `Bearer ${cfg.token}` },
  );
  log('yandexDelivery', 'create_claim', false, res);
  return { demo: false, claimId: String(res.id ?? '') };
}

// ---------- SMS ----------

export async function sendSms(phone: string, text: string): Promise<{ demo: boolean }> {
  if (!isConfigured('sms')) {
    log('sms', 'send', true, { phone, text });
    return { demo: true };
  }
  const cfg = integrationConfig('sms');
  await postJson(cfg.baseUrl, { login: cfg.login, pwd: cfg.password, sender: cfg.sender, phones: [phone.replace('+', '')], text }, {});
  log('sms', 'send', false, { phone });
  return { demo: false };
}

// ---------- Messengers & push ----------

export async function sendTelegram(chatId: string | null, text: string) {
  const cfg = integrationConfig('telegram');
  const target = chatId || cfg.adminChatId;
  if (!isConfigured('telegram') || !target) {
    log('telegram', 'send', true, { chatId: target, text });
    return;
  }
  try {
    await postJson(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, { chat_id: target, text, parse_mode: 'HTML' }, {});
    log('telegram', 'send', false, { chatId: target });
  } catch (e) {
    log('telegram', 'error', false, String(e));
  }
}

export async function sendWhatsApp(phone: string, text: string) {
  if (!isConfigured('whatsapp')) {
    log('whatsapp', 'send', true, { phone, text });
    return;
  }
  const cfg = integrationConfig('whatsapp');
  try {
    await postJson(
      `https://graph.facebook.com/v20.0/${cfg.phoneNumberId}/messages`,
      { messaging_product: 'whatsapp', to: phone.replace('+', ''), type: 'text', text: { body: text } },
      { Authorization: `Bearer ${cfg.token}` },
    );
    log('whatsapp', 'send', false, { phone });
  } catch (e) {
    log('whatsapp', 'error', false, String(e));
  }
}

export async function sendPush(tokens: string[], title: string, body: string, data?: Record<string, unknown>) {
  const valid = tokens.filter((t) => t.startsWith('ExponentPushToken'));
  if (!valid.length) return;
  const cfg = integrationConfig('expoPush');
  try {
    await postJson(
      'https://exp.host/--/api/v2/push/send',
      valid.map((to) => ({ to, title, body, data })),
      cfg.accessToken ? { Authorization: `Bearer ${cfg.accessToken}` } : {},
    );
    log('expoPush', 'send', false, { count: valid.length });
  } catch (e) {
    log('expoPush', 'error', false, String(e));
  }
}

// ---------- Fiscal receipts ----------

export async function fiscalizeReceipt(orderNumber: string, items: { title: string; price: number; qty: number }[], total: number) {
  if (!isConfigured('fiscal')) {
    log('fiscal', 'receipt', true, { orderNumber, total });
    return { demo: true, receiptId: 'DEMO-FISCAL-' + orderNumber };
  }
  const cfg = integrationConfig('fiscal');
  const res = await postJson(`${cfg.baseUrl}/receipts`, { orderNumber, items, total }, { Authorization: `Bearer ${cfg.token}` });
  log('fiscal', 'receipt', false, res);
  return { demo: false, receiptId: String(res.id ?? '') };
}

// ---------- Warehouse sync (MoySklad / 1C) ----------

export interface StockRow {
  sku: string | null;
  barcode: string | null;
  title: string;
  price: number;
  stock: number;
}

export async function fetchMoySkladStock(token: string): Promise<StockRow[]> {
  const res = await fetch('https://api.moysklad.ru/api/remap/1.2/report/stock/all?limit=1000', {
    headers: { Authorization: `Bearer ${token}`, 'Accept-Encoding': 'gzip' },
  });
  if (!res.ok) throw new Error(`МойСклад: ${res.status}`);
  const data = (await res.json()) as { rows: any[] };
  log('moysklad', 'stock', false, { rows: data.rows?.length ?? 0 });
  return (data.rows ?? []).map((r) => ({
    sku: r.code ?? r.article ?? null,
    barcode: null,
    title: r.name,
    price: Math.round((r.salePrice ?? 0) / 100),
    stock: Math.max(0, Math.floor(r.stock ?? 0)),
  }));
}
