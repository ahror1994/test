import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bike, Building2, CircleDollarSign, Clock, MapPin, MessageSquare, Search, ShoppingBag, Store, Truck, Zap } from 'lucide-react';
import { formatDateTime, formatPrice, type SubOrder, type SubOrderStatus } from '@taptym/shared';
import { post } from '../api';
import { useAuth } from '../auth';
import { useApi, useDebounced } from '../hooks';
import { DELIVERY_METHOD, ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, SUB_STATUS } from '../labels';
import type { AdminOrder } from '../types';
import { Btn, Chip, Drawer, Empty, ErrorBox, Money, PageHead, Skeleton, TableSkeleton, Tabs, Tel, Thumb, relTime, useDialog, useToast } from '../ui';

const TABS = [
  { id: '', label: 'Все' },
  { id: 'new', label: 'Новые' },
  { id: 'unpaid', label: 'Ждут оплаты' },
  { id: 'in_progress', label: 'В работе' },
  { id: 'completed', label: 'Завершены' },
  { id: 'cancelled', label: 'Отменены' },
] as const;

type Detail = Omit<AdminOrder, 'subOrders'> & {
  subOrders: (SubOrder & { next: SubOrderStatus[]; courierNote: string | null })[];
  payments: { id: number; provider: string; amount: number; status: string; created_at: string }[];
};

export default function Orders() {
  const [sp, setSp] = useSearchParams();
  const status = sp.get('status') ?? '';
  const open = sp.get('open');
  const [q, setQ] = useState(sp.get('q') ?? '');
  const dq = useDebounced(q);
  const { me } = useAuth();

  const urlQ = sp.get('q') ?? '';
  useEffect(() => {
    if (urlQ !== dq) setQ(urlQ);
    // Only external navigation (e.g. the global search) should overwrite what is being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQ]);

  const set = (k: string, v: string | null) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    setSp(n, { replace: k !== 'open' });
  };
  useEffect(() => {
    if ((sp.get('q') ?? '') !== dq) set('q', dq || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);

  const { data, error, loading, reload } = useApi<AdminOrder[]>(`/orders?status=${status}&q=${encodeURIComponent(sp.get('q') ?? '')}`, { poll: 20000 });

  return (
    <>
      <PageHead title="Заказы" subtitle="Все заказы площадки. Нажмите на строку, чтобы открыть детали и управлять статусами." />
      <div className="toolbar">
        <Tabs value={status} onChange={(v) => set('status', v || null)} items={TABS.map((t) => ({ ...t, count: t.id === 'new' ? me?.badges.newOrders : undefined }))} />
        <div className="search-box">
          <Search size={17} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Номер заказа, телефон или имя" data-testid="orders-search" />
        </div>
      </div>
      <div className="card">
        {error && !data && <div className="card-pad"><ErrorBox error={error} retry={reload} /></div>}
        {!data && loading && <TableSkeleton rows={8} cols={6} />}
        {data && data.length === 0 && <Empty icon={<ShoppingBag size={26} />} title="Заказов не найдено" text={sp.get('q') ? 'Попробуйте другой номер или телефон.' : 'Здесь появятся заказы покупателей.'} />}
        {data && data.length > 0 && (
          <div className="table-wrap">
            <table className="table clickable" data-testid="orders-table">
              <thead>
                <tr>
                  <th>Номер</th>
                  <th>Дата</th>
                  <th>Клиент</th>
                  <th className="hide-md">Магазины</th>
                  <th className="r">Сумма</th>
                  <th>Оплата</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {data.map((o) => (
                  <tr key={o.id} className={String(o.id) === open ? 'sel' : ''} onClick={() => set('open', String(o.id))}>
                    <td className="strong num">{o.number}</td>
                    <td className="muted nowrap">{relTime(o.createdAt)}</td>
                    <td>
                      <div className="cell-title">
                        {o.customer.isCompany ? o.customer.companyName : o.customer.name}
                        {o.customer.isCompany && <span className="tag-company">Юрлицо</span>}
                      </div>
                      <div className="cell-sub num">{o.customer.phone}</div>
                    </td>
                    <td className="hide-md">
                      <div className="ellipsis" style={{ maxWidth: 220 }}>{o.subOrders.map((s) => s.supplier.name).join(', ')}</div>
                      <div className="cell-sub">{o.subOrders.length} {o.subOrders.length === 1 ? 'магазин' : 'магазина'}</div>
                    </td>
                    <td className="r"><Money v={o.total} className="strong" /></td>
                    <td>
                      <div className="small">{PAYMENT_METHOD[o.paymentMethod]}</div>
                      <Chip tone={PAYMENT_STATUS[o.paymentStatus]?.tone} plain>{PAYMENT_STATUS[o.paymentStatus]?.label ?? o.paymentStatus}</Chip>
                    </td>
                    <td>
                      <Chip tone={ORDER_STATUS[o.status]?.tone}>{ORDER_STATUS[o.status]?.label}</Chip>
                      {o.subOrders.some((s) => s.status === 'new') && o.status !== 'cancelled' && <div className="cell-sub new-dot">есть новые</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {open && <OrderDrawer id={Number(open)} onClose={() => set('open', null)} onChanged={reload} />}
    </>
  );
}

function OrderDrawer({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const { data, error, reload } = useApi<Detail>(`/orders/${id}`);
  const { refresh } = useAuth();
  const toast = useToast();
  const dialog = useDialog();
  const after = async () => {
    await reload();
    onChanged();
    refresh();
  };

  const markPaid = async () => {
    if (!data) return;
    const ok = await dialog.confirm({ title: 'Отметить заказ оплаченным?', text: `Подтвердите, что деньги ${formatPrice(data.total)} поступили (${PAYMENT_METHOD[data.paymentMethod]}). Магазины получат заказ в работу.`, confirmText: 'Да, оплачен' });
    if (!ok) return false;
    await post(`/orders/${id}/mark-paid`);
    toast.ok('Заказ отмечен оплаченным');
    await after();
  };

  return (
    <Drawer
      onClose={onClose}
      header={
        data ? (
          <div>
            <div className="row gap-6">
              <h3 className="num" style={{ fontSize: 20 }}>{data.number}</h3>
              <Chip tone={ORDER_STATUS[data.status]?.tone}>{ORDER_STATUS[data.status]?.label}</Chip>
            </div>
            <div className="small muted">{formatDateTime(data.createdAt)}</div>
          </div>
        ) : (
          <Skeleton h={28} w={180} />
        )
      }
    >
      {error && <ErrorBox error={error} retry={reload} />}
      {!data && !error && (
        <div className="col gap-16">
          <Skeleton h={120} r={16} />
          <Skeleton h={260} r={16} />
        </div>
      )}
      {data && (
        <div className="col gap-16" data-testid="order-drawer">
          <div className="grid g-2 gap-16">
            <div className="panel">
              <div className="panel-label">Покупатель</div>
              <div className="strong">
                {data.customer.name}
                {data.customer.isCompany && <span className="tag-company"><Building2 size={11} /> {data.customer.companyName}</span>}
              </div>
              <div className="mt-8"><Tel phone={data.customer.phone} /></div>
              <div className="row gap-6 top mt-8 small"><MapPin size={15} className="muted" style={{ flexShrink: 0, marginTop: 2 }} /> {data.address || 'Самовывоз'}</div>
              {data.comment && <div className="row gap-6 top mt-8 small"><MessageSquare size={15} className="muted" style={{ flexShrink: 0, marginTop: 2 }} /> «{data.comment}»</div>}
            </div>
            <div className="panel">
              <div className="panel-label">Оплата</div>
              <div className="row between">
                <span>{PAYMENT_METHOD[data.paymentMethod]}</span>
                <Chip tone={PAYMENT_STATUS[data.paymentStatus]?.tone}>{PAYMENT_STATUS[data.paymentStatus]?.label}</Chip>
              </div>
              <dl className="sum-list mt-8">
                <dt>Товары</dt><dd><Money v={data.itemsTotal} /></dd>
                <dt>Доставка</dt><dd><Money v={data.deliveryTotal} /></dd>
                {data.promoDiscount > 0 && <><dt>Промокод</dt><dd className="neg">−{formatPrice(data.promoDiscount)}</dd></>}
                {data.coinsUsed > 0 && <><dt>Монеты</dt><dd className="neg">−{formatPrice(data.coinsUsed)}</dd></>}
                <dt className="strong">Итого</dt><dd className="strong big"><Money v={data.total} /></dd>
              </dl>
              {['pending', 'awaiting_invoice'].includes(data.paymentStatus) && data.status !== 'cancelled' && (
                <Btn variant="success" className="mt-8 w-full" icon={<CircleDollarSign size={16} />} onClick={markPaid} data-testid="mark-paid">
                  Отметить оплаченным
                </Btn>
              )}
            </div>
          </div>
          {data.subOrders.map((s) => (
            <SubOrderCard key={s.id} s={s} onChanged={after} />
          ))}
        </div>
      )}
    </Drawer>
  );
}

const BY: Record<string, string> = { customer: 'покупатель', supplier: 'магазин', system: 'система', payment: 'оплата' };
const DELIVERY_ICON = { courier: Bike, yandex: Truck, supplier: Store, pickup: MapPin } as const;

function SubOrderCard({ s, onChanged }: { s: Detail['subOrders'][number]; onChanged: () => Promise<void> }) {
  const dialog = useDialog();
  const toast = useToast();
  const [note, setNote] = useState(s.courierNote ?? '');
  const [force, setForce] = useState<SubOrderStatus | ''>('');
  const DIcon = DELIVERY_ICON[s.deliveryMethod] ?? Truck;

  const change = async (status: SubOrderStatus, forced = false) => {
    let reason = '';
    if (status === 'cancelled' || status === 'rejected') {
      const r = await dialog.prompt({
        title: status === 'cancelled' ? 'Отменить заказ магазина?' : 'Отклонить заказ?',
        text: 'Покупатель получит уведомление с причиной. Оплаченные деньги вернутся.',
        label: 'Причина',
        placeholder: 'Например: нет в наличии',
        required: true,
        multiline: true,
        confirmText: status === 'cancelled' ? 'Отменить заказ' : 'Отклонить',
        danger: true,
      });
      if (r === null) return false;
      reason = r;
    } else if (forced) {
      const ok = await dialog.confirm({
        title: `Принудительно установить «${SUB_STATUS[status].label}»?`,
        text: 'Статус будет изменён в обход обычной последовательности. Используйте, если магазин не обновил статус сам.',
        confirmText: 'Установить',
        danger: true,
      });
      if (!ok) return false;
    }
    await post(`/sub-orders/${s.id}/status`, { status, reason, force: forced });
    toast.ok(`Статус: ${SUB_STATUS[status].label}`);
    setForce('');
    await onChanged();
  };

  const saveNote = async () => {
    await post(`/sub-orders/${s.id}/courier`, { note });
    toast.ok('Заметка курьера сохранена');
    await onChanged();
  };

  const forward = s.next.filter((n) => n !== 'cancelled' && n !== 'rejected');
  const closed = s.next.length === 0;

  return (
    <div className="card sub-card" data-testid={`sub-${s.id}`}>
      <div className="sub-head">
        <span className="emoji-badge lg" style={{ background: s.supplier.color }}>{s.supplier.logoEmoji}</span>
        <div className="grow">
          <div className="strong">{s.supplier.name}</div>
          <div className="small muted row gap-6">
            <DIcon size={14} /> {DELIVERY_METHOD[s.deliveryMethod]} · {s.deliveryFee ? formatPrice(s.deliveryFee) : 'бесплатно'}
            {s.distanceKm > 0 && <> · {s.distanceKm.toFixed(1)} км</>}
          </div>
        </div>
        <Chip tone={SUB_STATUS[s.status]?.tone}>{SUB_STATUS[s.status]?.label}</Chip>
      </div>

      <div className="sub-items">
        {s.items.map((i) => (
          <div key={i.offerId} className="row gap-16 item-row">
            <Thumb emoji={i.emoji} color={i.color} image={i.image} sm />
            <div className="grow ellipsis">{i.title}</div>
            <span className="muted num nowrap">{i.qty} × {formatPrice(i.price)}</span>
            <Money v={i.qty * i.price} className="strong" />
          </div>
        ))}
      </div>
      <div className="sub-totals">
        <span>Товары <b className="num">{formatPrice(s.subtotal)}</b></span>
        <span>Комиссия <b className="num pos">{formatPrice(s.commission)}</b></span>
        {s.promoDiscount > 0 && <span>Скидка <b className="num neg">−{formatPrice(s.promoDiscount)}</b></span>}
      </div>

      <div className="timeline">
        {s.history.map((h, i) => (
          <div key={i} className="tl-item">
            <span className={`tl-dot t-${SUB_STATUS[h.status]?.tone}`} />
            <div>
              <b>{SUB_STATUS[h.status]?.label ?? h.status}</b>
              <div className="small muted">{formatDateTime(h.at)} · {BY[h.by] ?? h.by}</div>
            </div>
          </div>
        ))}
      </div>

      {s.deliveryMethod === 'courier' && !closed && (
        <div className="courier-box">
          <div className="panel-label row gap-6"><Bike size={14} /> Курьер Taptym — кто везёт / когда</div>
          <div className="row gap-6">
            <input className="input input-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Например: Азамат, мопед, к 15:00" data-testid={`courier-${s.id}`} />
            <Btn size="sm" onClick={saveNote} disabled={note === (s.courierNote ?? '')}>Сохранить</Btn>
          </div>
        </div>
      )}

      {!closed && (
        <div className="sub-actions">
          {forward.map((n) => (
            <Btn key={n} size="sm" variant={n === forward[0] ? 'primary' : 'default'} onClick={() => change(n)} data-testid={`next-${s.id}-${n}`}>
              {SUB_STATUS[n]?.action ?? SUB_STATUS[n]?.label}
            </Btn>
          ))}
          {s.next.includes('rejected') && (
            <Btn size="sm" variant="soft-danger" onClick={() => change('rejected')}>Отклонить</Btn>
          )}
          {s.next.includes('cancelled') && (
            <Btn size="sm" variant="soft-danger" onClick={() => change('cancelled')} data-testid={`cancel-${s.id}`}>Отменить</Btn>
          )}
        </div>
      )}
      <div className="force-row">
        <Zap size={14} className="muted" />
        <span className="small muted">Принудительно:</span>
        <select className="select input-sm" value={force} onChange={(e) => setForce(e.target.value as SubOrderStatus)} style={{ maxWidth: 200 }} data-testid={`force-${s.id}`}>
          <option value="">выбрать статус…</option>
          {(Object.keys(SUB_STATUS) as SubOrderStatus[])
            .filter((k) => k !== s.status)
            .map((k) => (
              <option key={k} value={k}>{SUB_STATUS[k].label}</option>
            ))}
        </select>
        <Btn size="sm" variant="ghost" disabled={!force} onClick={() => force && change(force, true)}>Применить</Btn>
        <span className="grow" />
        <span className="small muted row gap-6"><Clock size={13} /> {relTime(s.updatedAt)}</span>
      </div>
    </div>
  );
}
