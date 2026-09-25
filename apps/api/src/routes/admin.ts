import { Hono } from 'hono';
import { ADMIN_PERMISSIONS, type SubOrderStatus } from '@taptym/shared';
import { all, get, json, nowIso, run } from '../db.ts';
import { getSettings, integrationsForAdmin, INTEGRATIONS, saveIntegration, saveSettings } from '../settings.ts';
import { adminAuth, body, createSession, hashPassword, requirePerm, saveUpload, verifyPassword, type Vars } from '../http.ts';
import { ApiError, allowedNext, changeSubOrderStatus, getOrder, markPaid, subOrderRow } from '../services/orders.ts';
import { activeServices, breakdown, supplierBalance } from '../services/finance.ts';
import { invalidateCatalog, reviewRow, supplierPublic } from '../services/catalog.ts';
import { listNotifications, markRead, notify, unreadCount } from '../services/notify.ts';
import { sendPayout } from '../integrations.ts';
import { tr, userLang } from '../services/texts.ts';
import { bannerRow } from './customer.ts';
import { addMessage, messageRow, threadRow } from './threads.ts';

export const admin = new Hono<{ Variables: Vars }>();

function adminRow(a: any) {
  return {
    id: a.id,
    name: a.name,
    email: a.email,
    role: a.role,
    permissions: a.role === 'owner' ? [...ADMIN_PERMISSIONS] : json(a.permissions, []),
    active: !!a.active,
  };
}

admin.post('/auth/login', async (c) => {
  const b = await body<{ email: string; password: string }>(c);
  const a = get<any>('SELECT * FROM admin_users WHERE LOWER(email) = LOWER(?) AND active = 1', (b.email ?? '').trim());
  if (!a || !verifyPassword(b.password ?? '', a.password_hash)) throw new ApiError(401, 'bad_credentials');
  return c.json({ token: createSession('admin', a.id), admin: adminRow(a) });
});

admin.use('*', async (c, next) => {
  if (c.req.path.endsWith('/auth/login')) return next();
  return adminAuth(c, next);
});

admin.get('/me', (c) => {
  const a = get<any>('SELECT * FROM admin_users WHERE id = ?', c.get('adminId'));
  return c.json({ ...adminRow(a), unread: unreadCount('admin', null), badges: badges() });
});

function badges() {
  const n = (sql: string) => get<{ n: number }>(sql)?.n ?? 0;
  return {
    newOrders: n(
      "SELECT COUNT(DISTINCT so.order_id) AS n FROM sub_orders so JOIN orders o ON o.id = so.order_id WHERE so.status = 'new' AND o.payment_status IN ('paid','cash_on_delivery','awaiting_invoice')",
    ),
    payouts: n("SELECT COUNT(*) AS n FROM payouts WHERE status IN ('requested','confirmed')"),
    promos: n("SELECT COUNT(*) AS n FROM promo_codes WHERE status = 'pending'"),
    support: n("SELECT COUNT(*) AS n FROM threads WHERE status = 'open' AND unread_operator > 0"),
    services: n("SELECT COUNT(*) AS n FROM supplier_services WHERE status = 'pending'"),
  };
}

admin.get('/notifications', (c) => c.json(listNotifications('admin', null, 100)));
admin.post('/notifications/read', (c) => {
  markRead('admin', null);
  return c.json({ ok: true });
});

// ---------- dashboard ----------

admin.get('/dashboard', requirePerm('dashboard'), (c) => {
  const days = Number(c.req.query('days') ?? 30);
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const valid = "o.status != 'cancelled' AND o.payment_status IN ('paid','cash_on_delivery','awaiting_invoice')";
  const kpi = get<any>(
    `SELECT COUNT(*) AS orders, COALESCE(SUM(o.total),0) AS gmv, COALESCE(AVG(o.total),0) AS avg FROM orders o WHERE o.created_at >= ? AND ${valid}`,
    since,
  );
  const commission =
    get<any>(
      "SELECT COALESCE(SUM(so.commission),0) AS c FROM sub_orders so WHERE so.created_at >= ? AND so.status NOT IN ('cancelled','rejected')",
      since,
    )?.c ?? 0;
  const promoRevenue = -(get<any>("SELECT COALESCE(SUM(amount),0) AS c FROM ledger WHERE type IN ('promotion','service') AND created_at >= ?", since)?.c ?? 0);
  const chart = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let i = Math.min(days, 30) - 1; i >= 0; i--) {
    const d = new Date(start.getTime() - i * 86400_000);
    const e = new Date(d.getTime() + 86400_000);
    const r = get<any>(`SELECT COUNT(*) AS orders, COALESCE(SUM(o.total),0) AS gmv FROM orders o WHERE o.created_at >= ? AND o.created_at < ? AND ${valid}`, d.toISOString(), e.toISOString());
    const cm = get<any>("SELECT COALESCE(SUM(commission),0) AS c FROM sub_orders WHERE created_at >= ? AND created_at < ? AND status NOT IN ('cancelled','rejected')", d.toISOString(), e.toISOString());
    chart.push({ date: d.toISOString().slice(0, 10), orders: r.orders, gmv: r.gmv, commission: cm.c });
  }
  const topSuppliers = all<any>(
    `SELECT s.id, s.name, s.logo_emoji, COUNT(so.id) AS orders, COALESCE(SUM(so.subtotal),0) AS revenue, COALESCE(SUM(so.commission),0) AS commission
     FROM suppliers s LEFT JOIN sub_orders so ON so.supplier_id = s.id AND so.created_at >= ? AND so.status NOT IN ('cancelled','rejected')
     GROUP BY s.id ORDER BY revenue DESC LIMIT 8`,
    since,
  );
  const topProducts = all<any>(
    `SELECT oi.title, oi.emoji, SUM(oi.qty) AS qty, SUM(oi.qty*oi.price) AS revenue FROM order_items oi JOIN sub_orders so ON so.id = oi.sub_order_id
     WHERE so.created_at >= ? AND so.status NOT IN ('cancelled','rejected') GROUP BY oi.product_id ORDER BY revenue DESC LIMIT 8`,
    since,
  );
  const n = (sql: string, ...a: any[]) => get<{ n: number }>(sql, ...a)?.n ?? 0;
  return c.json({
    kpi: {
      gmv: kpi.gmv,
      orders: kpi.orders,
      avgCheck: Math.round(kpi.avg),
      commission,
      promoRevenue,
      customers: n('SELECT COUNT(*) AS n FROM users'),
      newCustomers: n('SELECT COUNT(*) AS n FROM users WHERE created_at >= ?', since),
      suppliers: n("SELECT COUNT(*) AS n FROM suppliers WHERE status = 'active'"),
      products: n('SELECT COUNT(*) AS n FROM products WHERE hidden = 0'),
      offers: n('SELECT COUNT(*) AS n FROM offers WHERE active = 1'),
      // Positive: money the platform currently owes suppliers.
      platformDebt: get<any>('SELECT COALESCE(SUM(amount),0) AS n FROM ledger')?.n ?? 0,
    },
    chart,
    topSuppliers,
    topProducts,
    paymentMix: all("SELECT payment_method AS method, COUNT(*) AS n, SUM(total) AS total FROM orders o WHERE created_at >= ? AND " + valid + ' GROUP BY payment_method', since),
    deliveryMix: all("SELECT delivery_method AS method, COUNT(*) AS n FROM sub_orders WHERE created_at >= ? AND status NOT IN ('cancelled','rejected') GROUP BY delivery_method", since),
    badges: badges(),
    recent: all<any>('SELECT id FROM orders ORDER BY id DESC LIMIT 8').map((r) => adminOrderRow(r.id)),
  });
});

// ---------- orders ----------

function adminOrderRow(id: number) {
  const o = getOrder(id)!;
  const u = get<any>('SELECT o.user_id, u.name, u.phone, u.is_company, u.company_name FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?', id);
  return { ...o, customer: { id: u.user_id, name: u.name || 'Клиент', phone: u.phone, isCompany: !!u.is_company, companyName: u.company_name } };
}

admin.get('/orders', requirePerm('orders'), (c) => {
  const status = c.req.query('status');
  const q = (c.req.query('q') ?? '').trim();
  const where: string[] = [];
  const args: any[] = [];
  if (status === 'unpaid') where.push("o.payment_status IN ('pending','awaiting_invoice')");
  else if (status === 'new') where.push("EXISTS (SELECT 1 FROM sub_orders so WHERE so.order_id = o.id AND so.status = 'new') AND o.payment_status IN ('paid','cash_on_delivery','awaiting_invoice')");
  else if (status) {
    where.push('o.status = ?');
    args.push(status);
  }
  if (q) {
    where.push('(o.number LIKE ? OR u.phone LIKE ? OR u.name LIKE ?)');
    args.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const rows = all<any>(
    `SELECT o.id FROM orders o JOIN users u ON u.id = o.user_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY o.id DESC LIMIT 200`,
    ...args,
  );
  return c.json(rows.map((r) => adminOrderRow(r.id)));
});

admin.get('/orders/:id', requirePerm('orders'), (c) => {
  const id = Number(c.req.param('id'));
  if (!get('SELECT 1 FROM orders WHERE id = ?', id)) throw new ApiError(404, 'order_not_found');
  const o = adminOrderRow(id);
  return c.json({
    ...o,
    subOrders: all<any>('SELECT * FROM sub_orders WHERE order_id = ?', id).map((s) => ({ ...subOrderRow(s, true), next: allowedNext(s.status), courierNote: s.courier_note })),
    payments: all('SELECT * FROM payments WHERE order_id = ?', id),
  });
});

admin.post('/sub-orders/:id/status', requirePerm('orders'), async (c) => {
  const b = await body<{ status: SubOrderStatus; reason?: string; force?: boolean }>(c);
  await changeSubOrderStatus(Number(c.req.param('id')), b.status, `Оператор ${c.get('adminName')}`, !!b.force, b.reason ?? '');
  return c.json({ ok: true });
});

admin.post('/sub-orders/:id/courier', requirePerm('orders'), async (c) => {
  const b = await body<{ note: string }>(c);
  run('UPDATE sub_orders SET courier_note = ? WHERE id = ?', b.note ?? '', Number(c.req.param('id')));
  return c.json({ ok: true });
});

admin.post('/orders/:id/mark-paid', requirePerm('orders'), async (c) => {
  await markPaid(Number(c.req.param('id')), `admin:${c.get('adminId')}`);
  return c.json({ ok: true });
});

// ---------- suppliers ----------

function adminSupplierRow(s: any) {
  const n = (sql: string) => get<{ n: number }>(sql, s.id)?.n ?? 0;
  return {
    ...supplierPublic(s),
    phone: s.phone,
    legalName: s.legal_name,
    inn: s.inn,
    status: s.status,
    banReason: s.ban_reason,
    trialUntil: s.trial_until,
    inTrial: !!s.trial_until && s.trial_until > nowIso(),
    createdAt: s.created_at,
    offers: n('SELECT COUNT(*) AS n FROM offers WHERE supplier_id = ?'),
    orders: n("SELECT COUNT(*) AS n FROM sub_orders WHERE supplier_id = ? AND status NOT IN ('cancelled','rejected')"),
    revenue: n("SELECT COALESCE(SUM(subtotal),0) AS n FROM sub_orders WHERE supplier_id = ? AND status = 'delivered'"),
    balance: supplierBalance(s.id),
    ownDeliveryFee: s.own_delivery_fee,
    acceptsCash: !!s.accepts_cash,
    payoutDetails: s.payout_details,
  };
}

admin.get('/suppliers', requirePerm('suppliers'), (c) => {
  const q = (c.req.query('q') ?? '').trim();
  const rows = all<any>(
    `SELECT * FROM suppliers ${q ? 'WHERE name LIKE ? OR phone LIKE ?' : ''} ORDER BY id DESC`,
    ...(q ? [`%${q}%`, `%${q}%`] : []),
  );
  return c.json(rows.map(adminSupplierRow));
});

admin.get('/suppliers/:id', requirePerm('suppliers'), (c) => {
  const s = get<any>('SELECT * FROM suppliers WHERE id = ?', Number(c.req.param('id')));
  if (!s) throw new ApiError(404, 'supplier_not_found');
  return c.json({
    ...adminSupplierRow(s),
    address: s.address,
    description: s.description,
    breakdown: breakdown(s.id),
    services: all<any>('SELECT * FROM supplier_services WHERE supplier_id = ? ORDER BY id DESC', s.id),
    staff: all<any>('SELECT * FROM supplier_staff WHERE supplier_id = ?', s.id),
    ledger: all<any>('SELECT * FROM ledger WHERE supplier_id = ? ORDER BY id DESC LIMIT 100', s.id),
    payouts: all<any>('SELECT * FROM payouts WHERE supplier_id = ? ORDER BY id DESC', s.id),
  });
});

admin.patch('/suppliers/:id', requirePerm('suppliers'), async (c) => {
  const id = Number(c.req.param('id'));
  const b = await body<any>(c);
  const s = get<any>('SELECT * FROM suppliers WHERE id = ?', id);
  if (!s) throw new ApiError(404, 'supplier_not_found');
  if (b.status && ['active', 'banned', 'paused'].includes(b.status)) {
    run('UPDATE suppliers SET status = ?, ban_reason = ? WHERE id = ?', b.status, b.status === 'banned' ? (b.reason ?? '') : null, id);
    if (b.status === 'banned') run("DELETE FROM sessions WHERE kind = 'supplier' AND supplier_id = ?", id);
    notify('supplier', id, b.status === 'active' ? 'Магазин активен' : 'Магазин заблокирован', b.reason ?? '');
  }
  if (b.trialUntil !== undefined) run('UPDATE suppliers SET trial_until = ? WHERE id = ?', b.trialUntil, id);
  if (typeof b.rating === 'number') run('UPDATE suppliers SET rating = ? WHERE id = ?', b.rating, id);
  for (const [k, col] of Object.entries({ name: 'name', phone: 'phone', legalName: 'legal_name', inn: 'inn', address: 'address' })) {
    if (b[k] !== undefined) run(`UPDATE suppliers SET ${col} = ? WHERE id = ?`, b[k], id);
  }
  invalidateCatalog();
  return c.json({ ok: true });
});

admin.post('/suppliers/:id/adjust', requirePerm('payouts'), async (c) => {
  const b = await body<{ amount: number; note: string }>(c);
  if (!b.amount) throw new ApiError(400, 'bad_amount');
  run(
    'INSERT INTO ledger(supplier_id, type, amount, note, created_at) VALUES(?,?,?,?,?)',
    Number(c.req.param('id')),
    'adjustment',
    Math.round(b.amount),
    `${b.note || 'Корректировка'} (${c.get('adminName')})`,
    nowIso(),
  );
  return c.json({ ok: true });
});

admin.post('/suppliers', requirePerm('suppliers'), async (c) => {
  const b = await body<any>(c);
  if (!b.name || !b.phone) throw new ApiError(400, 'name_phone_required');
  const trialUntil = new Date(Date.now() + getSettings().trialDays * 86400_000).toISOString();
  const { lastInsertRowid } = run(
    'INSERT INTO suppliers(name, phone, address, lat, lng, logo_emoji, color, trial_until, created_at) VALUES(?,?,?,?,?,?,?,?,?)',
    b.name,
    b.phone,
    b.address ?? 'Ош',
    b.lat ?? 40.5283,
    b.lng ?? 72.7985,
    b.logoEmoji ?? '🏪',
    '#EDEFF5',
    trialUntil,
    nowIso(),
  );
  run('INSERT INTO supplier_staff(supplier_id, name, phone, role) VALUES(?,?,?,?)', lastInsertRowid, b.ownerName ?? 'Владелец', b.phone, 'owner');
  return c.json({ id: lastInsertRowid });
});

admin.get('/services', requirePerm('suppliers'), (c) =>
  c.json(all('SELECT ss.*, s.name AS supplier_name FROM supplier_services ss JOIN suppliers s ON s.id = ss.supplier_id ORDER BY ss.id DESC LIMIT 200')),
);
admin.patch('/services/:id', requirePerm('suppliers'), async (c) => {
  const b = await body<{ status: string }>(c);
  const id = Number(c.req.param('id'));
  const svc = get<any>('SELECT * FROM supplier_services WHERE id = ?', id);
  if (!svc) throw new ApiError(404, 'not_found');
  run('UPDATE supplier_services SET status = ? WHERE id = ?', b.status, id);
  if (b.status === 'cancelled' && svc.price > 0) {
    run('INSERT INTO ledger(supplier_id, type, amount, note, created_at) VALUES(?,?,?,?,?)', svc.supplier_id, 'refund', svc.price, `Возврат: ${svc.title}`, nowIso());
  }
  invalidateCatalog();
  notify('supplier', svc.supplier_id, `Услуга «${svc.title}»`, b.status === 'active' ? 'Подключена' : `Статус: ${b.status}`);
  return c.json({ ok: true });
});

// ---------- customers ----------

admin.get('/customers', requirePerm('customers'), (c) => {
  const q = (c.req.query('q') ?? '').trim();
  return c.json(
    all<any>(
      `SELECT u.*, (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS orders_count,
        (SELECT COALESCE(SUM(total),0) FROM orders o WHERE o.user_id = u.id AND o.status != 'cancelled') AS spent
       FROM users u ${q ? 'WHERE u.phone LIKE ? OR u.name LIKE ? OR u.company_name LIKE ?' : ''} ORDER BY u.id DESC LIMIT 300`,
      ...(q ? [`%${q}%`, `%${q}%`, `%${q}%`] : []),
    ).map((u) => ({
      id: u.id,
      name: u.name,
      phone: u.phone,
      lang: u.lang,
      coins: u.coins,
      isCompany: !!u.is_company,
      companyName: u.company_name,
      banned: !!u.banned,
      ordersCount: u.orders_count,
      spent: u.spent,
      referralCode: u.referral_code,
      createdAt: u.created_at,
    })),
  );
});

admin.patch('/customers/:id', requirePerm('customers'), async (c) => {
  const id = Number(c.req.param('id'));
  const b = await body<{ banned?: boolean; coinsDelta?: number; reason?: string }>(c);
  if (typeof b.banned === 'boolean') {
    run('UPDATE users SET banned = ? WHERE id = ?', b.banned ? 1 : 0, id);
    if (b.banned) run("DELETE FROM sessions WHERE kind = 'customer' AND subject_id = ?", id);
  }
  if (b.coinsDelta) {
    run('UPDATE users SET coins = MAX(0, coins + ?) WHERE id = ?', Math.round(b.coinsDelta), id);
    run('INSERT INTO coin_tx(user_id, amount, reason, created_at) VALUES(?,?,?,?)', id, Math.round(b.coinsDelta), b.reason || 'admin_bonus', nowIso());
    if (b.coinsDelta > 0) {
      const lang = userLang(id);
      notify('customer', id, tr(lang, 'coinsTitle', { c: b.coinsDelta }), b.reason || tr(lang, 'giftBody'), '/coins');
    }
  }
  return c.json({ ok: true });
});

// ---------- products & reviews moderation ----------

admin.get('/products', requirePerm('products'), (c) => {
  const q = (c.req.query('q') ?? '').trim();
  const filter = c.req.query('filter');
  const where: string[] = [];
  const args: any[] = [];
  if (q) {
    where.push('(p.title LIKE ? OR p.barcode LIKE ?)');
    args.push(`%${q}%`, `%${q}%`);
  }
  if (filter === 'hidden') where.push('p.hidden = 1');
  if (filter === 'supplier_created') where.push('p.created_by_supplier IS NOT NULL');
  const rows = all<any>(
    `SELECT p.*, COUNT(o.id) AS offers, MIN(o.price) AS min_price, MAX(o.price) AS max_price, s.name AS creator
     FROM products p LEFT JOIN offers o ON o.product_id = p.id LEFT JOIN suppliers s ON s.id = p.created_by_supplier
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} GROUP BY p.id ORDER BY p.id DESC LIMIT 300`,
    ...args,
  );
  return c.json(
    rows.map((p) => ({
      id: p.id,
      title: p.title,
      brand: p.brand,
      categoryId: p.category_id,
      emoji: p.emoji,
      color: p.color,
      images: json(p.images, []),
      barcode: p.barcode,
      hidden: !!p.hidden,
      moderation: p.moderation,
      offers: p.offers,
      minPrice: p.min_price,
      maxPrice: p.max_price,
      creator: p.creator,
      keywords: p.keywords,
      createdAt: p.created_at,
    })),
  );
});

admin.patch('/products/:id', requirePerm('products'), async (c) => {
  const id = Number(c.req.param('id'));
  const b = await body<any>(c);
  if (typeof b.hidden === 'boolean') run('UPDATE products SET hidden = ? WHERE id = ?', b.hidden ? 1 : 0, id);
  for (const [k, col] of Object.entries({ title: 'title', brand: 'brand', categoryId: 'category_id', keywords: 'keywords', emoji: 'emoji', moderation: 'moderation', description: 'description' })) {
    if (b[k] !== undefined) run(`UPDATE products SET ${col} = ? WHERE id = ?`, b[k], id);
  }
  invalidateCatalog();
  return c.json({ ok: true });
});

admin.get('/reviews', requirePerm('products'), (c) =>
  c.json(
    all<any>('SELECT r.*, p.title AS product_title FROM reviews r JOIN products p ON p.id = r.product_id ORDER BY r.id DESC LIMIT 200').map((r) => ({
      ...reviewRow(r),
      productTitle: r.product_title,
      hidden: !!r.hidden,
    })),
  ),
);
admin.patch('/reviews/:id', requirePerm('products'), async (c) => {
  const b = await body<{ hidden: boolean }>(c);
  run('UPDATE reviews SET hidden = ? WHERE id = ?', b.hidden ? 1 : 0, Number(c.req.param('id')));
  invalidateCatalog();
  return c.json({ ok: true });
});

// ---------- payouts ----------

function payoutRow(p: any) {
  const s = get<any>('SELECT name, phone FROM suppliers WHERE id = ?', p.supplier_id);
  return {
    id: p.id,
    supplierId: p.supplier_id,
    supplierName: s?.name ?? '',
    supplierPhone: s?.phone ?? '',
    amount: p.amount,
    method: p.method,
    details: p.details,
    status: p.status,
    breakdown: json(p.breakdown, {}),
    currentBreakdown: breakdown(p.supplier_id),
    services: json(p.services, []),
    activeServices: activeServices(p.supplier_id),
    comment: p.comment,
    createdAt: p.created_at,
    processedAt: p.processed_at,
  };
}

admin.get('/payouts', requirePerm('payouts'), (c) => {
  const status = c.req.query('status');
  const rows = status ? all('SELECT * FROM payouts WHERE status = ? ORDER BY id DESC', status) : all('SELECT * FROM payouts ORDER BY id DESC LIMIT 200');
  return c.json(rows.map(payoutRow));
});

admin.post('/payouts/:id/:action', requirePerm('payouts'), async (c) => {
  const id = Number(c.req.param('id'));
  const action = c.req.param('action');
  const b = await body<{ comment?: string }>(c);
  const p = get<any>('SELECT * FROM payouts WHERE id = ?', id);
  if (!p) throw new ApiError(404, 'payout_not_found');
  const now = nowIso();
  if (action === 'confirm' && p.status === 'requested') {
    run("UPDATE payouts SET status = 'confirmed', comment = ?, processed_by = ? WHERE id = ?", b.comment ?? 'Подтверждено по телефону', c.get('adminId'), id);
    notify('supplier', p.supplier_id, 'Выплата подтверждена', `Сумма ${p.amount} сом будет отправлена в ближайшее время.`, '/finance');
  } else if (action === 'pay' && ['requested', 'confirmed'].includes(p.status)) {
    if (p.amount > supplierBalance(p.supplier_id)) throw new ApiError(400, 'insufficient_balance');
    const s = get<any>('SELECT name FROM suppliers WHERE id = ?', p.supplier_id);
    const res = await sendPayout(s.name, p.details, p.amount);
    run(
      'INSERT INTO ledger(supplier_id, type, amount, note, payout_id, created_at) VALUES(?,?,?,?,?,?)',
      p.supplier_id,
      'payout',
      -p.amount,
      `Выплата #${id} · ${res.reference}`,
      id,
      now,
    );
    run("UPDATE payouts SET status = 'paid', processed_at = ?, processed_by = ?, comment = ? WHERE id = ?", now, c.get('adminId'), `${b.comment ?? p.comment ?? ''} ${res.reference}`.trim(), id);
    notify('supplier', p.supplier_id, 'Выплата отправлена', `${p.amount} сом → ${p.details}`, '/finance');
  } else if (action === 'reject' && ['requested', 'confirmed'].includes(p.status)) {
    run("UPDATE payouts SET status = 'rejected', processed_at = ?, comment = ? WHERE id = ?", now, b.comment ?? '', id);
    notify('supplier', p.supplier_id, 'Выплата отклонена', b.comment ?? 'Свяжитесь с поддержкой', '/finance');
  } else throw new ApiError(400, 'bad_action');
  return c.json(payoutRow(get('SELECT * FROM payouts WHERE id = ?', id)));
});

// ---------- promo codes ----------

function promoRow(p: any) {
  const s = p.supplier_id ? get<any>('SELECT name FROM suppliers WHERE id = ?', p.supplier_id) : null;
  return {
    id: p.id,
    code: p.code,
    type: p.type,
    value: p.value,
    minTotal: p.min_total,
    maxUses: p.max_uses,
    used: p.used,
    perUser: p.per_user,
    supplierId: p.supplier_id,
    supplierName: s?.name ?? null,
    fundedBy: p.funded_by,
    status: p.status,
    startsAt: p.starts_at,
    endsAt: p.ends_at,
    description: p.description,
    createdAt: p.created_at,
  };
}

admin.get('/promos', requirePerm('promos'), (c) => c.json(all("SELECT * FROM promo_codes ORDER BY (status = 'pending') DESC, id DESC").map(promoRow)));

admin.post('/promos', requirePerm('promos'), async (c) => {
  const b = await body<any>(c);
  const code = String(b.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length < 3) throw new ApiError(400, 'bad_code');
  if (get('SELECT 1 FROM promo_codes WHERE code = ?', code)) throw new ApiError(409, 'code_exists');
  run(
    `INSERT INTO promo_codes(code, type, value, min_total, max_uses, per_user, supplier_id, funded_by, status, starts_at, ends_at, description, created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    code,
    b.type ?? 'percent',
    Math.round(b.value ?? 10),
    Math.round(b.minTotal ?? 0),
    Math.round(b.maxUses ?? 0),
    Math.round(b.perUser ?? 1),
    b.supplierId || null,
    b.fundedBy ?? 'platform',
    'active',
    b.startsAt || null,
    b.endsAt || null,
    b.description ?? '',
    nowIso(),
  );
  return c.json({ ok: true });
});

admin.patch('/promos/:id', requirePerm('promos'), async (c) => {
  const id = Number(c.req.param('id'));
  const b = await body<any>(c);
  const p = get<any>('SELECT * FROM promo_codes WHERE id = ?', id);
  if (!p) throw new ApiError(404, 'not_found');
  const map: Record<string, string> = { status: 'status', value: 'value', minTotal: 'min_total', maxUses: 'max_uses', perUser: 'per_user', endsAt: 'ends_at', startsAt: 'starts_at', description: 'description', fundedBy: 'funded_by', type: 'type' };
  for (const [k, col] of Object.entries(map)) if (b[k] !== undefined) run(`UPDATE promo_codes SET ${col} = ? WHERE id = ?`, b[k], id);
  if (p.supplier_id && b.status && b.status !== p.status) {
    notify('supplier', p.supplier_id, `Промокод ${p.code}`, b.status === 'active' ? 'Одобрен и работает' : b.status === 'rejected' ? 'Отклонён' : `Статус: ${b.status}`, '/promos');
  }
  return c.json({ ok: true });
});

admin.delete('/promos/:id', requirePerm('promos'), (c) => {
  run('DELETE FROM promo_codes WHERE id = ?', Number(c.req.param('id')));
  return c.json({ ok: true });
});

// ---------- banners / ads ----------

admin.get('/banners', requirePerm('banners'), (c) =>
  c.json(
    all<any>('SELECT b.*, s.name AS supplier_name FROM banners b LEFT JOIN suppliers s ON s.id = b.supplier_id ORDER BY b.placement, b.position').map((b) => ({
      ...bannerRow(b),
      supplierName: b.supplier_name,
    })),
  ),
);

const BANNER_FIELDS: Record<string, string> = {
  title: 'title',
  subtitle: 'subtitle',
  emoji: 'emoji',
  color: 'color',
  textColor: 'text_color',
  placement: 'placement',
  link: 'link',
  supplierId: 'supplier_id',
  startsAt: 'starts_at',
  endsAt: 'ends_at',
  price: 'price',
};

admin.post('/banners', requirePerm('banners'), async (c) => {
  const b = await body<any>(c);
  if (!b.title) throw new ApiError(400, 'title_required');
  const pos = (get<any>('SELECT MAX(position) AS m FROM banners WHERE placement = ?', b.placement ?? 'home_top')?.m ?? 0) + 1;
  const { lastInsertRowid } = run(
    `INSERT INTO banners(title, subtitle, emoji, color, text_color, placement, position, link, supplier_id, is_ad, active, starts_at, ends_at, price, created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    b.title,
    b.subtitle ?? '',
    b.emoji ?? '✨',
    b.color ?? '#5B3CF5',
    b.textColor ?? '#FFFFFF',
    b.placement ?? 'home_top',
    pos,
    b.link ?? '',
    b.supplierId || null,
    b.supplierId ? 1 : 0,
    b.active === false ? 0 : 1,
    b.startsAt || null,
    b.endsAt || null,
    Math.round(b.price ?? 0),
    nowIso(),
  );
  if (b.supplierId && b.price > 0 && b.chargeSupplier) {
    run('INSERT INTO ledger(supplier_id, type, amount, note, created_at) VALUES(?,?,?,?,?)', b.supplierId, 'promotion', -Math.round(b.price), `Баннер «${b.title}»`, nowIso());
  }
  return c.json({ id: lastInsertRowid });
});

admin.patch('/banners/:id', requirePerm('banners'), async (c) => {
  const id = Number(c.req.param('id'));
  const b = await body<any>(c);
  for (const [k, col] of Object.entries(BANNER_FIELDS)) if (b[k] !== undefined) run(`UPDATE banners SET ${col} = ? WHERE id = ?`, b[k] === '' ? null : b[k], id);
  if (typeof b.active === 'boolean') run('UPDATE banners SET active = ? WHERE id = ?', b.active ? 1 : 0, id);
  if (b.supplierId !== undefined) run('UPDATE banners SET is_ad = ? WHERE id = ?', b.supplierId ? 1 : 0, id);
  return c.json({ ok: true });
});

admin.delete('/banners/:id', requirePerm('banners'), (c) => {
  run('DELETE FROM banners WHERE id = ?', Number(c.req.param('id')));
  return c.json({ ok: true });
});

admin.post('/banners/reorder', requirePerm('banners'), async (c) => {
  const b = await body<{ ids: number[] }>(c);
  (b.ids ?? []).forEach((id, i) => run('UPDATE banners SET position = ? WHERE id = ?', i + 1, id));
  return c.json({ ok: true });
});

admin.post('/upload', async (c) => c.json(await saveUpload(c)));

// ---------- support ----------

admin.get('/support/threads', requirePerm('support'), (c) => {
  const status = c.req.query('status') ?? 'open';
  const rows = all<any>(
    `SELECT t.*, u.name AS u_name, u.phone AS u_phone, s.name AS s_name FROM threads t
     LEFT JOIN users u ON u.id = t.user_id LEFT JOIN suppliers s ON s.id = t.supplier_id
     ${status === 'all' ? '' : 'WHERE t.status = ?'} ORDER BY t.updated_at DESC LIMIT 200`,
    ...(status === 'all' ? [] : [status]),
  );
  return c.json(rows.map((t) => ({ ...threadRow(t, true), who: t.s_name ?? (t.u_name || t.u_phone), whoType: t.supplier_id ? 'supplier' : 'customer', phone: t.u_phone })));
});

admin.get('/support/threads/:id', requirePerm('support'), (c) => {
  const t = get<any>('SELECT * FROM threads WHERE id = ?', Number(c.req.param('id')));
  if (!t) throw new ApiError(404, 'thread_not_found');
  run('UPDATE threads SET unread_operator = 0 WHERE id = ?', t.id);
  return c.json({ thread: threadRow(t, true), messages: all('SELECT * FROM messages WHERE thread_id = ? ORDER BY id', t.id).map(messageRow) });
});

admin.post('/support/threads/:id/messages', requirePerm('support'), async (c) => {
  const t = get<any>('SELECT * FROM threads WHERE id = ?', Number(c.req.param('id')));
  if (!t) throw new ApiError(404, 'thread_not_found');
  const b = await body<{ text: string }>(c);
  if (!b.text?.trim()) throw new ApiError(400, 'text_required');
  addMessage(t.id, 'operator', c.get('adminName'), b.text.trim());
  run('UPDATE threads SET unread_operator = 0 WHERE id = ?', t.id);
  if (t.user_id) notify('customer', t.user_id, tr(userLang(t.user_id), 'supportReply'), b.text.slice(0, 120), `/support/${t.id}`);
  if (t.supplier_id) notify('supplier', t.supplier_id, 'Ответ поддержки', b.text.slice(0, 120), `/support/${t.id}`);
  return c.json({ ok: true });
});

admin.post('/support/threads/:id/status', requirePerm('support'), async (c) => {
  const b = await body<{ status: 'open' | 'closed' }>(c);
  run('UPDATE threads SET status = ? WHERE id = ?', b.status, Number(c.req.param('id')));
  return c.json({ ok: true });
});

// ---------- settings & integrations ----------

admin.get('/settings', requirePerm('settings'), (c) => c.json(getSettings()));
admin.put('/settings', requirePerm('settings'), async (c) => c.json(saveSettings(await body(c))));

admin.get('/integrations', requirePerm('settings'), (c) => c.json(integrationsForAdmin()));
admin.put('/integrations/:id', requirePerm('settings'), async (c) => {
  const id = c.req.param('id');
  if (!INTEGRATIONS.find((d) => d.id === id)) throw new ApiError(404, 'unknown_integration');
  saveIntegration(id, await body(c));
  return c.json(integrationsForAdmin());
});
admin.get('/integrations/log', requirePerm('settings'), (c) => c.json(all('SELECT * FROM integration_log ORDER BY id DESC LIMIT 100')));

// ---------- staff ----------

admin.get('/staff', requirePerm('staff'), (c) => c.json(all('SELECT * FROM admin_users ORDER BY id').map(adminRow)));
admin.post('/staff', requirePerm('staff'), async (c) => {
  const b = await body<any>(c);
  if (!b.email || !b.password || b.password.length < 6) throw new ApiError(400, 'email_password_required');
  if (b.role === 'owner') throw new ApiError(400, 'cannot_create_owner');
  try {
    run(
      'INSERT INTO admin_users(name, email, password_hash, role, permissions, created_at) VALUES(?,?,?,?,?,?)',
      b.name ?? b.email,
      b.email.trim(),
      hashPassword(b.password),
      b.role ?? 'custom',
      JSON.stringify((b.permissions ?? []).filter((p: string) => (ADMIN_PERMISSIONS as readonly string[]).includes(p))),
      nowIso(),
    );
  } catch {
    throw new ApiError(409, 'email_exists');
  }
  return c.json({ ok: true });
});
admin.patch('/staff/:id', requirePerm('staff'), async (c) => {
  const id = Number(c.req.param('id'));
  const a = get<any>('SELECT * FROM admin_users WHERE id = ?', id);
  if (!a) throw new ApiError(404, 'not_found');
  const b = await body<any>(c);
  if (a.role === 'owner' && (b.active === false || b.role)) throw new ApiError(400, 'cannot_edit_owner');
  if (b.name) run('UPDATE admin_users SET name = ? WHERE id = ?', b.name, id);
  if (b.role) run('UPDATE admin_users SET role = ? WHERE id = ?', b.role, id);
  if (Array.isArray(b.permissions)) run('UPDATE admin_users SET permissions = ? WHERE id = ?', JSON.stringify(b.permissions), id);
  if (typeof b.active === 'boolean') {
    run('UPDATE admin_users SET active = ? WHERE id = ?', b.active ? 1 : 0, id);
    if (!b.active) run("DELETE FROM sessions WHERE kind = 'admin' AND subject_id = ?", id);
  }
  if (b.password) run('UPDATE admin_users SET password_hash = ? WHERE id = ?', hashPassword(b.password), id);
  return c.json({ ok: true });
});

// ---------- reports ----------

function financeReport(from: string, to: string) {
  const rows = all<any>(
    `SELECT s.id, s.name, COUNT(so.id) AS orders, COALESCE(SUM(so.subtotal),0) AS revenue, COALESCE(SUM(so.commission),0) AS commission,
       COALESCE(SUM(so.delivery_fee),0) AS delivery, COALESCE(SUM(so.promo_discount - so.supplier_funded_discount),0) AS platform_discounts,
       COALESCE(SUM(so.delivery_paid_by_platform),0) AS platform_delivery
     FROM suppliers s JOIN sub_orders so ON so.supplier_id = s.id
     WHERE so.status = 'delivered' AND so.created_at >= ? AND so.created_at < ? GROUP BY s.id ORDER BY revenue DESC`,
    from,
    to,
  );
  const services = all<any>(
    `SELECT s.name, -SUM(l.amount) AS total FROM ledger l JOIN suppliers s ON s.id = l.supplier_id
     WHERE l.type IN ('promotion','service') AND l.created_at >= ? AND l.created_at < ? GROUP BY s.id`,
    from,
    to,
  );
  const coins = get<any>("SELECT COALESCE(SUM(coins_used),0) AS n FROM orders WHERE status = 'completed' AND created_at >= ? AND created_at < ?", from, to)?.n ?? 0;
  const totals = rows.reduce(
    (a, r) => ({
      revenue: a.revenue + r.revenue,
      commission: a.commission + r.commission,
      orders: a.orders + r.orders,
      platformDiscounts: a.platformDiscounts + r.platform_discounts,
      platformDelivery: a.platformDelivery + r.platform_delivery,
    }),
    { revenue: 0, commission: 0, orders: 0, platformDiscounts: 0, platformDelivery: 0 },
  );
  const servicesTotal = services.reduce((a, r) => a + r.total, 0);
  return {
    from,
    to,
    bySupplier: rows,
    services,
    totals: { ...totals, services: servicesTotal, coins, net: totals.commission + servicesTotal - totals.platformDiscounts - totals.platformDelivery - coins },
  };
}

admin.get('/reports/finance', requirePerm('reports'), (c) => {
  const from = c.req.query('from') ?? new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const to = c.req.query('to') ?? new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
  return c.json(financeReport(from, to));
});

admin.get('/reports/finance.csv', requirePerm('reports'), (c) => {
  const from = c.req.query('from') ?? new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const to = c.req.query('to') ?? new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
  const r = financeReport(from, to);
  const lines = ['Поставщик;Заказов;Выручка;Комиссия;Доставка;Скидки за счёт площадки'];
  for (const x of r.bySupplier) lines.push([x.name, x.orders, x.revenue, x.commission, x.delivery, x.platform_discounts].join(';'));
  lines.push('', `Итого комиссия;${r.totals.commission}`, `Услуги продвижения;${r.totals.services}`, `Монеты;${r.totals.coins}`, `Чистый доход;${r.totals.net}`);
  c.header('content-type', 'text/csv; charset=utf-8');
  c.header('content-disposition', `attachment; filename="taptym-finance-${from}_${to}.csv"`);
  return c.body('\ufeff' + lines.join('\n'));
});
