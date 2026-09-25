import type { PayoutBreakdown } from '@taptym/shared';
import { all, get } from '../db.ts';

export function supplierBalance(supplierId: number): number {
  return get<{ b: number }>('SELECT COALESCE(SUM(amount), 0) AS b FROM ledger WHERE supplier_id = ?', supplierId)?.b ?? 0;
}

export function breakdown(supplierId: number): PayoutBreakdown {
  const rows = all<{ type: string; total: number }>(
    'SELECT type, SUM(amount) AS total FROM ledger WHERE supplier_id = ? GROUP BY type',
    supplierId,
  );
  const by = (t: string) => rows.find((r) => r.type === t)?.total ?? 0;
  const b: PayoutBreakdown = {
    sales: by('sale'),
    commission: by('commission'),
    promotions: by('promotion'),
    services: by('service'),
    promoDiscounts: by('promo_discount'),
    cashCollected: by('cash_collected'),
    refunds: by('refund'),
    adjustments: by('adjustment'),
    paidOut: by('payout'),
    available: 0,
  };
  b.available = rows.reduce((a, r) => a + r.total, 0);
  return b;
}

export function activeServices(supplierId: number) {
  return all<any>(
    "SELECT title AS name, price AS amount FROM supplier_services WHERE supplier_id = ? AND status IN ('active','pending')",
    supplierId,
  );
}
