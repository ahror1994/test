import { Hono } from 'hono';
import { CATEGORIES, DEMO, normalizePhone, type CheckoutRequest, type CustomerProfile, type Lang } from '@taptym/shared';
import { all, get, json, nowIso, run } from '../db.ts';
import { getSettings } from '../settings.ts';
import { sendSms, isDemoSms } from '../sms.ts';
import { baseUrl, body, createSession, customerAuth, customerMaybe, saveUpload, type Vars } from '../http.ts';
import { cardsByIds, listProducts, productDetail, suggest, supplierPublic, invalidateCatalog, type ListParams } from '../services/catalog.ts';
import {
  ApiError,
  buildQuote,
  cancelOrderByCustomer,
  getOrder,
  markPaid,
  paymentSession,
  placeOrder,
} from '../services/orders.ts';
import { listNotifications, markRead, unreadCount } from '../services/notify.ts';
import { threadsRouter } from './threads.ts';
import { OSH_LOCATIONS, SCHOOL_LISTS } from '../seed-data.ts';

export const customer = new Hono<{ Variables: Vars }>();

function profile(userId: number): CustomerProfile {
  const u = get<any>('SELECT * FROM users WHERE id = ?', userId);
  return {
    id: u.id,
    phone: u.phone,
    name: u.name,
    lang: u.lang,
    coins: u.coins,
    referralCode: u.referral_code,
    isCompany: !!u.is_company,
    companyName: u.company_name,
    companyInn: u.company_inn,
    addresses: all<any>('SELECT id, label, line, lat, lng FROM addresses WHERE user_id = ? ORDER BY id', userId),
    ordersCount: get<{ n: number }>('SELECT COUNT(*) AS n FROM orders WHERE user_id = ?', userId)?.n ?? 0,
  };
}

// ---------- auth ----------

customer.post('/auth/request-code', async (c) => {
  const { phone } = await body<{ phone: string }>(c);
  const p = normalizePhone(phone ?? '');
  if (p.length < 12) throw new ApiError(400, 'bad_phone');
  const demo = isDemoSms();
  const code = demo ? DEMO.smsCode : String(Math.floor(1000 + Math.random() * 9000));
  run(
    'INSERT INTO sms_codes(phone, code, expires_at) VALUES(?,?,?) ON CONFLICT(phone) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at',
    p,
    code,
    new Date(Date.now() + 5 * 60_000).toISOString(),
  );
  await sendSms(p, `Taptym: код входа ${code}`);
  return c.json({ ok: true, demoCode: demo ? code : null });
});

customer.post('/auth/verify', async (c) => {
  const { phone, code, referralCode, lang } = await body<{ phone: string; code: string; referralCode?: string; lang?: Lang }>(c);
  const p = normalizePhone(phone ?? '');
  const row = get<any>('SELECT * FROM sms_codes WHERE phone = ?', p);
  if (!row || row.code !== String(code).trim() || row.expires_at < nowIso()) throw new ApiError(400, 'bad_code');
  run('DELETE FROM sms_codes WHERE phone = ?', p);
  let u = get<any>('SELECT * FROM users WHERE phone = ?', p);
  let isNew = false;
  if (!u) {
    isNew = true;
    const settings = getSettings();
    const ref = referralCode ? get<any>('SELECT id FROM users WHERE UPPER(referral_code) = UPPER(?)', referralCode.trim()) : null;
    const myCode = 'T' + Math.random().toString(36).slice(2, 7).toUpperCase();
    const { lastInsertRowid } = run(
      'INSERT INTO users(phone, lang, referral_code, referred_by, coins, created_at) VALUES(?,?,?,?,?,?)',
      p,
      lang ?? 'ru',
      myCode,
      ref?.id ?? null,
      ref ? settings.referralFriendCoins : 0,
      nowIso(),
    );
    if (ref) {
      run('INSERT INTO coin_tx(user_id, amount, reason, created_at) VALUES(?,?,?,?)', lastInsertRowid, settings.referralFriendCoins, 'referral_welcome', nowIso());
    }
    u = get<any>('SELECT * FROM users WHERE id = ?', lastInsertRowid);
  }
  if (u.banned) throw new ApiError(403, 'user_blocked');
  return c.json({ token: createSession('customer', u.id), profile: profile(u.id), isNew });
});

// ---------- public catalog ----------

customer.get('/home', customerMaybe, (c) => {
  const now = nowIso();
  const banners = all<any>(
    `SELECT * FROM banners WHERE active = 1 AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at >= ?)
     ORDER BY placement, position`,
    now,
    now,
  ).map(bannerRow);
  const popular = listProducts({ sort: 'popular', limit: 12 }).items;
  const deals = listProducts({ sort: 'savings', deals: true, limit: 12 }).items;
  const fresh = listProducts({ sort: 'new', limit: 8 }).items;
  const suppliers = all<any>(
    `SELECT s.*, (SELECT COUNT(*) FROM sub_orders so WHERE so.supplier_id = s.id AND so.status = 'delivered') AS orders_count
     FROM suppliers s WHERE s.status = 'active' ORDER BY s.rating DESC`,
  ).map(supplierPublic);
  const settings = getSettings();
  return c.json({
    banners,
    categories: CATEGORIES,
    popular,
    deals,
    fresh,
    suppliers,
    seasonal: settings.seasonalTheme,
    schoolLists: SCHOOL_LISTS.map((l) => ({ id: l.id, title: l.title, emoji: l.emoji, itemsCount: l.items.length })),
    settings: publicSettings(),
  });
});

export function publicSettings() {
  const s = getSettings();
  return {
    freeDeliveryFrom: s.freeDeliveryFrom,
    coinsPer100: s.coinsPer100,
    coinValue: s.coinValue,
    coinsMaxPercent: s.coinsMaxPercent,
    referralBonusCoins: s.referralBonusCoins,
    referralFriendCoins: s.referralFriendCoins,
    sameDayCutoffHour: s.sameDayCutoffHour,
    supportPhone: s.supportPhone,
    supportTelegram: s.supportTelegram,
    freeFirstCourierDelivery: s.freeFirstCourierDelivery,
  };
}

export function bannerRow(b: any) {
  return {
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    emoji: b.emoji,
    color: b.color,
    textColor: b.text_color,
    placement: b.placement,
    position: b.position,
    link: b.link,
    supplierId: b.supplier_id,
    isAd: !!b.is_ad,
    active: !!b.active,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    price: b.price,
  };
}

customer.get('/categories', (c) => c.json(CATEGORIES));
customer.get('/locations', (c) => c.json(OSH_LOCATIONS));

customer.get('/products', (c) => {
  const q = c.req.query();
  const num = (v?: string) => (v != null && v !== '' ? Number(v) : undefined);
  return c.json(
    listProducts({
      q: q.q,
      category: q.category || undefined,
      sort: (q.sort as ListParams['sort']) || undefined,
      minPrice: num(q.minPrice),
      maxPrice: num(q.maxPrice),
      inStock: q.inStock === '1' || q.inStock === 'true',
      supplierId: num(q.supplierId),
      deals: q.deals === '1',
      page: num(q.page),
      limit: num(q.limit),
    }),
  );
});

customer.get('/search/suggest', (c) => c.json(suggest(c.req.query('q') ?? '')));

customer.get('/products/:id', customerMaybe, (c) => {
  const d = productDetail(Number(c.req.param('id')));
  if (!d) throw new ApiError(404, 'product_not_found');
  const userId = c.get('userId');
  const fav = userId ? !!get('SELECT 1 FROM favorites WHERE user_id = ? AND product_id = ?', userId, d.id) : false;
  return c.json({ ...d, isFavorite: fav });
});

customer.get('/suppliers/:id', (c) => {
  const s = get<any>(
    `SELECT s.*, (SELECT COUNT(*) FROM sub_orders so WHERE so.supplier_id = s.id AND so.status = 'delivered') AS orders_count
     FROM suppliers s WHERE s.id = ? AND s.status = 'active'`,
    Number(c.req.param('id')),
  );
  if (!s) throw new ApiError(404, 'supplier_not_found');
  return c.json({
    ...supplierPublic(s),
    description: s.description,
    workHours: s.work_hours,
    products: listProducts({ supplierId: s.id, limit: 100 }).items,
  });
});

customer.get('/school-lists', (c) => c.json(SCHOOL_LISTS));

/** Builds the cheapest in-stock cart for a school list. */
customer.post('/school-lists/:id/cart', (c) => {
  const list = SCHOOL_LISTS.find((l) => l.id === c.req.param('id'));
  if (!list) throw new ApiError(404, 'list_not_found');
  const byOffer = new Map<number, number>();
  const missing: string[] = [];
  for (const it of list.items) {
    // Most relevant product for the list item, then its cheapest in-stock offer.
    const card = listProducts({ q: it.query, inStock: true, limit: 1 }).items[0];
    const offer = card
      ? get<any>(
          `SELECT o.id FROM offers o JOIN suppliers s ON s.id = o.supplier_id AND s.status = 'active'
           WHERE o.product_id = ? AND o.active = 1 AND o.stock >= ? ORDER BY o.price LIMIT 1`,
          card.id,
          it.qty,
        )
      : null;
    if (offer) byOffer.set(offer.id, (byOffer.get(offer.id) ?? 0) + it.qty);
    else missing.push(it.query);
  }
  return c.json({ lines: [...byOffer].map(([offerId, qty]) => ({ offerId, qty })), missing });
});

customer.get('/offers', (c) => {
  const ids = (c.req.query('ids') ?? '').split(',').map(Number).filter(Boolean);
  if (!ids.length) return c.json([]);
  const rows = all<any>(
    `SELECT o.id, o.product_id, o.price, o.stock, o.active, p.title, p.emoji, p.color, p.images, s.name AS supplier_name, s.id AS supplier_id, s.logo_emoji
     FROM offers o JOIN products p ON p.id = o.product_id JOIN suppliers s ON s.id = o.supplier_id WHERE o.id IN (${ids.map(() => '?').join(',')})`,
    ...ids,
  );
  return c.json(
    rows.map((r) => ({
      offerId: r.id,
      productId: r.product_id,
      price: r.price,
      stock: r.stock,
      active: !!r.active,
      title: r.title,
      emoji: r.emoji,
      color: r.color,
      image: json<string[]>(r.images, [])[0] ?? null,
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      supplierEmoji: r.logo_emoji,
    })),
  );
});

customer.post('/cart/quote', customerMaybe, async (c) => {
  const req = await body<Partial<CheckoutRequest>>(c);
  const { promo, groupMeta, address, ...q } = await buildQuote(c.get('userId') ?? null, req);
  void promo;
  void groupMeta;
  void address;
  return c.json(q);
});

// ---------- authenticated ----------

customer.use('/me/*', customerAuth);
customer.use('/me', customerAuth);
customer.use('/orders/*', customerAuth);
customer.use('/orders', customerAuth);
customer.use('/favorites/*', customerAuth);
customer.use('/favorites', customerAuth);
customer.use('/coins', customerAuth);
customer.use('/notifications/*', customerAuth);
customer.use('/notifications', customerAuth);
customer.use('/upload', customerAuth);
customer.use('/reviews', customerAuth);
customer.use('/support/*', customerAuth);

customer.get('/me', (c) => c.json({ ...profile(c.get('userId')), unread: unreadCount('customer', c.get('userId')) }));

customer.patch('/me', async (c) => {
  const b = await body<any>(c);
  const u = c.get('userId');
  const fields: [string, any][] = [];
  if (typeof b.name === 'string') fields.push(['name', b.name.slice(0, 80)]);
  if (['ru', 'ky', 'uz', 'kk'].includes(b.lang)) fields.push(['lang', b.lang]);
  if (typeof b.isCompany === 'boolean') fields.push(['is_company', b.isCompany ? 1 : 0]);
  if (b.companyName !== undefined) fields.push(['company_name', b.companyName]);
  if (b.companyInn !== undefined) fields.push(['company_inn', b.companyInn]);
  if (typeof b.pushToken === 'string') fields.push(['push_token', b.pushToken]);
  for (const [k, v] of fields) run(`UPDATE users SET ${k} = ? WHERE id = ?`, v, u);
  return c.json(profile(u));
});

customer.post('/me/addresses', async (c) => {
  const b = await body<{ label: string; line: string; lat: number; lng: number }>(c);
  if (!b.line || typeof b.lat !== 'number' || typeof b.lng !== 'number') throw new ApiError(400, 'bad_address');
  const { lastInsertRowid } = run(
    'INSERT INTO addresses(user_id, label, line, lat, lng) VALUES(?,?,?,?,?)',
    c.get('userId'),
    b.label || 'Адрес',
    b.line,
    b.lat,
    b.lng,
  );
  return c.json({ id: lastInsertRowid, ...b });
});

customer.delete('/me/addresses/:id', (c) => {
  run('DELETE FROM addresses WHERE id = ? AND user_id = ?', Number(c.req.param('id')), c.get('userId'));
  return c.json({ ok: true });
});

customer.get('/favorites', (c) => {
  const ids = all<{ product_id: number }>('SELECT product_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC', c.get('userId')).map(
    (r) => r.product_id,
  );
  return c.json(cardsByIds(ids));
});
customer.post('/favorites/:productId', (c) => {
  run('INSERT OR IGNORE INTO favorites(user_id, product_id, created_at) VALUES(?,?,?)', c.get('userId'), Number(c.req.param('productId')), nowIso());
  return c.json({ ok: true });
});
customer.delete('/favorites/:productId', (c) => {
  run('DELETE FROM favorites WHERE user_id = ? AND product_id = ?', c.get('userId'), Number(c.req.param('productId')));
  return c.json({ ok: true });
});

customer.post('/orders', async (c) => {
  const req = await body<CheckoutRequest>(c);
  const order = await placeOrder(c.get('userId'), req, baseUrl(c));
  return c.json({ ...order, payment: await paymentSession(order.id) });
});

customer.get('/orders', (c) => {
  const ids = all<{ id: number }>('SELECT id FROM orders WHERE user_id = ? ORDER BY id DESC', c.get('userId'));
  return c.json(ids.map((r) => getOrder(r.id, c.get('userId'))));
});

customer.get('/orders/:id', async (c) => {
  const o = getOrder(Number(c.req.param('id')), c.get('userId'));
  if (!o) throw new ApiError(404, 'order_not_found');
  return c.json({ ...o, payment: await paymentSession(o.id) });
});

customer.post('/orders/:id/pay-demo', async (c) => {
  const id = Number(c.req.param('id'));
  const p = get<any>('SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1', id);
  const o = getOrder(id, c.get('userId'));
  if (!o || !p) throw new ApiError(404, 'order_not_found');
  if (!p.demo) throw new ApiError(400, 'live_payment');
  await markPaid(id, 'demo');
  return c.json({ ok: true });
});

customer.post('/orders/:id/cancel', async (c) => {
  await cancelOrderByCustomer(Number(c.req.param('id')), c.get('userId'));
  return c.json(getOrder(Number(c.req.param('id')), c.get('userId')));
});

customer.post('/orders/:id/repeat', (c) => {
  const o = getOrder(Number(c.req.param('id')), c.get('userId'));
  if (!o) throw new ApiError(404, 'order_not_found');
  const lines: { offerId: number; qty: number }[] = [];
  for (const s of o.subOrders) {
    for (const it of s.items) {
      const same = get<any>('SELECT id, stock FROM offers WHERE id = ? AND active = 1 AND stock > 0', it.offerId);
      const alt = same
        ? same
        : get<any>(
            `SELECT o.id FROM offers o JOIN suppliers s ON s.id = o.supplier_id AND s.status = 'active'
             WHERE o.product_id = ? AND o.active = 1 AND o.stock > 0 ORDER BY o.price LIMIT 1`,
            it.productId,
          );
      if (alt) lines.push({ offerId: alt.id, qty: it.qty });
    }
  }
  return c.json({ lines });
});

customer.get('/orders/:id/invoice', (c) => {
  const o = getOrder(Number(c.req.param('id')), c.get('userId'));
  if (!o) throw new ApiError(404, 'order_not_found');
  const u = get<any>('SELECT * FROM users WHERE id = ?', c.get('userId'));
  return c.html(invoiceHtml(o, u));
});

export function invoiceHtml(o: ReturnType<typeof getOrder> & {}, u: any) {
  const rows = o.subOrders
    .flatMap((s) => s.items.map((i) => `<tr><td>${i.title}</td><td>${s.supplier.name}</td><td>${i.qty}</td><td>${i.price}</td><td>${i.price * i.qty}</td></tr>`))
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Счёт ${o.number}</title>
<style>body{font-family:system-ui;margin:40px;color:#0F1222}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px;text-align:left}h1{margin:0 0 8px}.muted{color:#6B7085}
.scroll{overflow-x:auto}@media(max-width:600px){body{margin:16px;font-size:14px}h1{font-size:20px}td,th{padding:6px}}</style></head>
<body><h1>Счёт на оплату № ${o.number}</h1><div class="muted">от ${new Date(o.createdAt).toLocaleDateString('ru-RU')}</div>
<p><b>Поставщик:</b> ИП «Taptym» (маркетплейс), р/с в ОАО «MBank»<br><b>Покупатель:</b> ${u.company_name ?? u.name} ${u.company_inn ? '· ИНН ' + u.company_inn : ''}</p>
<div class="scroll"><table><tr><th>Товар</th><th>Продавец</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr>${rows}
<tr><td colspan="4">Доставка</td><td>${o.deliveryTotal}</td></tr><tr><td colspan="4">Скидка</td><td>-${o.promoDiscount + o.coinsUsed}</td></tr>
<tr><th colspan="4">Итого к оплате, сом</th><th>${o.total}</th></tr></table></div>
<p class="muted">Без НДС. Демо-документ, реквизиты будут подставлены после регистрации.</p><script>window.print&&setTimeout(()=>window.print(),300)</script></body></html>`;
}

customer.get('/coins', (c) => {
  const u = get<any>('SELECT coins, referral_code FROM users WHERE id = ?', c.get('userId'));
  const history = all<any>('SELECT * FROM coin_tx WHERE user_id = ? ORDER BY id DESC LIMIT 100', c.get('userId')).map((r) => ({
    id: r.id,
    amount: r.amount,
    reason: r.reason,
    orderId: r.order_id,
    createdAt: r.created_at,
  }));
  const invited = get<{ n: number }>('SELECT COUNT(*) AS n FROM users WHERE referred_by = ?', c.get('userId'))?.n ?? 0;
  return c.json({ balance: u.coins, referralCode: u.referral_code, invited, history, rules: publicSettings() });
});

customer.get('/notifications', (c) => c.json(listNotifications('customer', c.get('userId'))));
customer.post('/notifications/read', (c) => {
  markRead('customer', c.get('userId'));
  return c.json({ ok: true });
});

customer.post('/upload', async (c) => c.json(await saveUpload(c)));

customer.post('/reviews', async (c) => {
  const b = await body<{ productId: number; rating: number; text: string; photos?: string[]; videoUrl?: string }>(c);
  const u = get<any>('SELECT * FROM users WHERE id = ?', c.get('userId'));
  if (!b.productId || !(b.rating >= 1 && b.rating <= 5)) throw new ApiError(400, 'bad_review');
  const bought = get<any>(
    `SELECT so.supplier_id FROM order_items oi JOIN sub_orders so ON so.id = oi.sub_order_id JOIN orders o ON o.id = so.order_id
     WHERE o.user_id = ? AND oi.product_id = ? ORDER BY so.id DESC LIMIT 1`,
    u.id,
    b.productId,
  );
  run(
    'INSERT INTO reviews(product_id, user_id, user_name, supplier_id, rating, text, photos, video_url, created_at) VALUES(?,?,?,?,?,?,?,?,?)',
    b.productId,
    u.id,
    u.name || 'Покупатель',
    bought?.supplier_id ?? null,
    Math.round(b.rating),
    (b.text ?? '').slice(0, 2000),
    JSON.stringify((b.photos ?? []).slice(0, 6)),
    b.videoUrl ?? null,
    nowIso(),
  );
  invalidateCatalog();
  return c.json({ ok: true });
});

customer.route('/support', threadsRouter('customer'));
