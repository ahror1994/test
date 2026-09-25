import type { PayoutBreakdown } from '@taptym/shared';
import { formatPrice } from '@taptym/shared';

/** Ledger sums are signed (debits negative), so each row is shown with its own sign. */
const ROWS: { key: keyof PayoutBreakdown; label: string; hint?: string }[] = [
  { key: 'sales', label: 'Продажи', hint: 'Доставленные заказы' },
  { key: 'commission', label: 'Комиссия площадки' },
  { key: 'promotions', label: 'Продвижение и реклама', hint: 'Баннеры, топ в поиске' },
  { key: 'services', label: 'Услуги площадки', hint: 'Загрузка каталога, курьер' },
  { key: 'promoDiscounts', label: 'Скидки за счёт магазина', hint: 'Промокоды магазина' },
  { key: 'cashCollected', label: 'Наличные, полученные магазином', hint: 'Уже на руках у магазина' },
  { key: 'refunds', label: 'Возвраты', hint: 'Возврат за отменённые услуги' },
  { key: 'adjustments', label: 'Корректировки' },
  { key: 'paidOut', label: 'Уже выплачено' },
];

export function BreakdownTable({ b, compact }: { b: PayoutBreakdown; compact?: boolean }) {
  return (
    <div className={`calc ${compact ? 'compact' : ''}`}>
      {ROWS.map((r, i) => {
        const v = b[r.key] ?? 0;
        if (compact && !v && r.key !== 'sales' && r.key !== 'commission') return null;
        return (
          <div key={r.key} className={`calc-row ${!v ? 'zero' : ''}`}>
            <span className="calc-op">{i === 0 ? '' : v >= 0 ? '+' : '−'}</span>
            <span className="grow">
              {r.label}
              {r.hint && !compact && <span className="calc-hint">{r.hint}</span>}
            </span>
            <span className={`num ${v < 0 ? 'neg' : v > 0 && i > 0 ? 'pos' : ''}`}>{formatPrice(Math.abs(v))}</span>
          </div>
        );
      })}
      <div className="calc-total">
        <span>= Доступно к выплате</span>
        <span className="num">{formatPrice(b.available)}</span>
      </div>
    </div>
  );
}
