import { useState } from 'react';
import { Download, FileBarChart } from 'lucide-react';
import { formatPrice } from '@taptym/shared';
import { downloadUrl } from '../api';
import { useApi } from '../hooks';
import { Empty, ErrorBox, Money, PageHead, Skeleton } from '../ui';

type Report = {
  from: string;
  to: string;
  bySupplier: { id: number; name: string; orders: number; revenue: number; commission: number; delivery: number; platform_discounts: number; platform_delivery: number }[];
  services: { name: string; total: number }[];
  totals: { revenue: number; commission: number; orders: number; platformDiscounts: number; platformDelivery: number; services: number; coins: number; net: number };
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const PRESETS = [
  { label: '7 дней', days: 7 },
  { label: '30 дней', days: 30 },
  { label: '90 дней', days: 90 },
];

export default function Reports() {
  const [from, setFrom] = useState(iso(new Date(Date.now() - 30 * 86400_000)));
  const [to, setTo] = useState(iso(new Date()));
  // `to` is exclusive in the API, so include the chosen end date.
  const toExcl = iso(new Date(new Date(to).getTime() + 86400_000));
  const q = `from=${from}&to=${toExcl}`;
  const { data, error, loading, reload } = useApi<Report>(`/reports/finance?${q}`);

  return (
    <>
      <PageHead
        title="Финансовый отчёт"
        subtitle="Только доставленные заказы. Чистый доход = комиссия + продвижение − скидки и доставка за счёт площадки − монеты"
        actions={
          <a className="btn btn-primary" href={downloadUrl(`/reports/finance.csv?${q}`)} download data-testid="csv-download">
            <Download size={16} /> Скачать CSV
          </a>
        }
      />
      <div className="toolbar">
        <div className="row gap-6 wrap">
          <input className="input" type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} style={{ width: 170 }} data-testid="report-from" />
          <span className="muted">—</span>
          <input className="input" type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} style={{ width: 170 }} data-testid="report-to" />
        </div>
        <div className="row gap-6">
          {PRESETS.map((p) => (
            <button
              key={p.days}
              className="btn btn-sm"
              onClick={() => {
                setFrom(iso(new Date(Date.now() - p.days * 86400_000)));
                setTo(iso(new Date()));
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {error && !data && <ErrorBox error={error} retry={reload} />}
      {!data && loading && <div className="col gap-20"><Skeleton h={180} r={20} /><Skeleton h={300} r={20} /></div>}
      {data && (
        <div className="col gap-20" style={{ opacity: loading ? 0.6 : 1 }}>
          <div className="report-totals">
            <Total label="Выручка магазинов" v={data.totals.revenue} sub={`${data.totals.orders} заказов`} />
            <Total label="Комиссия" v={data.totals.commission} pos />
            <Total label="Продвижение и услуги" v={data.totals.services} pos />
            <Total label="Скидки за счёт площадки" v={-data.totals.platformDiscounts} />
            <Total label="Бесплатная доставка за счёт площадки" v={-data.totals.platformDelivery} />
            <Total label="Оплачено монетами" v={-data.totals.coins} />
            <div className="card kpi hero">
              <div className="k-label">Чистый доход площадки</div>
              <div className="k-value" data-testid="report-net">{formatPrice(data.totals.net)}</div>
              <div className="k-sub">за {Math.round((new Date(toExcl).getTime() - new Date(from).getTime()) / 86400_000)} дн.</div>
            </div>
          </div>
          <div className="grid report-grid">
            <div className="card">
              <div className="card-head"><h3>По поставщикам</h3></div>
              {data.bySupplier.length === 0 ? <Empty icon={<FileBarChart size={26} />} title="Нет доставленных заказов за период" /> : (
                <div className="table-wrap mt-8">
                  <table className="table" data-testid="report-table">
                    <thead>
                      <tr>
                        <th>Поставщик</th>
                        <th className="r">Заказов</th>
                        <th className="r">Выручка</th>
                        <th className="r">Комиссия</th>
                        <th className="r hide-md">Доставка</th>
                        <th className="r hide-md">Скидки площадки</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.bySupplier.map((r) => (
                        <tr key={r.id}>
                          <td className="strong">{r.name}</td>
                          <td className="r num">{r.orders}</td>
                          <td className="r"><Money v={r.revenue} /></td>
                          <td className="r"><Money v={r.commission} className="pos" /></td>
                          <td className="r hide-md"><Money v={r.delivery} /></td>
                          <td className="r hide-md"><Money v={r.platform_discounts} /></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>Итого</td>
                        <td className="r num">{data.totals.orders}</td>
                        <td className="r"><Money v={data.totals.revenue} /></td>
                        <td className="r"><Money v={data.totals.commission} /></td>
                        <td className="r hide-md" />
                        <td className="r hide-md"><Money v={data.totals.platformDiscounts} /></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
            <div className="card card-pad">
              <h3 className="h3">Доход от продвижения</h3>
              <div className="mt-8">
                {data.services.length === 0 && <div className="muted small mt-8">Магазины не покупали продвижение за период</div>}
                {data.services.map((s) => (
                  <div key={s.name} className="list-row">
                    <span className="grow">{s.name}</span>
                    <Money v={s.total} className="strong" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Total({ label, v, sub, pos }: { label: string; v: number; sub?: string; pos?: boolean }) {
  return (
    <div className="card kpi">
      <div className="k-label">{label}</div>
      <div className={`k-value ${v < 0 ? 'neg' : pos && v > 0 ? 'pos' : ''}`} style={{ fontSize: 22 }}>{formatPrice(v)}</div>
      {sub && <div className="k-sub">{sub}</div>}
    </div>
  );
}
