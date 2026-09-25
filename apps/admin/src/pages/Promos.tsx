import { useState } from 'react';
import { Check, Plus, TicketPercent, Trash2, Truck, X } from 'lucide-react';
import { formatDate, formatPrice, type PromoCode } from '@taptym/shared';
import { del, patch, post } from '../api';
import { useAuth } from '../auth';
import { useApi } from '../hooks';
import { FUNDED_BY, PROMO_STATUS, PROMO_TYPE } from '../labels';
import type { AdminSupplier } from '../types';
import { Btn, Chip, Empty, ErrorBox, Field, Modal, NumInput, PageHead, Switch, TableSkeleton, useDialog, useToast } from '../ui';

const promoValue = (p: Pick<PromoCode, 'type' | 'value'>) => (p.type === 'percent' ? `−${p.value}%` : p.type === 'fixed' ? `−${formatPrice(p.value)}` : 'Доставка 0 сом');

export default function Promos() {
  const { data, error, loading, reload } = useApi<PromoCode[]>('/promos');
  const [creating, setCreating] = useState(false);
  const toast = useToast();
  const dialog = useDialog();
  const { refresh } = useAuth();
  const pending = data?.filter((p) => p.status === 'pending') ?? [];
  const rest = data?.filter((p) => p.status !== 'pending') ?? [];

  const setStatus = async (p: PromoCode, status: PromoCode['status']) => {
    await patch(`/promos/${p.id}`, { status });
    toast.ok(status === 'active' ? `Промокод ${p.code} активен` : status === 'rejected' ? `Заявка ${p.code} отклонена` : `Промокод ${p.code} выключен`);
    reload();
    refresh();
  };
  const remove = async (p: PromoCode) => {
    const ok = await dialog.confirm({ title: `Удалить промокод ${p.code}?`, text: 'Код перестанет работать, статистика использования удалится.', confirmText: 'Удалить', danger: true });
    if (!ok) return false;
    await del(`/promos/${p.id}`);
    toast.ok('Промокод удалён');
    reload();
  };

  return (
    <>
      <PageHead
        title="Промокоды"
        subtitle="Скидки площадки и заявки магазинов на собственные промокоды"
        actions={<Btn variant="primary" icon={<Plus size={17} />} onClick={() => setCreating(true)} data-testid="promo-create">Создать промокод</Btn>}
      />
      {error && !data && <ErrorBox error={error} retry={reload} />}
      {pending.length > 0 && (
        <div className="card card-pad mb-20 pending-card">
          <div className="row between">
            <h3 className="h3">Заявки магазинов · {pending.length}</h3>
            <span className="small muted">Магазин просит запустить свой промокод — проверьте условия</span>
          </div>
          <div className="grid g-2 mt-16">
            {pending.map((p) => (
              <div key={p.id} className="promo-req" data-testid={`promo-req-${p.code}`}>
                <div className="row between">
                  <span className="promo-code">{p.code}</span>
                  <b className="promo-val">{promoValue(p)}</b>
                </div>
                <div className="small muted mt-8">
                  {p.supplierName} · {FUNDED_BY[p.fundedBy]}
                  {p.minTotal > 0 && ` · от ${formatPrice(p.minTotal)}`}
                  {p.maxUses > 0 && ` · до ${p.maxUses} раз`}
                  {p.endsAt && ` · до ${formatDate(p.endsAt)}`}
                </div>
                {p.description && <div className="small mt-8">«{p.description}»</div>}
                <div className="row gap-6 mt-16">
                  <Btn size="sm" variant="success" icon={<Check size={15} />} onClick={() => setStatus(p, 'active')} data-testid={`promo-approve-${p.code}`}>Одобрить</Btn>
                  <Btn size="sm" variant="soft-danger" icon={<X size={15} />} onClick={() => setStatus(p, 'rejected')}>Отклонить</Btn>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="card">
        {!data && loading && <TableSkeleton rows={6} cols={6} />}
        {data && rest.length === 0 && <Empty icon={<TicketPercent size={26} />} title="Промокодов пока нет" action={<Btn variant="primary" onClick={() => setCreating(true)}>Создать первый</Btn>} />}
        {rest.length > 0 && (
          <div className="table-wrap">
            <table className="table" data-testid="promos-table">
              <thead>
                <tr>
                  <th>Код</th>
                  <th>Скидка</th>
                  <th className="hide-md">Условия</th>
                  <th>Кто платит</th>
                  <th>Использовано</th>
                  <th>Статус</th>
                  <th className="r">Вкл.</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rest.map((p) => {
                  const pct = p.maxUses ? Math.min(100, (p.used / p.maxUses) * 100) : 0;
                  return (
                    <tr key={p.id} className={p.status !== 'active' ? 'row-muted' : ''}>
                      <td>
                        <span className="promo-code sm">{p.code}</span>
                        {p.description && <div className="cell-sub ellipsis" style={{ maxWidth: 200 }}>{p.description}</div>}
                      </td>
                      <td className="strong nowrap">{p.type === 'free_delivery' && <Truck size={14} style={{ verticalAlign: -2 }} />} {promoValue(p)}</td>
                      <td className="hide-md small">
                        {p.minTotal > 0 ? `от ${formatPrice(p.minTotal)}` : 'любая сумма'} · {p.perUser} на клиента
                        <div className="muted">{p.startsAt || p.endsAt ? `${p.startsAt ? formatDate(p.startsAt) : '…'} — ${p.endsAt ? formatDate(p.endsAt) : '∞'}` : 'бессрочно'}</div>
                      </td>
                      <td className="small">
                        {FUNDED_BY[p.fundedBy]}
                        {p.supplierName && <div className="muted">{p.supplierName}</div>}
                      </td>
                      <td style={{ minWidth: 140 }}>
                        <div className="small num">{p.used}{p.maxUses ? ` / ${p.maxUses}` : ' · без лимита'}</div>
                        {p.maxUses > 0 && <div className="progress mt-4"><div style={{ width: `${pct}%` }} /></div>}
                      </td>
                      <td><Chip tone={PROMO_STATUS[p.status]?.tone}>{PROMO_STATUS[p.status]?.label}</Chip></td>
                      <td className="r">
                        {p.status !== 'rejected' && <Switch on={p.status === 'active'} onChange={(v) => setStatus(p, v ? 'active' : 'disabled')} label="Включён" />}
                      </td>
                      <td className="r"><Btn size="sm" variant="ghost" icon={<Trash2 size={15} />} onClick={() => remove(p)} title="Удалить" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {creating && (
        <CreatePromo
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
    </>
  );
}

function CreatePromo({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { can } = useAuth();
  const suppliers = useApi<AdminSupplier[]>(can('suppliers') ? '/suppliers' : null);
  const [f, setF] = useState({
    code: '',
    type: 'percent' as PromoCode['type'],
    value: 10,
    minTotal: 0,
    maxUses: 100,
    perUser: 1,
    supplierId: 0,
    fundedBy: 'platform' as PromoCode['fundedBy'],
    startsAt: '',
    endsAt: '',
    description: '',
  });
  const toast = useToast();
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const code = f.code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const valid = code.length >= 3 && (f.type === 'free_delivery' || f.value > 0) && !(f.type === 'percent' && f.value > 90);

  const submit = async () => {
    await post('/promos', {
      ...f,
      code,
      supplierId: f.supplierId || null,
      startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null,
      endsAt: f.endsAt ? new Date(f.endsAt + 'T23:59:59').toISOString() : null,
    });
    toast.ok(`Промокод ${code} создан и активен`);
    onDone();
  };

  return (
    <Modal
      title="Новый промокод"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>Отмена</button>
          <Btn variant="primary" disabled={!valid} onClick={submit} data-testid="promo-submit">Создать</Btn>
        </>
      }
    >
      <div className="promo-form">
        <div className="grid g-2 gap-16">
          <Field label="Код" hint="Латиница и цифры, клиент вводит его в корзине">
            <input className="input promo-input" value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="SCHOOL10" autoFocus data-testid="promo-code" />
          </Field>
          <Field label="Тип скидки">
            <select className="select" value={f.type} onChange={(e) => set('type', e.target.value as PromoCode['type'])}>
              {Object.entries(PROMO_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          {f.type !== 'free_delivery' && (
            <Field label="Размер скидки" hint={f.type === 'percent' ? 'Не больше 90%' : undefined}>
              <NumInput value={f.value} min={1} onChange={(v) => set('value', v)} suffix={f.type === 'percent' ? '%' : 'сом'} data-testid="promo-value" />
            </Field>
          )}
          <Field label="Минимальная сумма заказа">
            <NumInput value={f.minTotal} min={0} onChange={(v) => set('minTotal', v)} suffix="сом" />
          </Field>
          <Field label="Всего использований" hint="0 — без ограничений">
            <NumInput value={f.maxUses} min={0} onChange={(v) => set('maxUses', v)} />
          </Field>
          <Field label="На одного покупателя">
            <NumInput value={f.perUser} min={1} onChange={(v) => set('perUser', v)} />
          </Field>
          <Field label="Только для магазина" hint="Пусто — действует на все магазины">
            <select className="select" value={f.supplierId} onChange={(e) => set('supplierId', Number(e.target.value))}>
              <option value={0}>Все магазины</option>
              {suppliers.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Кто оплачивает скидку">
            <select className="select" value={f.fundedBy} onChange={(e) => set('fundedBy', e.target.value as PromoCode['fundedBy'])}>
              {Object.entries(FUNDED_BY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Начало">
            <input className="input" type="date" value={f.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
          </Field>
          <Field label="Окончание">
            <input className="input" type="date" value={f.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
          </Field>
          <Field label="Описание для покупателя" className="span-2">
            <input className="input" value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Скидка к 1 сентября на всё для школы" />
          </Field>
        </div>
        <div className="promo-preview">
          <div className="panel-label">Как увидит покупатель</div>
          <div className="ticket">
            <div className="ticket-val">{promoValue(f)}</div>
            <div className="ticket-code">{code || 'КОД'}</div>
            <div className="small">{f.description || 'Промокод Taptym'}</div>
            <div className="small ticket-cond">{f.minTotal > 0 ? `При заказе от ${formatPrice(f.minTotal)}` : 'На любой заказ'}</div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
