import { Hono } from 'hono';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import {
  CATEGORIES,
  DEMO,
  indexDoc,
  normalizePhone,
  searchDocs,
  type SubOrderStatus,
  type SupplierDashboard,
  type SupplierProduct,
  type SupplierProfile,
} from '@taptym/shared';
import { all, get, json, nowIso, run, tx } from '../db.ts';
import { getSettings } from '../settings.ts';
import { isDemoSms, sendSms } from '../sms.ts';
import { body, createSession, newToken, requireSupplierScope, saveUpload, supplierAuth, supplierCan, type Vars } from '../http.ts';
import { ApiError, allowedNext, changeSubOrderStatus, subOrderRow, VISIBLE_PAYMENT } from '../services/orders.ts';
import { activeServices, breakdown } from '../services/finance.ts';
import { invalidateCatalog, reviewRow } from '../services/catalog.ts';
import { listNotifications, markRead, notify, unreadCount } from '../services/notify.ts';
import { threadsRouter } from './threads.ts';
import { fetchMoySkladStock } from '../integrations.ts';
import { SERVICE_CATALOG } from '../seed-data.ts';

export const supplier = new Hono<{ Variables: Vars }>();

function profile(supplierId: number, role: string): SupplierProfile {
  const s = get<any>('SELECT * FROM suppliers WHERE id = ?', supplierId);
  return {
    id: s.id,
    name: s.name,
    legalName: s.legal_name,
    inn: s.inn,
    phone: s.phone,
    address: s.address,
    lat: s.lat,
    lng: s.lng,
    logoEmoji: s.logo_emoji,
    color: s.color,
    description: s.description,
    status: s.status,
    trialUntil: s.trial_until,
    inTrial: !!s.trial_until && s.trial_until > nowIso(),
    ownDelivery: !!s.own_delivery,
    ownDeliveryFee: s.own_delivery_fee,
    ownFreeFrom: s.own_free_from,
    acceptsCash: !!s.accepts_cash,
    workHours: s.work_hours,
    rating: s.rating,
    payoutDetails: s.payout_details,
    integrations: { moysklad: !!s.moysklad_token, onec: !!s.onec_url, apiToken: role === 'owner' ? s.api_token : null },
    myRole: role as any,
  };
}

// ---------- auth & registration ----------

supplier.post('/auth/request-code', async (c) => {
  const { phone } = await body<{ phone: string }>(c);
  const p = normalizePhone(phone ?? '');
  if (p.length < 12) throw new ApiError(400, 'bad_phone');
  const demo = isDemoSms();
  const code = demo ? DEMO.smsCode : String(Math.floor(1000 + Math.random() * 9000));
  run(
    'INSERT INTO sms_codes(phone, code, expires_at) VALUES(?,?,?) ON CONFLICT(phone) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at',
    'S' + p,
    code,
    new Date(Date.now() + 5 * 60_000).toISOString(),
  );
  await sendSms(p, `Taptym Бизнес: код входа ${code}`);
  const exists = !!get('SELECT 1 FROM supplier_staff WHERE phone = ? AND active = 1', p);
  return c.json({ ok: true, demoCode: demo ? code : null, registered: exists });
});

supplier.post('/auth/verify', async (c) => {
  const b = await body<{ phone: string; code: string; supplierId?: number }>(c);
  const p = normalizePhone(b.phone ?? '');
  const row = get<any>('SELECT * FROM sms_codes WHERE phone = ?', 'S' + p);
  if (!row || row.code !== String(b.code).trim() || row.expires_at < nowIso()) throw new ApiError(400, 'bad_code');
  const staff = all<any>(
    'SELECT st.*, s.name AS supplier_name, s.status FROM supplier_staff st JOIN suppliers s ON s.id = st.supplier_id WHERE st.phone = ? AND st.active = 1',
    p,
  );
  if (!staff.length) {
    // Unknown phone: keep the code valid for registration.
    return c.json({ needsRegistration: true });
  }
  run('DELETE FROM sms_codes WHERE phone = ?', 'S' + p);
  const chosen = staff.find((s) => s.supplier_id === b.supplierId) ?? staff[0];
  if (chosen.status === 'banned') throw new ApiError(403, 'supplier_banned');
  return c.json({
    token: createSession('supplier', chosen.id, chosen.supplier_id),
    profile: profile(chosen.supplier_id, chosen.role),
    companies: staff.map((s) => ({ id: s.supplier_id, name: s.supplier_name, role: s.role })),
  });
});

supplier.post('/auth/register', async (c) => {
  const b = await body<any>(c);
  const p = normalizePhone(b.phone ?? '');
  const row = get<any>('SELECT * FROM sms_codes WHERE phone = ?', 'S' + p);
  if (!row || row.code !== String(b.code).trim() || row.expires_at < nowIso()) throw new ApiError(400, 'bad_code');
  if (!b.name?.trim() || !b.address?.trim()) throw new ApiError(400, 'name_address_required');
  const settings = getSettings();
  const trialUntil = new Date(Date.now() + settings.trialDays * 86400_000).toISOString();
  const colors = ['#FFE9D6', '#E8E3FF', '#DDF4E8', '#E3F0FF', '#FFE3EC', '#FFF4CC'];
  const { sid, staffId } = tx(() => {
    const { lastInsertRowid: sid } = run(
      `INSERT INTO suppliers(name, legal_name, inn, phone, address, lat, lng, logo_emoji, color, description, status, trial_until,
        own_delivery, own_delivery_fee, own_free_from, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      b.name.trim(),
      b.legalName ?? '',
      b.inn ?? '',
      p,
      b.address.trim(),
      b.lat ?? 40.5283,
      b.lng ?? 72.7985,
      b.logoEmoji ?? '🏪',
      colors[Math.floor(Math.random() * colors.length)],
      b.description ?? '',
      'active',
      trialUntil,
      b.ownDelivery ? 1 : 0,
      b.ownDeliveryFee ?? 0,
      b.ownFreeFrom ?? 0,
      nowIso(),
    );
    const { lastInsertRowid: staffId } = run(
      'INSERT INTO supplier_staff(supplier_id, name, phone, role) VALUES(?,?,?,?)',
      sid,
      b.ownerName ?? 'Владелец',
      p,
      'owner',
    );
    run('INSERT INTO threads(kind, supplier_id, title, updated_at, created_at) VALUES(?,?,?,?,?)', 'supplier_support', sid, 'Добро пожаловать в Taptym', nowIso(), nowIso());
    return { sid, staffId };
  });
  const thread = get<any>('SELECT id FROM threads WHERE supplier_id = ? ORDER BY id DESC LIMIT 1', sid);
  run(
    'INSERT INTO messages(thread_id, sender, sender_name, text, created_at) VALUES(?,?,?,?,?)',
    thread.id,
    'operator',
    'Команда Taptym',
    `Здравствуйте! Первые ${settings.trialDays} дней — без комиссии и абонплаты. Загрузите товары через Excel или фото — или закажите загрузку каталога нашими специалистами.`,
    nowIso(),
  );
  run('UPDATE threads SET unread_client = 1 WHERE id = ?', thread.id);
  run('DELETE FROM sms_codes WHERE phone = ?', 'S' + p);
  notify('admin', null, 'Новый поставщик', `${b.name} · ${p}`, `/suppliers/${sid}`);
  return c.json({ token: createSession('supplier', staffId, sid), profile: profile(sid, 'owner') });
});

supplier.use('*', async (c, next) => {
  if (c.req.path.includes('/auth/')) return next();
  return supplierAuth(c, next);
});

supplier.get('/me', (c) => {
  const role = c.get('supplierRole');
  const staff = get<any>('SELECT name FROM supplier_staff WHERE id = ?', c.get('staffId'));
  return c.json({
    ...profile(c.get('supplierId'), role),
    staffName: staff?.name,
    unread: unreadCount('supplier', c.get('supplierId')),
    newOrders:
      get<{ n: number }>(
        `SELECT COUNT(*) AS n FROM sub_orders so JOIN orders o ON o.id = so.order_id
         WHERE so.supplier_id = ? AND so.status = 'new' AND o.payment_status IN ${VISIBLE_PAYMENT}`,
        c.get('supplierId'),
      )?.n ?? 0,
    permissions: ['orders', 'orders_view', 'products', 'finance', 'finance_view', 'staff', 'promos', 'settings', 'reports', 'support'].filter((s) =>
      supplierCan(role, s),
    ),
  });
});

supplier.patch('/me', requireSupplierScope('settings'), async (c) => {
  const b = await body<any>(c);
  const map: Record<string, string> = {
    name: 'name',
    legalName: 'legal_name',
    inn: 'inn',
    address: 'address',
    lat: 'lat',
    lng: 'lng',
    logoEmoji: 'logo_emoji',
    description: 'description',
    ownDeliveryFee: 'own_delivery_fee',
    ownFreeFrom: 'own_free_from',
    workHours: 'work_hours',
    payoutDetails: 'payout_details',
  };
  for (const [k, col] of Object.entries(map)) if (b[k] !== undefined) run(`UPDATE suppliers SET ${col} = ? WHERE id = ?`, b[k], c.get('supplierId'));
  if (typeof b.ownDelivery === 'boolean') run('UPDATE suppliers SET own_delivery = ? WHERE id = ?', b.ownDelivery ? 1 : 0, c.get('supplierId'));
  if (typeof b.acceptsCash === 'boolean') run('UPDATE suppliers SET accepts_cash = ? WHERE id = ?', b.acceptsCash ? 1 : 0, c.get('supplierId'));
  invalidateCatalog();
  return c.json(profile(c.get('supplierId'), c.get('supplierRole')));
});

// ---------- dashboard ----------

supplier.get('/dashboard', (c) => {
  const sid = c.get('supplierId');
  const s = get<any>('SELECT * FROM suppliers WHERE id = ?', sid);
  const since = (days: number) => new Date(Date.now() - days * 86400_000).toISOString();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const agg = (from: string) =>
    get<any>(
      `SELECT COUNT(*) AS orders, COALESCE(SUM(subtotal), 0) AS revenue, COALESCE(SUM(commission), 0) AS commission FROM sub_orders so
       JOIN orders o ON o.id = so.order_id WHERE so.supplier_id = ? AND so.created_at >= ? AND so.status NOT IN ('cancelled','rejected')
       AND o.payment_status IN ${VISIBLE_PAYMENT}`,
      sid,
      from,
    );
  const today = agg(startOfDay.toISOString());
  const chart: SupplierDashboard['chart'] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(startOfDay.getTime() - i * 86400_000);
    const e = new Date(d.getTime() + 86400_000);
    const r = get<any>(
      `SELECT COUNT(*) AS orders, COALESCE(SUM(subtotal), 0) AS revenue FROM sub_orders WHERE supplier_id = ? AND created_at >= ? AND created_at < ?
       AND status NOT IN ('cancelled','rejected')`,
      sid,
      d.toISOString(),
      e.toISOString(),
    );
    chart.push({ date: d.toISOString().slice(0, 10), revenue: r.revenue, orders: r.orders });
  }
  const top = all<any>(
    `SELECT oi.title, oi.emoji, SUM(oi.qty) AS qty, SUM(oi.qty * oi.price) AS revenue FROM order_items oi
     JOIN sub_orders so ON so.id = oi.sub_order_id WHERE so.supplier_id = ? AND so.created_at >= ? AND so.status NOT IN ('cancelled','rejected')
     GROUP BY oi.product_id ORDER BY revenue DESC LIMIT 5`,
    sid,
    since(30),
  );
  const lowStock = all<any>(
    'SELECT o.id AS offerId, p.title, o.stock FROM offers o JOIN products p ON p.id = o.product_id WHERE o.supplier_id = ? AND o.active = 1 AND o.stock < 10 ORDER BY o.stock LIMIT 8',
    sid,
  );
  const priceAlerts = all<any>(
    `SELECT o.id AS offerId, p.title, o.price AS myPrice,
       (SELECT MIN(o2.price) FROM offers o2 JOIN suppliers s2 ON s2.id = o2.supplier_id AND s2.status = 'active'
        WHERE o2.product_id = o.product_id AND o2.supplier_id != o.supplier_id AND o2.active = 1 AND o2.stock > 0) AS minPrice
     FROM offers o JOIN products p ON p.id = o.product_id WHERE o.supplier_id = ? AND o.active = 1`,
    sid,
  )
    .filter((r) => r.minPrice != null && r.minPrice < r.myPrice)
    .sort((a, b) => b.myPrice - b.minPrice - (a.myPrice - a.minPrice))
    .slice(0, 6);
  const inTrial = !!s.trial_until && s.trial_until > nowIso();
  const month = agg(since(30));
  const week = agg(since(7));
  const dash: SupplierDashboard = {
    today: {
      orders: today.orders,
      revenue: today.revenue,
      newOrders:
        get<{ n: number }>(
          `SELECT COUNT(*) AS n FROM sub_orders so JOIN orders o ON o.id = so.order_id WHERE so.supplier_id = ? AND so.status = 'new' AND o.payment_status IN ${VISIBLE_PAYMENT}`,
          sid,
        )?.n ?? 0,
    },
    week: { orders: week.orders, revenue: week.revenue },
    month: { orders: month.orders, revenue: month.revenue, commission: month.commission },
    balance: breakdown(sid).available,
    chart,
    topProducts: top,
    lowStock,
    priceAlerts,
    inTrial,
    trialDaysLeft: inTrial ? Math.ceil((new Date(s.trial_until).getTime() - Date.now()) / 86400_000) : 0,
    rating: s.rating,
  };
  return c.json(dash);
});

// ---------- orders ----------

supplier.get('/orders', (c) => {
  const status = c.req.query('status');
  const groups: Record<string, string[]> = {
    new: ['new'],
    active: ['confirmed', 'assembling', 'ready', 'in_delivery'],
    done: ['delivered'],
    cancelled: ['cancelled', 'rejected'],
  };
  const list = status && groups[status] ? groups[status] : null;
  const rows = all<any>(
    `SELECT so.* FROM sub_orders so JOIN orders o ON o.id = so.order_id WHERE so.supplier_id = ? AND o.payment_status IN ${VISIBLE_PAYMENT}
     ${list ? `AND so.status IN (${list.map(() => '?').join(',')})` : ''} ORDER BY so.id DESC LIMIT 200`,
    c.get('supplierId'),
    ...(list ?? []),
  );
  const counts = all<any>(
    `SELECT so.status, COUNT(*) AS n FROM sub_orders so JOIN orders o ON o.id = so.order_id
     WHERE so.supplier_id = ? AND o.payment_status IN ${VISIBLE_PAYMENT} GROUP BY so.status`,
    c.get('supplierId'),
  );
  const count = (k: string) => counts.filter((r) => groups[k].includes(r.status)).reduce((a, r) => a + r.n, 0);
  return c.json({
    items: rows.map((r) => subOrderRow(r, true)),
    counts: { new: count('new'), active: count('active'), done: count('done'), cancelled: count('cancelled') },
  });
});

supplier.get('/orders/:id', (c) => {
  const so = get<any>('SELECT * FROM sub_orders WHERE id = ? AND supplier_id = ?', Number(c.req.param('id')), c.get('supplierId'));
  if (!so) throw new ApiError(404, 'order_not_found');
  return c.json({ ...subOrderRow(so, true), next: allowedNext(so.status), supplierDiscount: so.supplier_funded_discount ?? 0 });
});

supplier.post('/orders/:id/status', async (c) => {
  const role = c.get('supplierRole');
  if (!supplierCan(role, 'orders')) throw new ApiError(403, 'forbidden');
  const so = get<any>('SELECT * FROM sub_orders WHERE id = ? AND supplier_id = ?', Number(c.req.param('id')), c.get('supplierId'));
  if (!so) throw new ApiError(404, 'order_not_found');
  const b = await body<{ status: SubOrderStatus; reason?: string }>(c);
  const staff = get<any>('SELECT name FROM supplier_staff WHERE id = ?', c.get('staffId'));
  await changeSubOrderStatus(so.id, b.status, `Поставщик (${staff?.name ?? ''})`, false, b.reason ?? '');
  const fresh = get<any>('SELECT * FROM sub_orders WHERE id = ?', so.id);
  return c.json({ ...subOrderRow(fresh, true), next: allowedNext(fresh.status), supplierDiscount: fresh.supplier_funded_discount ?? 0 });
});

// ---------- products ----------

function supplierProductRow(r: any): SupplierProduct {
  return {
    offerId: r.offer_id,
    productId: r.product_id,
    title: r.title,
    brand: r.brand,
    categoryId: r.category_id,
    emoji: r.emoji,
    color: r.color,
    images: json<string[]>(r.images, []),
    barcode: r.barcode,
    description: r.description,
    price: r.price,
    oldPrice: r.old_price,
    wholesalePrice: r.wholesale_price,
    wholesaleFrom: r.wholesale_from,
    stock: r.stock,
    active: !!r.active,
    moderation: r.moderation,
    updatedAt: r.updated_at,
    competitorMinPrice: r.competitor_min,
    sold30d: r.sold30d ?? 0,
  };
}

const SUPPLIER_PRODUCTS_SQL = `
SELECT o.id AS offer_id, o.product_id, o.price, o.old_price, o.wholesale_price, o.wholesale_from, o.stock, o.active, o.updated_at,
  p.title, p.brand, p.category_id, p.emoji, p.color, p.images, p.barcode, p.description, p.moderation,
  (SELECT MIN(o2.price) FROM offers o2 WHERE o2.product_id = o.product_id AND o2.supplier_id != o.supplier_id AND o2.active = 1 AND o2.stock > 0) AS competitor_min,
  (SELECT COALESCE(SUM(oi.qty),0) FROM order_items oi JOIN sub_orders so ON so.id = oi.sub_order_id
    WHERE oi.offer_id = o.id AND so.created_at >= datetime('now','-30 days')) AS sold30d
FROM offers o JOIN products p ON p.id = o.product_id WHERE o.supplier_id = ?`;

supplier.get('/products', (c) => {
  const q = (c.req.query('q') ?? '').trim().toLowerCase();
  const filter = c.req.query('filter');
  let rows = all<any>(`${SUPPLIER_PRODUCTS_SQL} ORDER BY o.updated_at DESC`, c.get('supplierId')).map(supplierProductRow);
  if (q) rows = rows.filter((r) => r.title.toLowerCase().includes(q) || r.barcode?.includes(q));
  if (filter === 'low') rows = rows.filter((r) => r.stock < 10);
  if (filter === 'inactive') rows = rows.filter((r) => !r.active);
  if (filter === 'expensive') rows = rows.filter((r) => r.competitorMinPrice != null && r.competitorMinPrice < r.price);
  return c.json({ items: rows, categories: CATEGORIES });
});

/** Existing catalog cards a supplier can attach an offer to (keeps one card per product). */
supplier.get('/catalog/match', (c) => {
  const q = (c.req.query('q') ?? '').trim();
  const barcode = (c.req.query('barcode') ?? '').trim();
  if (barcode) {
    const p = get<any>('SELECT id, title, emoji, color, category_id, images, brand FROM products WHERE barcode = ?', barcode);
    return c.json(p ? [{ ...p, images: json(p.images, []) }] : []);
  }
  if (q.length < 2) return c.json([]);
  // Same multilingual, typo-tolerant matching as the storefront (SQLite LIKE is case-sensitive for Cyrillic).
  const rows = all<any>(
    `SELECT id, title, emoji, color, category_id, images, brand, keywords,
      (SELECT MIN(price) FROM offers WHERE product_id = products.id AND active = 1) AS min_price
     FROM products WHERE hidden = 0`,
  );
  const docs = rows.map((r) => indexDoc({ id: r.id, title: r.title, extra: [r.brand, r.keywords].filter(Boolean).join(' ') }));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const hits = searchDocs(q, docs).hits.slice(0, 8);
  return c.json(
    hits
      .map((h) => byId.get(h.id))
      .filter(Boolean)
      .map(({ keywords, ...r }) => ({ ...r, images: json(r.images, []) })),
  );
});

supplier.post('/products', requireSupplierScope('products'), async (c) => {
  const b = await body<any>(c);
  const sid = c.get('supplierId');
  if (!(b.price > 0)) throw new ApiError(400, 'price_required');
  const now = nowIso();
  const offerId = tx(() => {
    let productId: number = b.productId;
    if (productId) {
      if (get('SELECT 1 FROM offers WHERE product_id = ? AND supplier_id = ?', productId, sid)) throw new ApiError(409, 'offer_exists');
    } else {
      if (!b.title?.trim()) throw new ApiError(400, 'title_required');
      const cat = CATEGORIES.find((x) => x.id === b.categoryId) ?? CATEGORIES[0];
      productId = run(
        `INSERT INTO products(title, brand, category_id, emoji, color, images, video_url, barcode, description, keywords, moderation, created_by_supplier, created_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        b.title.trim(),
        b.brand || null,
        cat.id,
        b.emoji || cat.emoji,
        cat.color,
        JSON.stringify(b.images ?? []),
        b.videoUrl || null,
        b.barcode || null,
        b.description ?? '',
        b.keywords ?? '',
        'approved', // Auto-approved in demo; admin can hide in moderation.
        sid,
        now,
      ).lastInsertRowid;
    }
    return run(
      'INSERT INTO offers(product_id, supplier_id, price, old_price, wholesale_price, wholesale_from, stock, sku, active, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
      productId,
      sid,
      Math.round(b.price),
      b.oldPrice || null,
      b.wholesalePrice || null,
      b.wholesaleFrom || null,
      Math.max(0, Math.round(b.stock ?? 0)),
      b.sku || null,
      1,
      now,
    ).lastInsertRowid;
  });
  invalidateCatalog();
  const row = get(`${SUPPLIER_PRODUCTS_SQL} AND o.id = ?`, sid, offerId);
  return c.json(supplierProductRow(row));
});

supplier.patch('/products/:offerId', requireSupplierScope('products'), async (c) => {
  const sid = c.get('supplierId');
  const offer = get<any>('SELECT * FROM offers WHERE id = ? AND supplier_id = ?', Number(c.req.param('offerId')), sid);
  if (!offer) throw new ApiError(404, 'product_not_found');
  const b = await body<any>(c);
  const offerMap: Record<string, string> = {
    price: 'price',
    oldPrice: 'old_price',
    wholesalePrice: 'wholesale_price',
    wholesaleFrom: 'wholesale_from',
    stock: 'stock',
    sku: 'sku',
  };
  for (const [k, col] of Object.entries(offerMap)) if (b[k] !== undefined) run(`UPDATE offers SET ${col} = ? WHERE id = ?`, b[k], offer.id);
  if (typeof b.active === 'boolean') run('UPDATE offers SET active = ? WHERE id = ?', b.active ? 1 : 0, offer.id);
  run('UPDATE offers SET updated_at = ? WHERE id = ?', nowIso(), offer.id);
  // Only the supplier who created a card may edit its shared content.
  const product = get<any>('SELECT * FROM products WHERE id = ?', offer.product_id);
  if (product.created_by_supplier === sid) {
    const pMap: Record<string, string> = { title: 'title', brand: 'brand', description: 'description', barcode: 'barcode', categoryId: 'category_id', videoUrl: 'video_url' };
    for (const [k, col] of Object.entries(pMap)) if (b[k] !== undefined) run(`UPDATE products SET ${col} = ? WHERE id = ?`, b[k], product.id);
    if (Array.isArray(b.images)) run('UPDATE products SET images = ? WHERE id = ?', JSON.stringify(b.images), product.id);
  } else if (Array.isArray(b.images) && json<string[]>(product.images, []).length === 0) {
    run('UPDATE products SET images = ? WHERE id = ?', JSON.stringify(b.images), product.id);
  }
  invalidateCatalog();
  return c.json(supplierProductRow(get(`${SUPPLIER_PRODUCTS_SQL} AND o.id = ?`, sid, offer.id)));
});

supplier.delete('/products/:offerId', requireSupplierScope('products'), (c) => {
  run('DELETE FROM offers WHERE id = ? AND supplier_id = ?', Number(c.req.param('offerId')), c.get('supplierId'));
  invalidateCatalog();
  return c.json({ ok: true });
});

supplier.post('/upload', async (c) => c.json(await saveUpload(c)));

supplier.get('/products/template.csv', (c) => {
  const csv =
    '\ufeffНазвание;Штрихкод;Категория;Бренд;Цена;Старая цена;Остаток;Опт цена;Опт от;Описание\n' +
    'Ручка шариковая синяя;4601234567890;pens;Erich Krause;25;;500;20;50;Пишет мягко\n' +
    'Тетрадь 48 листов клетка;;notebooks;Hatber;45;55;300;;;\n';
  c.header('content-type', 'text/csv; charset=utf-8');
  c.header('content-disposition', 'attachment; filename="taptym-template.csv"');
  return c.body(csv);
});

interface ImportRow {
  title: string;
  barcode: string | null;
  category: string;
  brand: string | null;
  price: number;
  oldPrice: number | null;
  stock: number;
  wholesalePrice: number | null;
  wholesaleFrom: number | null;
  description: string;
}

function parseSheet(path: string): ImportRow[] {
  const buf = readFileSync(path);
  let wb: XLSX.WorkBook;
  if (/\.(csv|txt)$/i.test(path)) {
    // SheetJS mis-decodes UTF-8 CSV buffers; decode ourselves (Excel on Windows saves CSV as cp1251).
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('\ufffd')) text = new TextDecoder('windows-1251').decode(buf);
    wb = XLSX.read(text.replace(/^\ufeff/, ''), { type: 'string' });
  } else {
    wb = XLSX.read(buf, { type: 'buffer', codepage: 65001 });
  }
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
  const pick = (r: Record<string, any>, ...names: string[]) => {
    for (const key of Object.keys(r)) {
      const k = key.toLowerCase().replace(/\ufeff/g, '').trim();
      if (names.some((n) => k === n || k.startsWith(n))) return r[key];
    }
    return '';
  };
  const num = (v: any) => {
    const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) && String(v).trim() !== '' ? n : null;
  };
  return rows
    .map((r) => {
      const catRaw = String(pick(r, 'категория', 'category')).trim().toLowerCase();
      const cat = CATEGORIES.find((c) => c.id === catRaw || Object.values(c.name).some((n) => n.toLowerCase() === catRaw))?.id ?? 'office';
      return {
        title: String(pick(r, 'название', 'наименование', 'товар', 'title', 'name')).trim(),
        barcode: String(pick(r, 'штрихкод', 'barcode', 'ean')).trim() || null,
        category: cat,
        brand: String(pick(r, 'бренд', 'brand', 'производитель')).trim() || null,
        price: num(pick(r, 'цена', 'price')) ?? 0,
        oldPrice: num(pick(r, 'старая цена', 'old price')),
        stock: Math.max(0, Math.round(num(pick(r, 'остаток', 'количество', 'кол-во', 'stock', 'qty')) ?? 0)),
        wholesalePrice: num(pick(r, 'опт цена', 'оптовая цена', 'wholesale')),
        wholesaleFrom: num(pick(r, 'опт от', 'wholesale from')),
        description: String(pick(r, 'описание', 'description')).trim(),
      };
    })
    .filter((r) => r.title && r.price > 0);
}

/** Excel/CSV import: `preview=1` returns what will happen; otherwise applies it. Matches by barcode, then exact title. */
supplier.post('/products/import', requireSupplierScope('products'), async (c) => {
  const up = await saveUpload(c);
  const preview = c.req.query('preview') === '1';
  const sid = c.get('supplierId');
  const rows = parseSheet(up.path);
  const result = rows.map((r) => {
    const existing =
      (r.barcode && get<any>('SELECT id FROM products WHERE barcode = ?', r.barcode)) ||
      get<any>('SELECT id FROM products WHERE LOWER(title) = LOWER(?)', r.title);
    const myOffer = existing ? get<any>('SELECT id FROM offers WHERE product_id = ? AND supplier_id = ?', existing.id, sid) : null;
    return { row: r, productId: existing?.id ?? null, offerId: myOffer?.id ?? null, action: myOffer ? 'update' : existing ? 'attach' : 'create' };
  });
  if (!preview) {
    const now = nowIso();
    tx(() => {
      for (const x of result) {
        const r = x.row;
        if (x.action === 'update') {
          run(
            'UPDATE offers SET price = ?, old_price = ?, stock = ?, wholesale_price = ?, wholesale_from = ?, updated_at = ?, active = 1 WHERE id = ?',
            r.price,
            r.oldPrice,
            r.stock,
            r.wholesalePrice,
            r.wholesaleFrom,
            now,
            x.offerId,
          );
          continue;
        }
        let pid = x.productId;
        if (!pid) {
          const cat = CATEGORIES.find((cc) => cc.id === r.category)!;
          pid = run(
            'INSERT INTO products(title, brand, category_id, emoji, color, barcode, description, moderation, created_by_supplier, created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
            r.title,
            r.brand,
            cat.id,
            cat.emoji,
            cat.color,
            r.barcode,
            r.description,
            'approved',
            sid,
            now,
          ).lastInsertRowid;
        }
        run(
          'INSERT INTO offers(product_id, supplier_id, price, old_price, wholesale_price, wholesale_from, stock, active, updated_at) VALUES(?,?,?,?,?,?,?,1,?)',
          pid,
          sid,
          r.price,
          r.oldPrice,
          r.wholesalePrice,
          r.wholesaleFrom,
          r.stock,
          now,
        );
      }
    });
    invalidateCatalog();
  }
  return c.json({
    preview,
    total: result.length,
    create: result.filter((x) => x.action === 'create').length,
    attach: result.filter((x) => x.action === 'attach').length,
    update: result.filter((x) => x.action === 'update').length,
    rows: result.slice(0, 50).map((x) => ({ ...x.row, action: x.action })),
  });
});

supplier.get('/reviews', (c) =>
  c.json(
    all(
      `SELECT r.*, p.title AS product_title FROM reviews r JOIN products p ON p.id = r.product_id
       WHERE r.product_id IN (SELECT product_id FROM offers WHERE supplier_id = ?) AND r.hidden = 0 ORDER BY r.created_at DESC LIMIT 50`,
      c.get('supplierId'),
    ).map((r: any) => ({ ...reviewRow(r), productTitle: r.product_title })),
  ),
);

// ---------- finance ----------

supplier.get('/finance', (c) => {
  const sid = c.get('supplierId');
  if (!supplierCan(c.get('supplierRole'), 'finance') && !supplierCan(c.get('supplierRole'), 'finance_view')) throw new ApiError(403, 'forbidden');
  const ledger = all<any>('SELECT * FROM ledger WHERE supplier_id = ? ORDER BY id DESC LIMIT 200', sid).map((l) => ({
    id: l.id,
    type: l.type,
    amount: l.amount,
    note: l.note,
    subOrderId: l.sub_order_id,
    createdAt: l.created_at,
  }));
  const payouts = all<any>('SELECT * FROM payouts WHERE supplier_id = ? ORDER BY id DESC', sid).map((p) => ({
    id: p.id,
    amount: p.amount,
    method: p.method,
    details: p.details,
    status: p.status,
    comment: p.comment,
    createdAt: p.created_at,
    processedAt: p.processed_at,
  }));
  const s = get<any>('SELECT payout_details FROM suppliers WHERE id = ?', sid);
  return c.json({
    breakdown: breakdown(sid),
    ledger,
    payouts,
    services: activeServices(sid),
    payoutDetails: s.payout_details,
    commissionPercent: getSettings().commissionPercent,
  });
});

supplier.post('/payouts', requireSupplierScope('finance'), async (c) => {
  const sid = c.get('supplierId');
  const b = await body<{ amount: number; method: 'mbank' | 'bank_account' | 'cash'; details: string }>(c);
  const bd = breakdown(sid);
  const pending = get<{ n: number }>("SELECT COALESCE(SUM(amount),0) AS n FROM payouts WHERE supplier_id = ? AND status IN ('requested','confirmed')", sid)?.n ?? 0;
  const amount = Math.round(b.amount);
  if (!(amount > 0)) throw new ApiError(400, 'bad_amount');
  if (amount > bd.available - pending) throw new ApiError(400, 'insufficient_balance');
  const services = activeServices(sid);
  const { lastInsertRowid } = run(
    'INSERT INTO payouts(supplier_id, amount, method, details, status, breakdown, services, created_at) VALUES(?,?,?,?,?,?,?,?)',
    sid,
    amount,
    b.method ?? 'mbank',
    b.details ?? '',
    'requested',
    JSON.stringify(bd),
    JSON.stringify(services),
    nowIso(),
  );
  if (b.details) run('UPDATE suppliers SET payout_details = ? WHERE id = ?', b.details, sid);
  const s = get<any>('SELECT name FROM suppliers WHERE id = ?', sid);
  notify('admin', null, 'Запрос на выплату', `${s.name}: ${amount} сом → ${b.details}. Позвоните и подтвердите.`, `/payouts/${lastInsertRowid}`);
  return c.json({ ok: true, id: lastInsertRowid });
});

// ---------- promotions & services ----------

supplier.get('/services', (c) => {
  const sid = c.get('supplierId');
  const s = get<any>('SELECT created_at FROM suppliers WHERE id = ?', sid);
  const settings = getSettings();
  const firstMonth = Date.now() - new Date(s.created_at).getTime() < 30 * 86400_000;
  const hasBanner = !!get("SELECT 1 FROM supplier_services WHERE supplier_id = ? AND type = 'banner'", sid);
  return c.json({
    catalog: SERVICE_CATALOG.map((x) => ({
      ...x,
      price: x.type === 'catalog_upload' ? settings.catalogUploadHourlyRate : x.price,
      free: x.type === 'banner' && settings.freeBannerFirstMonth && firstMonth && !hasBanner,
    })),
    mine: all<any>('SELECT * FROM supplier_services WHERE supplier_id = ? ORDER BY id DESC', sid).map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      price: r.price,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      status: r.status,
    })),
  });
});

supplier.post('/services', requireSupplierScope('promos'), async (c) => {
  const sid = c.get('supplierId');
  const b = await body<{ type: string; hours?: number; note?: string }>(c);
  const def = SERVICE_CATALOG.find((x) => x.type === b.type);
  if (!def) throw new ApiError(400, 'unknown_service');
  const settings = getSettings();
  const s = get<any>('SELECT * FROM suppliers WHERE id = ?', sid);
  const firstMonth = Date.now() - new Date(s.created_at).getTime() < 30 * 86400_000;
  const hasBanner = !!get("SELECT 1 FROM supplier_services WHERE supplier_id = ? AND type = 'banner'", sid);
  let price = def.type === 'catalog_upload' ? settings.catalogUploadHourlyRate * Math.max(1, b.hours ?? 1) : def.price;
  if (def.type === 'banner' && settings.freeBannerFirstMonth && firstMonth && !hasBanner) price = 0;
  const start = new Date();
  const end = def.days ? new Date(start.getTime() + def.days * 86400_000).toISOString() : null;
  const title = def.type === 'catalog_upload' ? `${def.title} (${Math.max(1, b.hours ?? 1)} ч)` : def.title;
  // Banners and catalog upload need operator work, so they start as pending.
  const status = def.type === 'banner' || def.type === 'catalog_upload' ? 'pending' : 'active';
  const { lastInsertRowid } = run(
    'INSERT INTO supplier_services(supplier_id, type, title, price, status, starts_at, ends_at, created_at) VALUES(?,?,?,?,?,?,?,?)',
    sid,
    def.type,
    title,
    price,
    status,
    start.toISOString(),
    end,
    nowIso(),
  );
  if (price > 0) {
    run(
      'INSERT INTO ledger(supplier_id, type, amount, note, created_at) VALUES(?,?,?,?,?)',
      sid,
      def.type === 'catalog_upload' || def.type === 'courier_plan' ? 'service' : 'promotion',
      -price,
      title,
      nowIso(),
    );
  }
  invalidateCatalog();
  notify('admin', null, 'Заказ услуги', `${s.name}: ${title} · ${price} сом${b.note ? ' · ' + b.note : ''}`, `/suppliers/${sid}`);
  return c.json({ ok: true, id: lastInsertRowid });
});

supplier.get('/promos', (c) =>
  c.json(
    all<any>('SELECT * FROM promo_codes WHERE supplier_id = ? ORDER BY id DESC', c.get('supplierId')).map((p) => ({
      id: p.id,
      code: p.code,
      type: p.type,
      value: p.value,
      minTotal: p.min_total,
      maxUses: p.max_uses,
      used: p.used,
      status: p.status,
      fundedBy: p.funded_by,
      startsAt: p.starts_at,
      endsAt: p.ends_at,
      description: p.description,
    })),
  ),
);

supplier.post('/promos', requireSupplierScope('promos'), async (c) => {
  const b = await body<any>(c);
  const code = String(b.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length < 4) throw new ApiError(400, 'bad_code');
  if (get('SELECT 1 FROM promo_codes WHERE code = ?', code)) throw new ApiError(409, 'code_exists');
  if (!['percent', 'fixed', 'free_delivery'].includes(b.type)) throw new ApiError(400, 'bad_type');
  run(
    `INSERT INTO promo_codes(code, type, value, min_total, max_uses, per_user, supplier_id, funded_by, status, starts_at, ends_at, description, created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    code,
    b.type,
    Math.round(b.value ?? 0),
    Math.round(b.minTotal ?? 0),
    Math.round(b.maxUses ?? 100),
    1,
    c.get('supplierId'),
    'supplier',
    'pending',
    b.startsAt ?? null,
    b.endsAt ?? null,
    b.description ?? '',
    nowIso(),
  );
  const s = get<any>('SELECT name FROM suppliers WHERE id = ?', c.get('supplierId'));
  notify('admin', null, 'Промокод на согласование', `${s.name}: ${code}`, '/promos');
  return c.json({ ok: true });
});

// ---------- staff ----------

supplier.get('/staff', requireSupplierScope('staff'), (c) =>
  c.json(
    all<any>('SELECT * FROM supplier_staff WHERE supplier_id = ? ORDER BY id', c.get('supplierId')).map((s) => ({
      id: s.id,
      name: s.name,
      phone: s.phone,
      role: s.role,
      active: !!s.active,
    })),
  ),
);
supplier.post('/staff', requireSupplierScope('staff'), async (c) => {
  const b = await body<{ name: string; phone: string; role: string }>(c);
  if (!['manager', 'cashier', 'warehouse'].includes(b.role)) throw new ApiError(400, 'bad_role');
  const phone = normalizePhone(b.phone ?? '');
  if (phone.length < 12) throw new ApiError(400, 'bad_phone');
  try {
    run('INSERT INTO supplier_staff(supplier_id, name, phone, role) VALUES(?,?,?,?)', c.get('supplierId'), b.name || 'Сотрудник', phone, b.role);
  } catch {
    throw new ApiError(409, 'staff_exists');
  }
  return c.json({ ok: true });
});
supplier.patch('/staff/:id', requireSupplierScope('staff'), async (c) => {
  const b = await body<{ role?: string; active?: boolean; name?: string }>(c);
  const id = Number(c.req.param('id'));
  const st = get<any>('SELECT * FROM supplier_staff WHERE id = ? AND supplier_id = ?', id, c.get('supplierId'));
  if (!st || st.role === 'owner') throw new ApiError(400, 'cannot_edit_owner');
  if (b.role && ['manager', 'cashier', 'warehouse'].includes(b.role)) run('UPDATE supplier_staff SET role = ? WHERE id = ?', b.role, id);
  if (typeof b.active === 'boolean') run('UPDATE supplier_staff SET active = ? WHERE id = ?', b.active ? 1 : 0, id);
  if (b.name) run('UPDATE supplier_staff SET name = ? WHERE id = ?', b.name, id);
  return c.json({ ok: true });
});
supplier.delete('/staff/:id', requireSupplierScope('staff'), (c) => {
  run("DELETE FROM supplier_staff WHERE id = ? AND supplier_id = ? AND role != 'owner'", Number(c.req.param('id')), c.get('supplierId'));
  return c.json({ ok: true });
});

// ---------- reports (tax) ----------

function taxReport(sid: number, month: string) {
  const from = `${month}-01T00:00:00.000Z`;
  const d = new Date(from);
  const to = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString();
  const rows = all<any>(
    `SELECT so.id, o.number, so.created_at, so.subtotal, so.delivery_fee, so.delivery_method, so.commission, so.supplier_funded_discount,
       o.payment_method, so.status
     FROM sub_orders so JOIN orders o ON o.id = so.order_id
     WHERE so.supplier_id = ? AND so.status = 'delivered' AND so.created_at >= ? AND so.created_at < ? ORDER BY so.id`,
    sid,
    from,
    to,
  );
  const services = all<any>(
    "SELECT note, amount, created_at FROM ledger WHERE supplier_id = ? AND type IN ('promotion','service') AND created_at >= ? AND created_at < ?",
    sid,
    from,
    to,
  );
  const rowRevenue = (r: any) => r.subtotal + (r.delivery_method === 'supplier' ? r.delivery_fee : 0) - r.supplier_funded_discount;
  const revenue = rows.reduce((a, r) => a + rowRevenue(r), 0);
  const commission = rows.reduce((a, r) => a + r.commission, 0);
  const servicesTotal = -services.reduce((a, r) => a + r.amount, 0);
  return {
    month,
    ordersCount: rows.length,
    revenue,
    commission,
    services: servicesTotal,
    cashRevenue: rows.filter((r) => r.payment_method === 'cash').reduce((a, r) => a + rowRevenue(r), 0),
    cashlessRevenue: rows.filter((r) => r.payment_method !== 'cash').reduce((a, r) => a + rowRevenue(r), 0),
    // Kyrgyz single tax on patent / simplified regime varies — show a reference estimate only.
    taxEstimate: Math.round(revenue * 0.04),
    taxNote: 'Оценка по единому налогу 4% (упрощённая система). Уточните ставку у бухгалтера.',
    rows: rows.map((r) => ({
      number: r.number,
      date: r.created_at,
      subtotal: r.subtotal,
      delivery: r.delivery_method === 'supplier' ? r.delivery_fee : 0,
      discount: r.supplier_funded_discount,
      commission: r.commission,
      payment: r.payment_method,
    })),
  };
}

supplier.get('/reports/tax', requireSupplierScope('reports'), (c) => {
  const month = c.req.query('month') ?? new Date().toISOString().slice(0, 7);
  return c.json(taxReport(c.get('supplierId'), month));
});

supplier.get('/reports/tax.csv', requireSupplierScope('reports'), (c) => {
  const month = c.req.query('month') ?? new Date().toISOString().slice(0, 7);
  const r = taxReport(c.get('supplierId'), month);
  const lines = ['Заказ;Дата;Сумма товаров;Доставка;Скидка поставщика;Комиссия;Оплата'];
  for (const x of r.rows) lines.push([x.number, x.date.slice(0, 10), x.subtotal, x.delivery, x.discount, x.commission, x.payment].join(';'));
  lines.push('', `Выручка;${r.revenue}`, `Комиссия площадки;${r.commission}`, `Услуги продвижения;${r.services}`, `Оценка налога;${r.taxEstimate}`);
  c.header('content-type', 'text/csv; charset=utf-8');
  c.header('content-disposition', `attachment; filename="taptym-report-${month}.csv"`);
  return c.body('\ufeff' + lines.join('\n'));
});

// ---------- integrations ----------

supplier.post('/integrations', requireSupplierScope('settings'), async (c) => {
  const b = await body<{ moyskladToken?: string; onecUrl?: string; regenerateToken?: boolean }>(c);
  const sid = c.get('supplierId');
  if (b.moyskladToken !== undefined) run('UPDATE suppliers SET moysklad_token = ? WHERE id = ?', b.moyskladToken || null, sid);
  if (b.onecUrl !== undefined) run('UPDATE suppliers SET onec_url = ? WHERE id = ?', b.onecUrl || null, sid);
  if (b.regenerateToken) run('UPDATE suppliers SET api_token = ? WHERE id = ?', 'tk_' + newToken(), sid);
  return c.json(profile(sid, c.get('supplierRole')));
});

supplier.post('/integrations/sync', requireSupplierScope('products'), async (c) => {
  const sid = c.get('supplierId');
  const s = get<any>('SELECT moysklad_token FROM suppliers WHERE id = ?', sid);
  if (!s.moysklad_token) throw new ApiError(400, 'moysklad_not_connected');
  let rows;
  try {
    rows = await fetchMoySkladStock(s.moysklad_token);
  } catch (e) {
    throw new ApiError(502, String((e as Error).message));
  }
  let updated = 0;
  for (const r of rows) {
    const res = run('UPDATE offers SET stock = ?, price = ?, updated_at = ? WHERE supplier_id = ? AND sku = ?', r.stock, r.price, nowIso(), sid, r.sku ?? '');
    updated += res.changes;
  }
  invalidateCatalog();
  return c.json({ ok: true, fetched: rows.length, updated });
});

// ---------- notifications & support ----------

supplier.get('/notifications', (c) => c.json(listNotifications('supplier', c.get('supplierId'))));
supplier.post('/notifications/read', (c) => {
  markRead('supplier', c.get('supplierId'));
  return c.json({ ok: true });
});
supplier.route('/support', threadsRouter('supplier'));
