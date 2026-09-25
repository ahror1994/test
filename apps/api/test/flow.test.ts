import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Isolated database per run; must be set before the app modules load.
const dir = mkdtempSync(join(tmpdir(), 'taptym-test-'));
process.env.DB_PATH = join(dir, 'test.db');
process.env.UPLOAD_DIR = join(dir, 'uploads');

const { get, run, all } = await import('../src/db.ts');
const { seedDemo } = await import('../src/seed.ts');
const { buildQuote, placeOrder, changeSubOrderStatus, markPaid } = await import('../src/services/orders.ts');
const { breakdown } = await import('../src/services/finance.ts');
const { saveSettings } = await import('../src/settings.ts');

let userId: number;
let addressId: number;

before(() => {
  seedDemo();
  const u = get<any>("SELECT id FROM users WHERE phone = '+996700111222'");
  userId = u.id;
  addressId = get<any>('SELECT id FROM addresses WHERE user_id = ?', userId).id;
});

function offerOf(supplierId: number) {
  return get<any>('SELECT * FROM offers WHERE supplier_id = ? AND stock > 5 AND active = 1 ORDER BY price DESC LIMIT 1', supplierId);
}

function endTrial(supplierId: number) {
  run('UPDATE suppliers SET trial_until = ? WHERE id = ?', new Date(Date.now() - 86400_000).toISOString(), supplierId);
}

test('quote splits the cart by supplier and applies commission rules', async () => {
  const a = offerOf(1);
  const b = offerOf(3);
  const q = await buildQuote(userId, { lines: [{ offerId: a.id, qty: 2 }, { offerId: b.id, qty: 1 }], addressId });
  assert.equal(q.groups.length, 2);
  assert.equal(q.itemsTotal, a.price * 2 + b.price);
  assert.equal(q.total, q.itemsTotal + q.deliveryTotal);
});

test('cash order delivered by the supplier: supplier owes only the commission', async () => {
  saveSettings({ commissionPercent: 10 });
  endTrial(1);
  run("UPDATE suppliers SET own_delivery = 1, own_delivery_fee = 100, own_free_from = 0, accepts_cash = 1 WHERE id = 1");
  const before = breakdown(1).available;
  const offer = offerOf(1);
  const order = await placeOrder(
    userId,
    { lines: [{ offerId: offer.id, qty: 1 }], groups: [{ supplierId: 1, deliveryMethod: 'supplier' }], addressId, paymentMethod: 'cash', promoCode: null, coinsToUse: 0, comment: '' },
    'http://test',
  );
  const sub = order.subOrders[0];
  assert.equal(order.paymentStatus, 'cash_on_delivery');
  await changeSubOrderStatus(sub.id, 'delivered', 'test', true);
  const commission = Math.round(offer.price * 0.1);
  assert.equal(breakdown(1).available - before, -commission);
});

test('online order with courier: supplier gets subtotal minus commission, customer earns coins', async () => {
  endTrial(3);
  const coinsBefore = get<any>('SELECT coins FROM users WHERE id = ?', userId).coins;
  const before = breakdown(3).available;
  const offer = offerOf(3);
  const order = await placeOrder(
    userId,
    { lines: [{ offerId: offer.id, qty: 3 }], groups: [{ supplierId: 3, deliveryMethod: 'courier' }], addressId, paymentMethod: 'qr', promoCode: null, coinsToUse: 0, comment: '' },
    'http://test',
  );
  assert.equal(order.paymentStatus, 'pending');
  await markPaid(order.id, 'test');
  await changeSubOrderStatus(order.subOrders[0].id, 'delivered', 'test', true);
  const subtotal = offer.price * 3;
  assert.equal(breakdown(3).available - before, subtotal - Math.round(subtotal * 0.1));
  const coinsAfter = get<any>('SELECT coins FROM users WHERE id = ?', userId).coins;
  assert.equal(coinsAfter - coinsBefore, Math.floor(subtotal / 100));
});

test('supplier-funded promo reduces supplier payout; platform promo does not', async () => {
  endTrial(1);
  const offer = offerOf(1);
  const qty = Math.ceil(800 / offer.price) + 1;
  const before = breakdown(1).available;
  const order = await placeOrder(
    userId,
    { lines: [{ offerId: offer.id, qty }], groups: [{ supplierId: 1, deliveryMethod: 'courier' }], addressId, paymentMethod: 'qr', promoCode: 'KANC15', coinsToUse: 0, comment: '' },
    'http://test',
  );
  const subtotal = offer.price * qty;
  const discount = Math.round(subtotal * 0.15);
  assert.equal(order.promoDiscount, discount);
  await markPaid(order.id, 'test');
  await changeSubOrderStatus(order.subOrders[0].id, 'delivered', 'test', true);
  const expected = subtotal - discount - Math.round(((subtotal - discount) * 10) / 100);
  assert.equal(breakdown(1).available - before, expected);
});

test('cancelling returns stock and spent coins', async () => {
  run('UPDATE users SET coins = 200 WHERE id = ?', userId);
  const offer = offerOf(2);
  const stockBefore = offer.stock;
  const order = await placeOrder(
    userId,
    { lines: [{ offerId: offer.id, qty: 10 }], groups: [], addressId, paymentMethod: 'cash', promoCode: null, coinsToUse: 20, comment: '' },
    'http://test',
  );
  assert.equal(order.coinsUsed, 20);
  assert.equal(get<any>('SELECT stock FROM offers WHERE id = ?', offer.id).stock, stockBefore - 10);
  for (const s of order.subOrders) await changeSubOrderStatus(s.id, 'cancelled', 'test');
  assert.equal(get<any>('SELECT stock FROM offers WHERE id = ?', offer.id).stock, stockBefore);
  assert.equal(get<any>('SELECT coins FROM users WHERE id = ?', userId).coins, 200);
  assert.equal(get<any>('SELECT status FROM orders WHERE id = ?', order.id).status, 'cancelled');
});

test('seeded ledger is consistent with delivered sub-orders', () => {
  const rows = all<any>("SELECT COUNT(*) AS n FROM sub_orders WHERE status = 'delivered' AND settled = 0");
  assert.equal(rows[0].n, 0);
});
