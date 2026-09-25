import {
  calcCommission,
  coinsEarned,
  formatPrice,
  maxCoinsUsable,
  quoteDelivery,
  type CartLine,
  type CheckoutQuote,
  type CheckoutRequest,
  type DeliveryMethod,
  type Order,
  type PaymentMethod,
  type QuoteGroup,
  type SubOrder,
  type SubOrderStatus,
} from '@taptym/shared';
import { all, get, json, nowIso, run, tx } from '../db.ts';
import { getSettings } from '../settings.ts';
import { bankDeepLinks, createPayment, fiscalizeReceipt, qrDataUrl, yandexCreateClaim } from '../integrations.ts';
import { supplierPublic, invalidateCatalog } from './catalog.ts';
import { notify } from './notify.ts';
import { statusWord, tr, userLang } from './texts.ts';
import { supplierBalance } from './finance.ts';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface LineRow {
  offer_id: number;
  product_id: number;
  supplier_id: number;
  price: number;
  stock: number;
  title: string;
  emoji: string;
  color: string;
  images: string;
  s: any;
}

function loadLines(lines: CartLine[]) {
  const clean = lines.filter((l) => l.qty > 0);
  if (!clean.length) return [];
  const rows = all<any>(
    `SELECT o.id AS offer_id, o.product_id, o.supplier_id, o.price, o.stock, o.active,
       p.title, p.emoji, p.color, p.images, p.hidden,
       s.id AS s_id, s.name AS s_name, s.logo_emoji, s.color AS s_color, s.address, s.rating, s.own_delivery,
       s.own_delivery_fee, s.own_free_from, s.lat, s.lng, s.status AS s_status, s.accepts_cash, s.created_at AS s_created,
       s.trial_until
     FROM offers o JOIN products p ON p.id = o.product_id JOIN suppliers s ON s.id = o.supplier_id
     WHERE o.id IN (${clean.map(() => '?').join(',')})`,
    ...clean.map((l) => l.offerId),
  );
  const byId = new Map(rows.map((r) => [r.offer_id, r]));
  return clean
    .map((l) => ({ line: l, row: byId.get(l.offerId) }))
    .filter((x) => x.row && x.row.active && !x.row.hidden && x.row.s_status === 'active') as { line: CartLine; row: any }[];
}

function isFirstOrder(userId: number | null) {
  if (!userId) return true;
  return (get<{ n: number }>("SELECT COUNT(*) AS n FROM orders WHERE user_id = ? AND status != 'cancelled'", userId)?.n ?? 0) === 0;
}

interface PromoRow {
  id: number;
  code: string;
  type: 'percent' | 'fixed' | 'free_delivery';
  value: number;
  min_total: number;
  max_uses: number;
  used: number;
  per_user: number;
  supplier_id: number | null;
  funded_by: 'platform' | 'supplier' | 'shared';
}

function findPromo(code: string | null, userId: number | null): { promo: PromoRow | null; error: string | null } {
  if (!code) return { promo: null, error: null };
  const p = get<any>('SELECT * FROM promo_codes WHERE UPPER(code) = UPPER(?)', code.trim());
  if (!p || p.status !== 'active') return { promo: null, error: 'promo_not_found' };
  const now = nowIso();
  if ((p.starts_at && p.starts_at > now) || (p.ends_at && p.ends_at < now)) return { promo: null, error: 'promo_expired' };
  if (p.max_uses > 0 && p.used >= p.max_uses) return { promo: null, error: 'promo_exhausted' };
  if (userId && p.per_user > 0) {
    const n = get<{ n: number }>('SELECT COUNT(*) AS n FROM promo_uses WHERE promo_id = ? AND user_id = ?', p.id, userId)?.n ?? 0;
    if (n >= p.per_user) return { promo: null, error: 'promo_used' };
  }
  return { promo: p, error: null };
}

export interface QuoteInternal extends CheckoutQuote {
  promo: PromoRow | null;
  groupMeta: {
    supplierId: number;
    trial: boolean;
    promoDiscount: number;
    supplierFunded: number;
    platformPaidDelivery: number;
    coinsShare: number;
    commission: number;
  }[];
  address: { line: string; lat: number; lng: number } | null;
}

export async function buildQuote(userId: number | null, req: Partial<CheckoutRequest>, withAlternative = true): Promise<QuoteInternal> {
  const settings = getSettings();
  const loaded = loadLines(req.lines ?? []);
  const address =
    userId && req.addressId
      ? (get<any>('SELECT line, lat, lng FROM addresses WHERE id = ? AND user_id = ?', req.addressId, userId) ?? null)
      : null;
  const user = userId ? get<any>('SELECT coins FROM users WHERE id = ?', userId) : null;
  const first = isFirstOrder(userId);

  const groupsMap = new Map<number, { s: any; lines: { line: CartLine; row: any }[] }>();
  for (const x of loaded) {
    const g = groupsMap.get(x.row.supplier_id) ?? { s: x.row, lines: [] };
    g.lines.push(x);
    groupsMap.set(x.row.supplier_id, g);
  }

  const groups: QuoteGroup[] = [];
  const meta: QuoteInternal['groupMeta'] = [];
  let freeFirstUsed = false;
  for (const [supplierId, g] of groupsMap) {
    const s = g.s;
    const lines = g.lines.map(({ line, row }) => {
      const images = json<string[]>(row.images, []);
      return {
        offerId: row.offer_id,
        productId: row.product_id,
        title: row.title,
        emoji: row.emoji,
        color: row.color,
        image: images[0] ?? null,
        price: row.price,
        qty: line.qty,
        total: row.price * line.qty,
        stock: row.stock,
      };
    });
    const subtotal = lines.reduce((a, l) => a + l.total, 0);
    const itemsCount = lines.reduce((a, l) => a + l.qty, 0);
    const info = {
      ownDelivery: !!s.own_delivery,
      ownDeliveryFee: s.own_delivery_fee,
      ownFreeFrom: s.own_free_from,
      location: { lat: s.lat, lng: s.lng },
    };
    const methods: DeliveryMethod[] = ['courier', 'supplier', 'yandex', 'pickup'];
    const options = methods.map((m) => {
      const q = quoteDelivery(settings, m, info, address, subtotal, itemsCount);
      return { method: m, fee: q.fee, available: q.available, etaText: q.etaText, distanceKm: q.distanceKm, vehicle: q.vehicle };
    });
    const requested = req.groups?.find((x) => x.supplierId === supplierId)?.deliveryMethod;
    const avail = options.filter((o) => o.available && o.method !== 'pickup');
    const chosen =
      options.find((o) => o.method === requested && o.available) ??
      avail.sort((a, b) => a.fee - b.fee)[0] ??
      options.find((o) => o.method === 'pickup')!;
    let fee = chosen.fee;
    let platformPaid = 0;
    if (chosen.method === 'courier' && first && settings.freeFirstCourierDelivery && !freeFirstUsed && fee > 0) {
      platformPaid = fee;
      fee = 0;
      freeFirstUsed = true;
      const opt = options.find((o) => o.method === 'courier');
      if (opt) opt.fee = 0;
    }
    const trial = !!s.trial_until && s.trial_until > nowIso();
    groups.push({
      supplier: supplierPublic({ ...s, id: supplierId, name: s.s_name, color: s.s_color, created_at: s.s_created }),
      lines,
      subtotal,
      deliveryOptions: options,
      deliveryMethod: chosen.method,
      deliveryFee: fee,
    });
    meta.push({ supplierId, trial, promoDiscount: 0, supplierFunded: 0, platformPaidDelivery: platformPaid, coinsShare: 0, commission: 0 });
  }

  const itemsTotal = groups.reduce((a, g) => a + g.subtotal, 0);
  let deliveryTotal = groups.reduce((a, g) => a + g.deliveryFee, 0);

  // Promo code
  let { promo, error: promoError } = findPromo(req.promoCode ?? null, userId);
  let promoDiscount = 0;
  if (promo) {
    const eligible = groups.map((g, i) => ({ g, i })).filter(({ g }) => !promo!.supplier_id || g.supplier.id === promo!.supplier_id);
    const base = eligible.reduce((a, x) => a + x.g.subtotal, 0);
    if (!eligible.length) {
      promoError = 'promo_wrong_supplier';
      promo = null;
    } else if (base < promo.min_total) {
      promoError = 'promo_min_total';
      promo = null;
    } else if (promo.type === 'free_delivery') {
      for (const { g, i } of eligible) {
        meta[i].promoDiscount += g.deliveryFee;
        promoDiscount += g.deliveryFee;
      }
    } else {
      const total = promo.type === 'percent' ? Math.round((base * promo.value) / 100) : Math.min(promo.value, base);
      let left = total;
      eligible.forEach(({ g, i }, idx) => {
        const share = idx === eligible.length - 1 ? left : Math.round((total * g.subtotal) / base);
        left -= share;
        meta[i].promoDiscount += share;
        const supplierPart = promo!.funded_by === 'supplier' ? share : promo!.funded_by === 'shared' ? Math.round(share / 2) : 0;
        meta[i].supplierFunded += supplierPart;
      });
      promoDiscount = total;
    }
  }

  // Coins
  const balance = user?.coins ?? 0;
  const coinsMax = maxCoinsUsable(settings, Math.max(0, itemsTotal - promoDiscount), balance);
  const coinsUsed = Math.max(0, Math.min(Math.floor(req.coinsToUse ?? 0), coinsMax));
  const coinsMoney = coinsUsed * settings.coinValue;
  if (coinsMoney > 0 && itemsTotal > 0) {
    let left = coinsMoney;
    groups.forEach((g, i) => {
      const share = i === groups.length - 1 ? left : Math.round((coinsMoney * g.subtotal) / itemsTotal);
      left -= share;
      meta[i].coinsShare = share;
    });
  }
  groups.forEach((g, i) => {
    meta[i].commission = calcCommission(settings, g.subtotal - meta[i].supplierFunded, meta[i].trial);
  });

  const total = Math.max(0, itemsTotal + deliveryTotal - promoDiscount - coinsMoney);

  // Savings vs most expensive offers, plus a cheaper swap suggestion
  let savingsVsMax = 0;
  const altLines: CartLine[] = [];
  let altDiffers = false;
  for (const { line, row } of loaded) {
    const offers = all<any>(
      `SELECT o.id, o.price, o.stock FROM offers o JOIN suppliers s ON s.id = o.supplier_id AND s.status = 'active'
       WHERE o.product_id = ? AND o.active = 1`,
      row.product_id,
    );
    const max = Math.max(...offers.map((o) => o.price));
    savingsVsMax += (max - row.price) * line.qty;
    const cheapest = offers.filter((o) => o.stock >= line.qty).sort((a, b) => a.price - b.price)[0];
    if (cheapest && cheapest.price < row.price) {
      altDiffers = true;
      altLines.push({ offerId: cheapest.id, qty: line.qty });
    } else altLines.push(line);
  }
  // Compare full totals (items + delivery): switching stores also changes delivery fees.
  let cheaperAlternative: CheckoutQuote['cheaperAlternative'] = null;
  if (withAlternative && altDiffers) {
    const merged = new Map<number, number>();
    for (const l of altLines) merged.set(l.offerId, (merged.get(l.offerId) ?? 0) + l.qty);
    const lines = [...merged].map(([offerId, qty]) => ({ offerId, qty }));
    const alt = await buildQuote(userId, { lines, addressId: req.addressId, groups: req.groups }, false);
    const saving = itemsTotal + deliveryTotal - (alt.itemsTotal + alt.deliveryTotal);
    if (saving > 0) cheaperAlternative = { saving, lines };
  }

  const cashAllowed = groups.every((g) => {
    const s = groupsMap.get(g.supplier.id)!.s;
    const collectsCash = g.deliveryMethod === 'supplier' || g.deliveryMethod === 'pickup';
    if (!collectsCash) return true;
    return !!s.accepts_cash && supplierBalance(g.supplier.id) > -settings.cashDebtLimit;
  });

  return {
    groups,
    itemsTotal,
    deliveryTotal,
    promoDiscount,
    promoError,
    coinsAvailable: balance,
    coinsMax,
    coinsUsed,
    total,
    coinsToEarn: coinsEarned(settings, Math.max(0, itemsTotal - promoDiscount - coinsMoney)),
    savingsVsMax,
    cheaperAlternative,
    cashAllowed,
    freeFirstDelivery: meta.some((m) => m.platformPaidDelivery > 0),
    isFirstOrder: first,
    promo,
    groupMeta: meta,
    address,
  };
}

function newOrderNumber() {
  const n = (get<{ n: number }>('SELECT COUNT(*) AS n FROM orders')?.n ?? 0) + 10001;
  return `T-${n}`;
}

export const VISIBLE_PAYMENT = `('paid','cash_on_delivery','awaiting_invoice')`;

export async function placeOrder(userId: number, req: CheckoutRequest, baseUrl: string) {
  const user = get<any>('SELECT * FROM users WHERE id = ?', userId);
  if (!user || user.banned) throw new ApiError(403, 'user_blocked');
  if (!req.lines?.length) throw new ApiError(400, 'cart_empty');
  const q = await buildQuote(userId, req);
  if (!q.groups.length) throw new ApiError(400, 'cart_empty');
  if (q.promoError && req.promoCode) throw new ApiError(400, q.promoError);
  if (!q.address) throw new ApiError(400, 'address_required');
  for (const g of q.groups) for (const l of g.lines) if (l.qty > l.stock) throw new ApiError(409, `out_of_stock:${l.title}`);

  let method: PaymentMethod = req.paymentMethod;
  if (method === 'cash' && !q.cashAllowed) throw new ApiError(400, 'cash_not_allowed');
  if (method === 'invoice' && !user.is_company) throw new ApiError(400, 'invoice_company_only');
  if (q.total === 0) method = 'coins_only';
  const paymentStatus =
    method === 'cash' ? 'cash_on_delivery' : method === 'invoice' ? 'awaiting_invoice' : method === 'coins_only' ? 'paid' : 'pending';

  const now = nowIso();
  const number = newOrderNumber();
  const orderId = tx(() => {
    const { lastInsertRowid: oid } = run(
      `INSERT INTO orders(number, user_id, status, payment_method, payment_status, items_total, delivery_total, promo_code,
        promo_discount, coins_used, coins_to_earn, total, address, lat, lng, comment, created_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      number,
      userId,
      'placed',
      method,
      paymentStatus,
      q.itemsTotal,
      q.deliveryTotal,
      q.promo?.code ?? null,
      q.promoDiscount,
      q.coinsUsed,
      q.coinsToEarn,
      q.total,
      q.address!.line,
      q.address!.lat,
      q.address!.lng,
      req.comment ?? '',
      now,
    );
    q.groups.forEach((g, i) => {
      const m = q.groupMeta[i];
      const history = JSON.stringify([{ status: 'new', at: now, by: 'customer' }]);
      const opt = g.deliveryOptions.find((o) => o.method === g.deliveryMethod)!;
      const { lastInsertRowid: sid } = run(
        `INSERT INTO sub_orders(order_id, supplier_id, status, delivery_method, delivery_fee, delivery_paid_by_platform, distance_km,
          subtotal, commission, promo_discount, supplier_funded_discount, coins_share, history, created_at, updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        oid,
        g.supplier.id,
        'new',
        g.deliveryMethod,
        g.deliveryFee,
        m.platformPaidDelivery,
        opt.distanceKm,
        g.subtotal,
        m.commission,
        m.promoDiscount,
        m.supplierFunded,
        m.coinsShare,
        history,
        now,
        now,
      );
      for (const l of g.lines) {
        run(
          'INSERT INTO order_items(sub_order_id, offer_id, product_id, title, emoji, color, image, price, qty) VALUES(?,?,?,?,?,?,?,?,?)',
          sid,
          l.offerId,
          l.productId,
          l.title,
          l.emoji,
          l.color,
          l.image,
          l.price,
          l.qty,
        );
        run('UPDATE offers SET stock = MAX(0, stock - ?) WHERE id = ?', l.qty, l.offerId);
      }
    });
    if (q.promo) {
      run('UPDATE promo_codes SET used = used + 1 WHERE id = ?', q.promo.id);
      run('INSERT INTO promo_uses(promo_id, user_id, order_id, created_at) VALUES(?,?,?,?)', q.promo.id, userId, oid, now);
    }
    if (q.coinsUsed > 0) {
      run('UPDATE users SET coins = coins - ? WHERE id = ?', q.coinsUsed, userId);
      run('INSERT INTO coin_tx(user_id, amount, reason, order_id, created_at) VALUES(?,?,?,?,?)', userId, -q.coinsUsed, 'order_payment', oid, now);
    }
    return oid;
  });
  invalidateCatalog();

  if (method === 'qr' || method === 'card') {
    const p = await createPayment(orderId, number, q.total, baseUrl);
    run(
      'INSERT INTO payments(id, order_id, amount, method, provider, status, external_id, qr_payload, demo, created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
      p.id,
      orderId,
      q.total,
      method,
      p.provider,
      'pending',
      p.externalId,
      p.qrPayload,
      p.demo ? 1 : 0,
      now,
    );
  } else {
    announceOrder(orderId);
  }
  return getOrder(orderId, userId)!;
}

/** Suppliers and operators learn about an order only once it is paid or payable on delivery. */
function announceOrder(orderId: number) {
  const o = get<any>('SELECT * FROM orders WHERE id = ?', orderId);
  const subs = all<any>('SELECT * FROM sub_orders WHERE order_id = ?', orderId);
  for (const s of subs) {
    notify('supplier', s.supplier_id, `Новый заказ ${o.number}`, `Сумма ${formatPrice(s.subtotal)}. Подтвердите заказ.`, `/orders/${s.id}`);
  }
  notify('admin', null, `Новый заказ ${o.number}`, `${subs.length} пост. · ${formatPrice(o.total)} · ${o.payment_method}`, `/orders/${orderId}`);
}

export async function markPaid(orderId: number, source: string) {
  const o = get<any>('SELECT * FROM orders WHERE id = ?', orderId);
  if (!o) throw new ApiError(404, 'order_not_found');
  if (o.payment_status === 'paid') return;
  run("UPDATE orders SET payment_status = 'paid' WHERE id = ?", orderId);
  run("UPDATE payments SET status = 'paid', paid_at = ? WHERE order_id = ? AND status = 'pending'", nowIso(), orderId);
  const lang = userLang(o.user_id);
  notify('customer', o.user_id, tr(lang, 'paidTitle'), tr(lang, 'paidBody', { n: o.number }), `/orders/${orderId}`);
  const items = all<any>('SELECT oi.* FROM order_items oi JOIN sub_orders s ON s.id = oi.sub_order_id WHERE s.order_id = ?', orderId);
  void fiscalizeReceipt(o.number, items.map((i) => ({ title: i.title, price: i.price, qty: i.qty })), o.total);
  if (o.payment_status !== 'awaiting_invoice') announceOrder(orderId);
  void source;
}

const TRANSITIONS: Record<SubOrderStatus, SubOrderStatus[]> = {
  new: ['confirmed', 'rejected', 'cancelled'],
  confirmed: ['assembling', 'ready', 'cancelled'],
  assembling: ['ready', 'cancelled'],
  ready: ['in_delivery', 'delivered', 'cancelled'],
  in_delivery: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
  rejected: [],
};

export function allowedNext(status: SubOrderStatus) {
  return TRANSITIONS[status];
}

const STATUS_TEXT: Record<SubOrderStatus, string> = {
  new: 'принят',
  confirmed: 'подтверждён поставщиком',
  assembling: 'собирается',
  ready: 'готов к отправке',
  in_delivery: 'в пути',
  delivered: 'доставлен',
  cancelled: 'отменён',
  rejected: 'отклонён поставщиком',
};

export async function changeSubOrderStatus(subId: number, next: SubOrderStatus, by: string, force = false, reason = '') {
  const s = get<any>('SELECT * FROM sub_orders WHERE id = ?', subId);
  if (!s) throw new ApiError(404, 'sub_order_not_found');
  if (s.status === next) return;
  if (!force && !TRANSITIONS[s.status as SubOrderStatus].includes(next)) throw new ApiError(400, `bad_transition:${s.status}->${next}`);
  const o = get<any>('SELECT * FROM orders WHERE id = ?', s.order_id);
  const now = nowIso();
  const history = json<any[]>(s.history, []);
  history.push({ status: next, at: now, by: reason ? `${by}: ${reason}` : by, ...(reason ? { reason } : {}) });
  tx(() => {
    run('UPDATE sub_orders SET status = ?, history = ?, updated_at = ? WHERE id = ?', next, JSON.stringify(history), now, subId);
    if (next === 'delivered') settleSubOrder(subId);
    if (next === 'cancelled' || next === 'rejected') {
      for (const it of all<any>('SELECT * FROM order_items WHERE sub_order_id = ?', subId)) {
        run('UPDATE offers SET stock = stock + ? WHERE id = ?', it.qty, it.offer_id);
      }
      if (s.coins_share > 0) {
        const coins = Math.round(s.coins_share / getSettings().coinValue);
        run('UPDATE users SET coins = coins + ? WHERE id = ?', coins, o.user_id);
        run('INSERT INTO coin_tx(user_id, amount, reason, order_id, created_at) VALUES(?,?,?,?,?)', o.user_id, coins, 'refund', o.id, now);
      }
    }
    refreshOrderStatus(s.order_id);
  });
  invalidateCatalog();
  if (next === 'in_delivery' && s.delivery_method === 'yandex') {
    void yandexCreateClaim(subId, { order: o.number, address: o.address });
  }
  const sup = get<any>('SELECT name FROM suppliers WHERE id = ?', s.supplier_id);
  const lang = userLang(o.user_id);
  notify(
    'customer',
    o.user_id,
    tr(lang, 'orderStatus', { n: o.number, status: statusWord(lang, next) }),
    `${sup?.name ?? ''}${reason ? ': ' + reason : ''}`,
    `/orders/${o.id}`,
  );
  if (next === 'rejected' || next === 'cancelled') {
    notify('admin', null, `Заказ ${o.number}: ${STATUS_TEXT[next]}`, `${sup?.name ?? ''} ${reason}`.trim(), `/orders/${o.id}`);
  }
}

function settleSubOrder(subId: number) {
  const s = get<any>('SELECT * FROM sub_orders WHERE id = ?', subId);
  if (!s || s.settled) return;
  const o = get<any>('SELECT * FROM orders WHERE id = ?', s.order_id);
  const now = nowIso();
  const add = (type: string, amount: number, note: string) => {
    if (amount === 0) return;
    run(
      'INSERT INTO ledger(supplier_id, type, amount, note, sub_order_id, created_at) VALUES(?,?,?,?,?,?)',
      s.supplier_id,
      type,
      amount,
      note,
      subId,
      now,
    );
  };
  add('sale', s.subtotal, `Продажа · заказ ${o.number}`);
  if (s.delivery_method === 'supplier') add('sale', s.delivery_fee, `Доставка · заказ ${o.number}`);
  add('promo_discount', -s.supplier_funded_discount, `Скидка по промокоду · ${o.number}`);
  add('commission', -s.commission, `Комиссия ${getSettings().commissionPercent}% · ${o.number}`);
  const supplierCollects = s.delivery_method === 'supplier' || s.delivery_method === 'pickup';
  if (o.payment_method === 'cash' && supplierCollects) {
    const cash = s.subtotal - s.promo_discount - s.coins_share + (s.delivery_method === 'supplier' ? s.delivery_fee : 0);
    add('cash_collected', -cash, `Наличные получены поставщиком · ${o.number}`);
  }
  run('UPDATE sub_orders SET settled = 1 WHERE id = ?', subId);
}

function refreshOrderStatus(orderId: number) {
  const subs = all<any>('SELECT status, subtotal, promo_discount, coins_share FROM sub_orders WHERE order_id = ?', orderId);
  const o = get<any>('SELECT * FROM orders WHERE id = ?', orderId);
  const done = subs.every((s) => ['delivered', 'cancelled', 'rejected'].includes(s.status));
  const anyDelivered = subs.some((s) => s.status === 'delivered');
  let status = 'placed';
  if (done) status = anyDelivered ? 'completed' : 'cancelled';
  else if (subs.some((s) => s.status !== 'new')) status = 'in_progress';
  run('UPDATE orders SET status = ? WHERE id = ?', status, orderId);

  if (status === 'completed' && !o.coins_earned) {
    const settings = getSettings();
    const paid = subs.filter((s) => s.status === 'delivered').reduce((a, s) => a + s.subtotal - s.promo_discount - s.coins_share, 0);
    const coins = coinsEarned(settings, paid);
    const now = nowIso();
    if (coins > 0) {
      run('UPDATE orders SET coins_earned = ? WHERE id = ?', coins, orderId);
      run('UPDATE users SET coins = coins + ? WHERE id = ?', coins, o.user_id);
      run('INSERT INTO coin_tx(user_id, amount, reason, order_id, created_at) VALUES(?,?,?,?,?)', o.user_id, coins, 'cashback', orderId, now);
      const lang = userLang(o.user_id);
      notify('customer', o.user_id, tr(lang, 'coinsTitle', { c: coins }), tr(lang, 'cashbackBody', { n: o.number }), '/coins');
    }
    const u = get<any>('SELECT * FROM users WHERE id = ?', o.user_id);
    if (u.referred_by && !u.referral_rewarded) {
      run('UPDATE users SET referral_rewarded = 1, coins = coins WHERE id = ?', u.id);
      run('UPDATE users SET coins = coins + ? WHERE id = ?', settings.referralBonusCoins, u.referred_by);
      run('INSERT INTO coin_tx(user_id, amount, reason, order_id, created_at) VALUES(?,?,?,?,?)', u.referred_by, settings.referralBonusCoins, 'referral', orderId, now);
      const refLang = userLang(u.referred_by);
      notify('customer', u.referred_by, tr(refLang, 'referralTitle', { c: settings.referralBonusCoins }), tr(refLang, 'referralBody'), '/coins');
    }
  }
}

export function cancelOrderByCustomer(orderId: number, userId: number) {
  const o = get<any>('SELECT * FROM orders WHERE id = ? AND user_id = ?', orderId, userId);
  if (!o) throw new ApiError(404, 'order_not_found');
  const subs = all<any>('SELECT * FROM sub_orders WHERE order_id = ?', orderId);
  if (subs.some((s) => !['new', 'confirmed'].includes(s.status))) throw new ApiError(400, 'cannot_cancel');
  return Promise.all(subs.map((s) => changeSubOrderStatus(s.id, 'cancelled', 'Клиент'))).then(() => {
    if (o.payment_status === 'paid') run("UPDATE orders SET payment_status = 'refunded' WHERE id = ?", orderId);
    if (o.payment_status === 'pending') run("UPDATE payments SET status = 'failed' WHERE order_id = ?", orderId);
  });
}

// ---------- read models ----------

export function subOrderRow(s: any, withCustomer = false): SubOrder {
  const items = all<any>('SELECT * FROM order_items WHERE sub_order_id = ?', s.id).map((i) => ({
    productId: i.product_id,
    offerId: i.offer_id,
    title: i.title,
    emoji: i.emoji,
    color: i.color,
    image: i.image,
    price: i.price,
    qty: i.qty,
  }));
  const sup = get<any>('SELECT * FROM suppliers WHERE id = ?', s.supplier_id);
  const o = get<any>('SELECT * FROM orders WHERE id = ?', s.order_id);
  const out: SubOrder = {
    id: s.id,
    orderId: s.order_id,
    orderNumber: o.number,
    supplier: supplierPublic(sup),
    status: s.status,
    deliveryMethod: s.delivery_method,
    deliveryFee: s.delivery_fee,
    distanceKm: s.distance_km,
    subtotal: s.subtotal,
    commission: s.commission,
    promoDiscount: s.promo_discount,
    items,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    history: json(s.history, []),
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status,
    comment: o.comment,
  };
  if (withCustomer) {
    const u = get<any>('SELECT * FROM users WHERE id = ?', o.user_id);
    out.customer = {
      name: u.name || 'Клиент',
      phone: u.phone,
      address: o.address,
      isCompany: !!u.is_company,
      companyName: u.company_name,
    };
  }
  return out;
}

export async function paymentSession(orderId: number) {
  const p = get<any>('SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1', orderId);
  const o = get<any>('SELECT * FROM orders WHERE id = ?', orderId);
  if (o?.payment_method === 'invoice') {
    return {
      id: 'invoice',
      orderId,
      amount: o.total,
      method: 'invoice' as const,
      provider: 'invoice',
      status: o.payment_status === 'paid' ? ('paid' as const) : ('pending' as const),
      qrDataUrl: null,
      deepLinks: [],
      demo: true,
      invoiceUrl: `/api/c/orders/${orderId}/invoice`,
    };
  }
  if (!p) return null;
  return {
    id: p.id,
    orderId,
    amount: p.amount,
    method: p.method,
    provider: p.provider,
    status: p.status,
    qrDataUrl: p.qr_payload ? await qrDataUrl(p.qr_payload) : null,
    deepLinks: p.qr_payload ? bankDeepLinks(p.qr_payload) : [],
    demo: !!p.demo,
    invoiceUrl: null,
  };
}

export function getOrder(orderId: number, userId?: number): Order | null {
  const o = userId
    ? get<any>('SELECT * FROM orders WHERE id = ? AND user_id = ?', orderId, userId)
    : get<any>('SELECT * FROM orders WHERE id = ?', orderId);
  if (!o) return null;
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status,
    itemsTotal: o.items_total,
    deliveryTotal: o.delivery_total,
    promoDiscount: o.promo_discount,
    coinsUsed: o.coins_used,
    total: o.total,
    coinsEarned: o.coins_earned || o.coins_to_earn,
    address: o.address,
    comment: o.comment,
    createdAt: o.created_at,
    subOrders: all<any>('SELECT * FROM sub_orders WHERE order_id = ? ORDER BY id', orderId).map((s) => subOrderRow(s)),
  };
}
