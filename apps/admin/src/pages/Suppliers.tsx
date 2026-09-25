import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Plus, Search, Store, X } from 'lucide-react';
import { formatDate, formatPrice } from '@taptym/shared';
import { patch, post } from '../api';
import { useAuth } from '../auth';
import { useApi, useDebounced } from '../hooks';
import { SERVICE_TYPE } from '../labels';
import type { AdminSupplier } from '../types';
import { Btn, Chip, Empty, ErrorBox, Field, Modal, Money, PageHead, TableSkeleton, Tel, useDialog, useToast } from '../ui';

export function SupplierStatusChips({ s }: { s: Pick<AdminSupplier, 'status' | 'inTrial' | 'trialUntil'> }) {
  return (
    <span className="row gap-4 wrap">
      {s.status === 'active' && <Chip tone="success">Активен</Chip>}
      {s.status === 'banned' && <Chip tone="danger">Заблокирован</Chip>}
      {s.status === 'paused' && <Chip tone="neutral">Пауза</Chip>}
      {s.inTrial && s.trialUntil && <Chip tone="primary" plain>Пробный до {formatDate(s.trialUntil)}</Chip>}
    </span>
  );
}

type PendingService = { id: number; supplier_id: number; supplier_name: string; type: string; title: string; price: number; status: string };

export default function Suppliers() {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const { data, error, loading, reload } = useApi<AdminSupplier[]>(`/suppliers?q=${encodeURIComponent(dq)}`);
  const services = useApi<PendingService[]>('/services');
  const pending = services.data?.filter((s) => s.status === 'pending') ?? [];
  const { refresh } = useAuth();
  const toast = useToast();
  const dialog = useDialog();

  const setService = async (s: PendingService, status: 'active' | 'cancelled') => {
    if (status === 'cancelled') {
      const ok = await dialog.confirm({ title: `Отклонить «${s.title}»?`, text: s.price ? `Магазину вернётся ${formatPrice(s.price)} на баланс.` : undefined, confirmText: 'Отклонить', danger: true });
      if (!ok) return false;
    }
    await patch(`/services/${s.id}`, { status });
    toast.ok(status === 'active' ? 'Услуга подключена' : 'Услуга отменена, деньги возвращены');
    services.reload();
    refresh();
  };

  return (
    <>
      <PageHead
        title="Поставщики"
        subtitle="Магазины канцтоваров, подключённые к площадке"
        actions={
          <Btn variant="primary" icon={<Plus size={17} />} onClick={() => setCreating(true)} data-testid="supplier-create">
            Добавить магазин
          </Btn>
        }
      />
      {pending.length > 0 && (
        <div className={`card card-pad mb-20 ${sp.get('services') ? 'ring' : ''}`}>
          <div className="row between">
            <h3 className="h3">Услуги ждут одобрения · {pending.length}</h3>
            <span className="small muted">Баннеры и загрузка каталога, оплаченные магазинами</span>
          </div>
          <div className="mt-8">
            {pending.map((s) => (
              <div key={s.id} className="list-row">
                <Chip tone="warning" plain>{SERVICE_TYPE[s.type] ?? s.type}</Chip>
                <div className="grow">
                  <b>{s.title}</b>
                  <div className="small muted">
                    <a onClick={() => nav(`/suppliers/${s.supplier_id}`)} className="link">{s.supplier_name}</a> · {formatPrice(s.price)}
                  </div>
                </div>
                <Btn size="sm" variant="success" icon={<Check size={15} />} onClick={() => setService(s, 'active')}>Одобрить</Btn>
                <Btn size="sm" variant="soft-danger" icon={<X size={15} />} onClick={() => setService(s, 'cancelled')}>Отклонить</Btn>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="toolbar">
        <div className="search-box">
          <Search size={17} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название или телефон магазина" />
        </div>
        <span className="muted small">{data ? `${data.length} магазинов` : ''}</span>
      </div>
      <div className="card">
        {error && !data && <div className="card-pad"><ErrorBox error={error} retry={reload} /></div>}
        {!data && loading && <TableSkeleton rows={6} cols={7} />}
        {data?.length === 0 && <Empty icon={<Store size={26} />} title="Магазинов не найдено" />}
        {data && data.length > 0 && (
          <div className="table-wrap">
            <table className="table clickable" data-testid="suppliers-table">
              <thead>
                <tr>
                  <th>Магазин</th>
                  <th>Телефон</th>
                  <th>Статус</th>
                  <th className="r hide-md">Предложений</th>
                  <th className="r hide-md">Заказов</th>
                  <th className="r">Выручка</th>
                  <th className="r">Баланс</th>
                </tr>
              </thead>
              <tbody>
                {data.map((s) => (
                  <tr key={s.id} onClick={() => nav(`/suppliers/${s.id}`)}>
                    <td>
                      <div className="row gap-16">
                        <span className="emoji-badge" style={{ background: s.color }}>{s.logoEmoji}</span>
                        <div>
                          <div className="cell-title">{s.name}</div>
                          <div className="cell-sub">★ {s.rating.toFixed(1)} · {s.address}</div>
                        </div>
                      </div>
                    </td>
                    <td><Tel phone={s.phone} /></td>
                    <td><SupplierStatusChips s={s} /></td>
                    <td className="r num hide-md">{s.offers}</td>
                    <td className="r num hide-md">{s.orders}</td>
                    <td className="r"><Money v={s.revenue} /></td>
                    <td className="r"><Money v={s.balance} className="strong" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {creating && (
        <CreateSupplier
          onClose={() => setCreating(false)}
          onDone={(id) => {
            setCreating(false);
            nav(`/suppliers/${id}`);
          }}
        />
      )}
    </>
  );
}

function CreateSupplier({ onClose, onDone }: { onClose: () => void; onDone: (id: number) => void }) {
  const [f, setF] = useState({ name: '', phone: '+996', ownerName: '', address: 'Ош, ', logoEmoji: '🏪' });
  const toast = useToast();
  const valid = f.name.trim().length > 1 && f.phone.replace(/\D/g, '').length >= 12;
  const submit = async () => {
    const r = await post<{ id: number }>('/suppliers', f);
    toast.ok('Магазин добавлен — пробный период включён');
    onDone(r.id);
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal
      title="Новый магазин"
      subtitle="Владелец войдёт в приложение «Taptym Бизнес» по этому номеру через SMS-код"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Отмена</button>
          <Btn variant="primary" disabled={!valid} onClick={submit} data-testid="supplier-create-submit">Создать</Btn>
        </>
      }
    >
      <div className="grid g-2 gap-16">
        <Field label="Название магазина" className="span-2">
          <input className="input" value={f.name} onChange={set('name')} placeholder="Канцтовары «Радуга»" autoFocus />
        </Field>
        <Field label="Телефон владельца" hint="Формат +996 XXX XXX XXX">
          <input className="input num" value={f.phone} onChange={set('phone')} />
        </Field>
        <Field label="Имя владельца">
          <input className="input" value={f.ownerName} onChange={set('ownerName')} placeholder="Азамат" />
        </Field>
        <Field label="Адрес" className="span-2">
          <input className="input" value={f.address} onChange={set('address')} />
        </Field>
        <Field label="Эмодзи-логотип">
          <div className="emoji-pick">
            {['🏪', '📚', '✏️', '🎒', '🖍️', '📎', '🗂️', '🧮'].map((e) => (
              <button key={e} type="button" className={f.logoEmoji === e ? 'on' : ''} onClick={() => setF({ ...f, logoEmoji: e })}>{e}</button>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
