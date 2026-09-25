import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const API_ROOT = resolve(here, '..');
export const DATA_DIR = process.env.DATA_DIR ?? resolve(API_ROOT, 'data');
export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? resolve(API_ROOT, 'uploads');
mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(UPLOAD_DIR, { recursive: true });

export const DB_PATH = process.env.DB_PATH ?? resolve(DATA_DIR, 'taptym.db');

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

type Params = SQLInputValue[];

export function all<T = any>(sql: string, ...params: Params): T[] {
  return db.prepare(sql).all(...params) as T[];
}
export function get<T = any>(sql: string, ...params: Params): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}
export function run(sql: string, ...params: Params): { lastInsertRowid: number; changes: number } {
  const r = db.prepare(sql).run(...params);
  return { lastInsertRowid: Number(r.lastInsertRowid), changes: Number(r.changes) };
}
export function tx<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
export function json<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
export const nowIso = () => new Date().toISOString();

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  lang TEXT NOT NULL DEFAULT 'ru',
  coins INTEGER NOT NULL DEFAULT 0,
  referral_code TEXT UNIQUE,
  referred_by INTEGER,
  referral_rewarded INTEGER NOT NULL DEFAULT 0,
  is_company INTEGER NOT NULL DEFAULT 0,
  company_name TEXT,
  company_inn TEXT,
  banned INTEGER NOT NULL DEFAULT 0,
  push_token TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  line TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS sms_codes (phone TEXT PRIMARY KEY, code TEXT NOT NULL, expires_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  subject_id INTEGER NOT NULL,
  supplier_id INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  legal_name TEXT NOT NULL DEFAULT '',
  inn TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  logo_emoji TEXT NOT NULL DEFAULT '🏪',
  color TEXT NOT NULL DEFAULT '#EEF',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  trial_until TEXT,
  own_delivery INTEGER NOT NULL DEFAULT 0,
  own_delivery_fee INTEGER NOT NULL DEFAULT 0,
  own_free_from INTEGER NOT NULL DEFAULT 0,
  accepts_cash INTEGER NOT NULL DEFAULT 1,
  work_hours TEXT NOT NULL DEFAULT '09:00–19:00',
  rating REAL NOT NULL DEFAULT 4.8,
  payout_details TEXT NOT NULL DEFAULT '',
  moysklad_token TEXT,
  onec_url TEXT,
  api_token TEXT,
  ban_reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS supplier_staff (
  id INTEGER PRIMARY KEY,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  role TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(supplier_id, phone)
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  brand TEXT,
  category_id TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '📦',
  color TEXT NOT NULL DEFAULT '#EEF',
  images TEXT NOT NULL DEFAULT '[]',
  video_url TEXT,
  barcode TEXT,
  description TEXT NOT NULL DEFAULT '',
  specs TEXT NOT NULL DEFAULT '{}',
  keywords TEXT NOT NULL DEFAULT '',
  moderation TEXT NOT NULL DEFAULT 'approved',
  hidden INTEGER NOT NULL DEFAULT 0,
  created_by_supplier INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  price INTEGER NOT NULL,
  old_price INTEGER,
  wholesale_price INTEGER,
  wholesale_from INTEGER,
  stock INTEGER NOT NULL DEFAULT 0,
  sku TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  UNIQUE(product_id, supplier_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id INTEGER,
  user_name TEXT NOT NULL,
  supplier_id INTEGER,
  rating INTEGER NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  photos TEXT NOT NULL DEFAULT '[]',
  video_url TEXT,
  hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL, product_id INTEGER NOT NULL, created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  number TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'placed',
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  items_total INTEGER NOT NULL,
  delivery_total INTEGER NOT NULL,
  promo_code TEXT,
  promo_discount INTEGER NOT NULL DEFAULT 0,
  coins_used INTEGER NOT NULL DEFAULT 0,
  coins_to_earn INTEGER NOT NULL DEFAULT 0,
  coins_earned INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  lat REAL, lng REAL,
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sub_orders (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  status TEXT NOT NULL DEFAULT 'new',
  delivery_method TEXT NOT NULL,
  delivery_fee INTEGER NOT NULL DEFAULT 0,
  delivery_paid_by_platform INTEGER NOT NULL DEFAULT 0,
  distance_km REAL NOT NULL DEFAULT 0,
  subtotal INTEGER NOT NULL,
  commission INTEGER NOT NULL DEFAULT 0,
  promo_discount INTEGER NOT NULL DEFAULT 0,
  supplier_funded_discount INTEGER NOT NULL DEFAULT 0,
  coins_share INTEGER NOT NULL DEFAULT 0,
  settled INTEGER NOT NULL DEFAULT 0,
  courier_note TEXT,
  history TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY,
  sub_order_id INTEGER NOT NULL REFERENCES sub_orders(id) ON DELETE CASCADE,
  offer_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  emoji TEXT NOT NULL,
  color TEXT NOT NULL,
  image TEXT,
  price INTEGER NOT NULL,
  qty INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  method TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  external_id TEXT,
  qr_payload TEXT,
  demo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  sub_order_id INTEGER,
  payout_id INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payouts (
  id INTEGER PRIMARY KEY,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  method TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'requested',
  breakdown TEXT NOT NULL DEFAULT '{}',
  services TEXT NOT NULL DEFAULT '[]',
  comment TEXT NOT NULL DEFAULT '',
  processed_by INTEGER,
  created_at TEXT NOT NULL,
  processed_at TEXT
);

CREATE TABLE IF NOT EXISTS promo_codes (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  value INTEGER NOT NULL,
  min_total INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER NOT NULL DEFAULT 0,
  used INTEGER NOT NULL DEFAULT 0,
  per_user INTEGER NOT NULL DEFAULT 1,
  supplier_id INTEGER,
  funded_by TEXT NOT NULL DEFAULT 'platform',
  status TEXT NOT NULL DEFAULT 'active',
  starts_at TEXT,
  ends_at TEXT,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS promo_uses (
  promo_id INTEGER NOT NULL, user_id INTEGER NOT NULL, order_id INTEGER NOT NULL, created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS banners (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  emoji TEXT NOT NULL DEFAULT '✨',
  color TEXT NOT NULL DEFAULT '#5B3CF5',
  text_color TEXT NOT NULL DEFAULT '#FFFFFF',
  placement TEXT NOT NULL DEFAULT 'home_top',
  position INTEGER NOT NULL DEFAULT 0,
  link TEXT NOT NULL DEFAULT '',
  supplier_id INTEGER,
  is_ad INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  starts_at TEXT,
  ends_at TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS supplier_services (
  id INTEGER PRIMARY KEY,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  price INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coin_tx (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  order_id INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  audience TEXT NOT NULL,
  target_id INTEGER,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS threads (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,
  user_id INTEGER,
  supplier_id INTEGER,
  order_id INTEGER,
  title TEXT NOT NULL,
  is_return INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  unread_client INTEGER NOT NULL DEFAULT 0,
  unread_operator INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  thread_id INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  permissions TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS integration_log (
  id INTEGER PRIMARY KEY,
  integration TEXT NOT NULL,
  action TEXT NOT NULL,
  demo INTEGER NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_offers_product ON offers(product_id);
CREATE INDEX IF NOT EXISTS idx_offers_supplier ON offers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_sub_orders_supplier ON sub_orders(supplier_id, status);
CREATE INDEX IF NOT EXISTS idx_sub_orders_order ON sub_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_ledger_supplier ON ledger(supplier_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications ON notifications(audience, target_id);
`;

db.exec(SCHEMA);
