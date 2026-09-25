import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { BRAND, DEMO, formatPrice } from '@taptym/shared';
import { all, API_ROOT, get, run, nowIso, UPLOAD_DIR } from './db.ts';
import { seedDemo } from './seed.ts';
import { customer } from './routes/customer.ts';
import { supplier } from './routes/supplier.ts';
import { admin } from './routes/admin.ts';
import { ApiError, markPaid } from './services/orders.ts';
import { invalidateCatalog } from './services/catalog.ts';
import { integrationConfig } from './settings.ts';
import { createHmac, timingSafeEqual } from 'node:crypto';

if (seedDemo()) console.log('Demo data seeded');

const app = new Hono();
app.use('/api/*', cors());

app.onError((err, c) => {
  if (err instanceof ApiError) return c.json({ error: err.message }, err.status as any);
  console.error(err);
  return c.json({ error: 'server_error', message: String(err.message ?? err) }, 500);
});

app.get('/api/health', (c) => c.json({ ok: true, brand: BRAND.name, time: nowIso() }));
app.route('/api/c', customer);
app.route('/api/s', supplier);
app.route('/api/a', admin);

// ---------- bank webhooks ----------

function verifySignature(secret: string | undefined, raw: string, signature: string | undefined) {
  if (!secret) return false;
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(raw).digest('hex');
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

app.post('/api/webhooks/:provider', async (c) => {
  const provider = c.req.param('provider');
  const raw = await c.req.text();
  const cfg = integrationConfig(provider);
  if (!verifySignature(cfg.webhookSecret, raw, c.req.header('x-signature'))) return c.json({ error: 'bad_signature' }, 401);
  const data = JSON.parse(raw);
  const externalId = String(data.paymentId ?? data.id ?? '');
  const p = get<any>('SELECT * FROM payments WHERE external_id = ? AND provider = ?', externalId, provider);
  if (!p) return c.json({ error: 'unknown_payment' }, 404);
  if (['paid', 'success', 'SUCCESS', 'COMPLETED'].includes(String(data.status))) await markPaid(p.order_id, provider);
  return c.json({ ok: true });
});

// ---------- demo "bank app" page opened from the QR code ----------

app.get('/api/pay/:id', (c) => {
  const p = get<any>('SELECT p.*, o.number FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.id = ?', c.req.param('id'));
  if (!p) return c.text('Платёж не найден', 404);
  const paid = p.status === 'paid';
  return c.html(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Оплата ${p.number}</title><style>
body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#0B8F6A;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center}
.card{background:#fff;color:#0F1222;border-radius:28px;padding:28px;width:min(360px,90vw);box-shadow:0 20px 60px rgba(0,0,0,.25)}
.bank{font-weight:800;color:#0B8F6A;font-size:20px}.muted{color:#6B7085;font-size:14px}.sum{font-size:40px;font-weight:800;margin:16px 0}
button{width:100%;padding:18px;border:0;border-radius:16px;background:#0B8F6A;color:#fff;font-size:18px;font-weight:700;cursor:pointer}
.ok{font-size:64px;text-align:center}.demo{margin-top:14px;font-size:12px;color:#F79009;text-align:center}
</style></head><body><div class="card">
<div class="bank">MBank · демо</div><div class="muted">Получатель: ${BRAND.name} (ИП)</div>
<div class="muted">Назначение: заказ ${p.number}</div><div class="sum">${formatPrice(p.amount)}</div>
${paid ? '<div class="ok">✅</div><p style="text-align:center">Оплачено. Вернитесь в приложение.</p>' : `<form method="post"><button>Оплатить</button></form>`}
<div class="demo">Демо-режим: реальные деньги не списываются</div></div></body></html>`);
});

app.post('/api/pay/:id', async (c) => {
  const p = get<any>('SELECT * FROM payments WHERE id = ?', c.req.param('id'));
  if (!p) return c.text('Платёж не найден', 404);
  if (!p.demo) return c.text('Оплата проходит в приложении банка', 400);
  await markPaid(p.order_id, 'demo-qr');
  return c.redirect(`/api/pay/${p.id}`);
});

// ---------- external supplier API (1C / MoySklad / own ERP) ----------

app.use('/api/ext/v1/*', async (c, next) => {
  const token = c.req.header('x-api-token') ?? '';
  const s = token ? get<any>('SELECT id FROM suppliers WHERE api_token = ?', token) : null;
  if (!s) return c.json({ error: 'bad_token' }, 401);
  c.set('supplierId' as never, s.id as never);
  await next();
});

app.get('/api/ext/v1/offers', (c) => {
  const sid = c.get('supplierId' as never) as number;
  const items = all(
    'SELECT o.id, o.sku, p.barcode, p.title, o.price, o.stock, o.active FROM offers o JOIN products p ON p.id = o.product_id WHERE o.supplier_id = ?',
    sid,
  );
  return c.json({ count: items.length, items });
});

/** Bulk stock/price update: [{ sku | barcode, price?, stock? }]. */
app.put('/api/ext/v1/stock', async (c) => {
  const sid = c.get('supplierId' as never) as number;
  const items = (await c.req.json()) as { sku?: string; barcode?: string; price?: number; stock?: number }[];
  let updated = 0;
  const notFound: string[] = [];
  for (const it of Array.isArray(items) ? items : []) {
    const offer = it.sku
      ? get<any>('SELECT id FROM offers WHERE supplier_id = ? AND sku = ?', sid, it.sku)
      : it.barcode
        ? get<any>('SELECT o.id FROM offers o JOIN products p ON p.id = o.product_id WHERE o.supplier_id = ? AND p.barcode = ?', sid, it.barcode)
        : null;
    if (!offer) {
      notFound.push(it.sku ?? it.barcode ?? '?');
      continue;
    }
    if (typeof it.price === 'number') run('UPDATE offers SET price = ? WHERE id = ?', Math.round(it.price), offer.id);
    if (typeof it.stock === 'number') run('UPDATE offers SET stock = ? WHERE id = ?', Math.max(0, Math.round(it.stock)), offer.id);
    run('UPDATE offers SET updated_at = ? WHERE id = ?', nowIso(), offer.id);
    updated++;
  }
  invalidateCatalog();
  return c.json({ updated, notFound });
});

app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404));

// ---------- static: uploads and the three web apps ----------

const uploadsRoot = relative(process.cwd(), UPLOAD_DIR) || '.';
app.use('/uploads/*', serveStatic({ root: uploadsRoot, rewriteRequestPath: (p) => p.replace(/^\/uploads/, '') }));

const APPS_ROOT = resolve(API_ROOT, '..');
function spa(prefix: string, dir: string) {
  const abs = resolve(APPS_ROOT, dir);
  const root = relative(process.cwd(), abs) || '.';
  const index = resolve(abs, 'index.html');
  const handler = serveStatic({ root, rewriteRequestPath: (p) => (prefix === '/' ? p : p.slice(prefix.length) || '/') });
  const pattern = prefix === '/' ? '*' : `${prefix}/*`;
  app.use(pattern, handler);
  if (prefix !== '/') app.use(prefix, handler);
  app.get(pattern, (c) => {
    if (!existsSync(index)) return c.html(notBuilt(dir), 503);
    return c.html(readFileSync(index, 'utf8'));
  });
}

function notBuilt(dir: string) {
  return `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:40px"><h2>Приложение ещё не собрано</h2><p>Выполните <code>pnpm build:web</code> (${dir}).</p></body>`;
}

app.get('/demo', (c) =>
  c.html(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${BRAND.name} — демо</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,-apple-system,sans-serif;background:#F5F6FA;color:#0F1222}
.wrap{max-width:1040px;margin:0 auto;padding:48px 20px}.logo{font-weight:900;font-size:40px;letter-spacing:-1px}.logo span{color:${BRAND.primary}}
.sub{color:#6B7085;font-size:18px;margin:8px 0 36px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}
a.card{display:block;background:#fff;border-radius:28px;padding:28px;text-decoration:none;color:inherit;box-shadow:0 1px 2px rgba(16,24,40,.04),0 12px 32px rgba(16,24,40,.06);transition:transform .15s}
a.card:hover{transform:translateY(-4px)}.emoji{font-size:44px}.t{font-size:22px;font-weight:800;margin:14px 0 6px}.d{color:#6B7085;line-height:1.5}
.cred{margin-top:16px;background:#F5F6FA;border-radius:14px;padding:12px 14px;font-size:14px;line-height:1.7}.cred b{font-family:ui-monospace,monospace}
.note{margin-top:32px;color:#6B7085;font-size:14px}
</style></head><body><div class="wrap">
<div class="logo">Tap<span>tym</span></div><div class="sub">${BRAND.tagline}. Демо-версия маркетплейса канцтоваров для Оша.</div>
<div class="grid">
<a class="card" href="/"><div class="emoji">🛍️</div><div class="t">Приложение покупателя</div><div class="d">Поиск на 4 языках, сравнение цен, корзина из разных магазинов, QR-оплата, монеты.</div>
<div class="cred">Телефон: <b>${DEMO.customerPhone}</b><br>Код из SMS: <b>${DEMO.smsCode}</b></div></a>
<a class="card" href="/supplier/"><div class="emoji">🏪</div><div class="t">Кабинет поставщика</div><div class="d">Заказы, товары по фото и из Excel, финансы и выплаты, промокоды, сотрудники, отчёты.</div>
<div class="cred">Телефон: <b>${DEMO.supplierPhone}</b><br>Код из SMS: <b>${DEMO.smsCode}</b></div></a>
<a class="card" href="/admin/"><div class="emoji">🛡️</div><div class="t">Админ-панель</div><div class="d">Модерация, баннеры и реклама, выплаты с расчётом, промокоды, настройки комиссии, интеграции.</div>
<div class="cred">Email: <b>${DEMO.adminEmail}</b><br>Пароль: <b>${DEMO.adminPassword}</b></div></a>
</div><div class="note">Все платежи, SMS и доставки работают в демо-режиме, пока в админке не указаны ключи API.</div></div></body></html>`),
);

spa('/admin', 'admin/dist');
spa('/supplier', 'supplier/dist');
spa('/', 'customer/dist');

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) => {
  console.log(`${BRAND.name} API + web on http://localhost:${info.port}  (demo hub: /demo)`);
});
