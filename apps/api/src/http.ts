import type { Context, MiddlewareHandler } from 'hono';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { AdminPermission } from '@taptym/shared';
import { get, run, nowIso, json, UPLOAD_DIR } from './db.ts';
import { ApiError } from './services/orders.ts';

export type Vars = {
  userId: number;
  staffId: number;
  supplierId: number;
  supplierRole: string;
  adminId: number;
  adminPerms: AdminPermission[];
  adminName: string;
};
export type Ctx = Context<{ Variables: Vars }>;

export function newToken() {
  return randomBytes(24).toString('hex');
}

export function createSession(kind: 'customer' | 'supplier' | 'admin', subjectId: number, supplierId: number | null = null) {
  const token = newToken();
  run('INSERT INTO sessions(token, kind, subject_id, supplier_id, created_at) VALUES(?,?,?,?,?)', token, kind, subjectId, supplierId, nowIso());
  return token;
}

function bearer(c: Context) {
  const h = c.req.header('authorization') ?? '';
  return h.startsWith('Bearer ') ? h.slice(7) : (c.req.query('token') ?? '');
}

function session(c: Context, kind: string) {
  const token = bearer(c);
  if (!token) return null;
  return get<any>('SELECT * FROM sessions WHERE token = ? AND kind = ?', token, kind) ?? null;
}

export const customerAuth: MiddlewareHandler<{ Variables: Vars }> = async (c, next) => {
  const s = session(c, 'customer');
  if (!s) return c.json({ error: 'unauthorized' }, 401);
  const u = get<any>('SELECT banned FROM users WHERE id = ?', s.subject_id);
  if (!u) return c.json({ error: 'unauthorized' }, 401);
  if (u.banned) return c.json({ error: 'user_blocked' }, 403);
  c.set('userId', s.subject_id);
  await next();
};

/** Optional customer auth: sets userId when a valid token is present. */
export const customerMaybe: MiddlewareHandler<{ Variables: Vars }> = async (c, next) => {
  const s = session(c, 'customer');
  if (s) c.set('userId', s.subject_id);
  await next();
};

export const supplierAuth: MiddlewareHandler<{ Variables: Vars }> = async (c, next) => {
  const s = session(c, 'supplier');
  if (!s) return c.json({ error: 'unauthorized' }, 401);
  const staff = get<any>('SELECT * FROM supplier_staff WHERE id = ? AND active = 1', s.subject_id);
  const sup = get<any>('SELECT status FROM suppliers WHERE id = ?', s.supplier_id);
  if (!staff || !sup) return c.json({ error: 'unauthorized' }, 401);
  if (sup.status === 'banned') return c.json({ error: 'supplier_banned' }, 403);
  c.set('staffId', staff.id);
  c.set('supplierId', s.supplier_id);
  c.set('supplierRole', staff.role);
  await next();
};

/** Supplier roles: owner — everything; manager — no staff/finance payouts; cashier — orders; warehouse — products/stock. */
const SUPPLIER_ROLE_SCOPES: Record<string, string[]> = {
  owner: ['orders', 'products', 'finance', 'staff', 'promos', 'settings', 'reports', 'support'],
  manager: ['orders', 'products', 'promos', 'reports', 'support', 'finance_view'],
  cashier: ['orders', 'support'],
  warehouse: ['products', 'orders_view'],
};
export function supplierCan(role: string, scope: string) {
  return (SUPPLIER_ROLE_SCOPES[role] ?? []).includes(scope);
}
export function requireSupplierScope(scope: string): MiddlewareHandler<{ Variables: Vars }> {
  return async (c, next) => {
    if (!supplierCan(c.get('supplierRole'), scope)) return c.json({ error: 'forbidden' }, 403);
    await next();
  };
}

export const adminAuth: MiddlewareHandler<{ Variables: Vars }> = async (c, next) => {
  const s = session(c, 'admin');
  if (!s) return c.json({ error: 'unauthorized' }, 401);
  const a = get<any>('SELECT * FROM admin_users WHERE id = ? AND active = 1', s.subject_id);
  if (!a) return c.json({ error: 'unauthorized' }, 401);
  c.set('adminId', a.id);
  c.set('adminName', a.name);
  c.set('adminPerms', a.role === 'owner' ? (['*'] as any) : json(a.permissions, []));
  await next();
};

export function requirePerm(perm: AdminPermission): MiddlewareHandler<{ Variables: Vars }> {
  return async (c, next) => {
    const perms = c.get('adminPerms') as string[];
    if (!perms.includes('*') && !perms.includes(perm)) return c.json({ error: 'forbidden' }, 403);
    await next();
  };
}

export function hashPassword(pw: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pw, salt, 32).toString('hex')}`;
}
export function verifyPassword(pw: string, stored: string) {
  const [salt, hash] = stored.split(':');
  const a = Buffer.from(hash, 'hex');
  const b = scryptSync(pw, salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function body<T = any>(c: Context): Promise<T> {
  try {
    return (await c.req.json()) as T;
  } catch {
    return {} as T;
  }
}

export function baseUrl(c: Context) {
  const proto = c.req.header('x-forwarded-proto') ?? 'http';
  const host = c.req.header('x-forwarded-host') ?? c.req.header('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

const ALLOWED_UPLOAD = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.mov', '.webm', '.xlsx', '.xls', '.csv'];

export async function saveUpload(c: Context): Promise<{ url: string; name: string; path: string }> {
  const form = await c.req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') throw new ApiError(400, 'file_required');
  const f = file as File;
  if (f.size > 50 * 1024 * 1024) throw new ApiError(413, 'file_too_large');
  let ext = extname(f.name || '').toLowerCase();
  if (!ext && f.type.startsWith('image/')) ext = '.' + f.type.split('/')[1].replace('jpeg', 'jpg');
  if (!ALLOWED_UPLOAD.includes(ext)) throw new ApiError(400, 'file_type_not_allowed');
  const name = `${Date.now()}-${randomBytes(4).toString('hex')}${ext}`;
  const path = join(UPLOAD_DIR, name);
  writeFileSync(path, Buffer.from(await f.arrayBuffer()));
  return { url: `/uploads/${name}`, name: f.name, path };
}
