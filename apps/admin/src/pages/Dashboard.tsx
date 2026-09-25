import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertCircle,
  Banknote,
  Box,
  Headphones,
  Megaphone,
  Percent,
  ShoppingBag,
  Store,
  TicketPercent,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { formatPrice } from '@taptym/shared';
import { useApi } from '../hooks';
import { useAuth } from '../auth';
import type { AdminOrder } from '../types';
import { DELIVERY_METHOD, ORDER_STATUS, PAYMENT_METHOD } from '../labels';
import { Chip, Empty, ErrorBox, Money, PageHead, Skeleton, relTime } from '../ui';

type Dash = {
  kpi: {
    gmv: number;
    orders: number;
    avgCheck: number;
    commission: number;
    promoRevenue: number;
    customers: number;
    newCustomers: number;
    suppliers: number;
    products: number;
    offers: number;
    platformDebt: number;
  };
  chart: { date: string; orders: number; gmv: number; commission: number }[];
  topSuppliers: { id: number; name: string; logo_emoji: string; orders: number; revenue: number; commission: number }[];
  topProducts: { title: string; emoji: string; qty: number; revenue: number }[];
  paymentMix: { method: string; n: number; total: number }[];
  deliveryMix: { method: string; n: number }[];
  badges: { newOrders: number; payouts: number; promos: number; support: number; services: number };
  recent: AdminOrder[];
};

const MIX_COLORS = ['#5B3CF5', '#12B76A', '#F79009', '#1D7AFC', '#F04438', '#9A9EB1'];

const compact = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v)));
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
};

export default function Dashboard() {
  const [days, setDays] = useState<7 | 30>(30);
  const { data, error, loading, reload } = useApi<Dash>(`/dashboard?days=${days}`);
  const nav = useNavigate();
  const { can } = useAuth();
  const go = (to: string, perm: Parameters<typeof can>[0]) => (can(perm) ? () => nav(to) : undefined);

  return (
    <>
      <PageHead
        title="Дашборд"
        subtitle={`Сводка площадки за ${days === 7 ? '7 дней' : '30 дней'}`}
        actions={
          <div className="seg" style={{ width: 220 }}>
            <button className={days === 7 ? 'on' : ''} onClick={() => setDays(7)} data-testid="period-7">
              7 дней
            </button>
            <button className={days === 30 ? 'on' : ''} onClick={() => setDays(30)} data-testid="period-30">
              30 дней
            </button>
          </div>
        }
      />
      {error && !data ? <ErrorBox error={error} retry={reload} /> : null}
      {!data && loading && <DashSkeleton />}
      {data && (
        <div className="col gap-20" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .2s' }}>
          <div className="grid g-4">
            <Kpi hero icon={TrendingUp} label="Оборот (GMV)" value={formatPrice(data.kpi.gmv)} sub={`${data.kpi.orders} заказов`} />
            <Kpi icon={ShoppingBag} tone="#1D7AFC" label="Заказы" value={String(data.kpi.orders)} sub={`Средний чек ${formatPrice(data.kpi.avgCheck)}`} />
            <Kpi icon={Percent} tone="#12B76A" label="Комиссия площадки" value={formatPrice(data.kpi.commission)} sub="С доставленных и активных" />
            <Kpi icon={Megaphone} tone="#F79009" label="Доход от рекламы" value={formatPrice(data.kpi.promoRevenue)} sub="Баннеры, топ, услуги" />
          </div>
          <div className="grid g-4">
            <Kpi icon={Users} tone="#7A5AF8" label="Покупатели" value={String(data.kpi.customers)} sub={`+${data.kpi.newCustomers} новых за период`} />
            <Kpi icon={Store} tone="#0BA5EC" label="Активные поставщики" value={String(data.kpi.suppliers)} sub="Магазины на площадке" />
            <Kpi icon={Box} tone="#EE46BC" label="Товары / предложения" value={`${data.kpi.products} / ${data.kpi.offers}`} sub="Карточки и цены магазинов" />
            <Kpi icon={Wallet} tone="#F04438" label="Долг поставщикам" value={formatPrice(data.kpi.platformDebt)} sub="Сумма балансов к выплате" onClick={go('/payouts', 'payouts')} />
          </div>

          <div className="grid dash-main">
            <div className="card">
              <div className="card-head">
                <div>
                  <h3>Оборот и комиссия по дням</h3>
                  <div className="sub">Сом, оплаченные и принятые заказы</div>
                </div>
                <div className="legend">
                  <span><i style={{ background: '#5B3CF5' }} /> Оборот</span>
                  <span><i style={{ background: '#12B76A' }} /> Комиссия</span>
                </div>
              </div>
              <div style={{ height: 300, padding: '12px 12px 8px 0' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.chart} margin={{ left: 0, right: 12, top: 10 }}>
                    <defs>
                      <linearGradient id="gGmv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5B3CF5" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#5B3CF5" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gCom" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#12B76A" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#12B76A" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#ECEDF3" />
                    <XAxis dataKey="date" tickFormatter={dayLabel} tick={{ fontSize: 12, fill: '#9A9EB1' }} axisLine={false} tickLine={false} minTickGap={18} />
                    <YAxis tickFormatter={compact} tick={{ fontSize: 12, fill: '#9A9EB1' }} axisLine={false} tickLine={false} width={52} />
                    <Tooltip content={<ChartTip />} />
                    <Area type="monotone" dataKey="gmv" name="Оборот" stroke="#5B3CF5" strokeWidth={2.5} fill="url(#gGmv)" />
                    <Area type="monotone" dataKey="commission" name="Комиссия" stroke="#12B76A" strokeWidth={2.5} fill="url(#gCom)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card card-pad">
              <h3 className="h3">Требует внимания</h3>
              <div className="col gap-6 mt-16">
                {can('orders') && <Attention to="/orders?status=new" icon={ShoppingBag} color="#5B3CF5" label="Новые заказы" n={data.badges.newOrders} />}
                {can('payouts') && <Attention to="/payouts" icon={Banknote} color="#12B76A" label="Запросы на выплату" n={data.badges.payouts} />}
                {can('promos') && <Attention to="/promos" icon={TicketPercent} color="#F79009" label="Промокоды на одобрение" n={data.badges.promos} />}
                {can('support') && <Attention to="/support" icon={Headphones} color="#1D7AFC" label="Непрочитанные чаты" n={data.badges.support} />}
                {can('suppliers') && <Attention to="/suppliers?services=pending" icon={AlertCircle} color="#F04438" label="Услуги ждут одобрения" n={data.badges.services} />}
              </div>
            </div>
          </div>

          <div className="grid g-3">
            <div className="card card-pad">
              <h3 className="h3">Способы оплаты</h3>
              <Mix rows={data.paymentMix.map((r) => ({ label: PAYMENT_METHOD[r.method] ?? r.method, n: r.n, extra: formatPrice(r.total) }))} />
            </div>
            <div className="card card-pad">
              <h3 className="h3">Способы доставки</h3>
              <Mix rows={data.deliveryMix.map((r) => ({ label: DELIVERY_METHOD[r.method] ?? r.method, n: r.n }))} />
            </div>
            <div className="card">
              <div className="card-head">
                <h3>Заказы по дням</h3>
              </div>
              <div style={{ height: 200, padding: '8px 12px 8px 0' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.chart} margin={{ left: 0, right: 8, top: 8 }}>
                    <CartesianGrid vertical={false} stroke="#ECEDF3" />
                    <XAxis dataKey="date" tickFormatter={dayLabel} tick={{ fontSize: 11, fill: '#9A9EB1' }} axisLine={false} tickLine={false} minTickGap={16} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9A9EB1' }} axisLine={false} tickLine={false} width={32} />
                    <Tooltip cursor={{ fill: '#F1EEFE' }} content={<ChartTip plain />} />
                    <Bar dataKey="orders" name="Заказы" fill="#5B3CF5" radius={[6, 6, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid g-2">
            <div className="card card-pad">
              <div className="row between">
                <h3 className="h3">Топ поставщиков</h3>
                <Link to="/suppliers" className="small">Все →</Link>
              </div>
              <div className="mt-8">
                {data.topSuppliers.length === 0 && <Empty title="Нет продаж за период" />}
                {data.topSuppliers.map((s, i) => (
                  <Link key={s.id} to={can('suppliers') ? `/suppliers/${s.id}` : '#'} onClick={(e) => !can('suppliers') && e.preventDefault()} className="list-row plain-link">
                    <span className="rank">{i + 1}</span>
                    <span className="emoji-badge">{s.logo_emoji}</span>
                    <div className="grow ellipsis">
                      <b>{s.name}</b>
                      <div className="small muted">{s.orders} заказов · комиссия {formatPrice(s.commission)}</div>
                    </div>
                    <Money v={s.revenue} className="strong" />
                  </Link>
                ))}
              </div>
            </div>
            <div className="card card-pad">
              <div className="row between">
                <h3 className="h3">Топ товаров</h3>
                <Link to="/products" className="small">Каталог →</Link>
              </div>
              <div className="mt-8">
                {data.topProducts.length === 0 && <Empty title="Нет продаж за период" />}
                {data.topProducts.map((p, i) => (
                  <div key={i} className="list-row">
                    <span className="rank">{i + 1}</span>
                    <span className="emoji-badge">{p.emoji}</span>
                    <div className="grow ellipsis">
                      <b>{p.title}</b>
                      <div className="small muted">{p.qty} шт.</div>
                    </div>
                    <Money v={p.revenue} className="strong" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Последние заказы</h3>
              <Link to="/orders" className="small">Все заказы →</Link>
            </div>
            <div className="table-wrap mt-8">
              <table className="table clickable">
                <thead>
                  <tr>
                    <th>Номер</th>
                    <th>Клиент</th>
                    <th className="hide-md">Магазины</th>
                    <th className="r">Сумма</th>
                    <th>Статус</th>
                    <th className="hide-md">Когда</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((o) => (
                    <tr key={o.id} onClick={go(`/orders?open=${o.id}`, 'orders')}>
                      <td className="strong num">{o.number}</td>
                      <td>
                        {o.customer.isCompany ? o.customer.companyName : o.customer.name}
                        {o.customer.isCompany && <span className="tag-company">Юрлицо</span>}
                      </td>
                      <td className="hide-md ellipsis" style={{ maxWidth: 240 }}>{o.subOrders.map((s) => s.supplier.name).join(', ')}</td>
                      <td className="r"><Money v={o.total} className="strong" /></td>
                      <td><Chip tone={ORDER_STATUS[o.status]?.tone}>{ORDER_STATUS[o.status]?.label ?? o.status}</Chip></td>
                      <td className="hide-md muted">{relTime(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Kpi({ icon: Icon, label, value, sub, hero, tone = '#5B3CF5', onClick }: { icon: LucideIcon; label: string; value: string; sub?: string; hero?: boolean; tone?: string; onClick?: () => void }) {
  return (
    <div className={`card kpi ${hero ? 'hero' : ''} ${onClick ? 'clickable-card' : ''}`} onClick={onClick}>
      <div className="k-label">
        <span className="k-icon" style={hero ? undefined : { background: `${tone}18`, color: tone }}>
          <Icon size={17} />
        </span>
        {label}
      </div>
      <div className="k-value">{value}</div>
      {sub && <div className="k-sub">{sub}</div>}
    </div>
  );
}

function Attention({ to, icon: Icon, color, label, n }: { to: string; icon: LucideIcon; color: string; label: string; n: number }) {
  return (
    <Link to={to} className={`attention ${n ? '' : 'zero'}`}>
      <span className="a-icon" style={{ background: `${color}18`, color }}>
        <Icon size={18} />
      </span>
      <span className="strong">{label}</span>
      <span className="a-n num" style={{ color: n ? color : undefined }}>{n}</span>
    </Link>
  );
}

function Mix({ rows }: { rows: { label: string; n: number; extra?: string }[] }) {
  const total = rows.reduce((a, r) => a + r.n, 0) || 1;
  if (!rows.length) return <Empty title="Нет данных" />;
  return (
    <div className="mt-16 col gap-6">
      <div className="stack-bar">
        {rows.map((r, i) => (
          <div key={r.label} style={{ width: `${(r.n / total) * 100}%`, background: MIX_COLORS[i % MIX_COLORS.length] }} title={r.label} />
        ))}
      </div>
      {rows.map((r, i) => (
        <div key={r.label} className="row between small mix-row">
          <span className="row gap-6">
            <i className="dot-i" style={{ background: MIX_COLORS[i % MIX_COLORS.length] }} />
            {r.label}
          </span>
          <span className="row gap-6">
            {r.extra && <span className="muted">{r.extra}</span>}
            <b className="num">{Math.round((r.n / total) * 100)}%</b>
          </span>
        </div>
      ))}
    </div>
  );
}

function ChartTip({ active, payload, label, plain }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; plain?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="muted small">{label ? dayLabel(label) : ''}</div>
      {payload.map((p) => (
        <div key={p.name} className="row gap-6">
          <i className="dot-i" style={{ background: p.color }} />
          {p.name}: <b className="num">{plain ? p.value : formatPrice(p.value)}</b>
        </div>
      ))}
    </div>
  );
}

function DashSkeleton() {
  return (
    <div className="col gap-20">
      <div className="grid g-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={118} r={20} />)}</div>
      <div className="grid g-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={118} r={20} />)}</div>
      <div className="grid dash-main">
        <Skeleton h={360} r={20} />
        <Skeleton h={360} r={20} />
      </div>
    </div>
  );
}
