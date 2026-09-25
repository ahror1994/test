import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, CalendarPlus, Check, Pause, Play, Scale, Star, Wallet, X } from 'lucide-react';
import { formatDate, formatDateTime, formatPrice, type PayoutBreakdown } from '@taptym/shared';
import { patch, post } from '../api';
import { useAuth } from '../auth';
import { useApi } from '../hooks';
import { LEDGER_TYPE, PAYOUT_METHOD, PAYOUT_STATUS, SERVICE_STATUS, SERVICE_TYPE, SUPPLIER_ROLE } from '../labels';
import type { AdminSupplier } from '../types';
import { BreakdownTable } from '../components/Breakdown';
import { SupplierStatusChips } from './Suppliers';
import { Btn, Chip, Empty, ErrorBox, Field, Modal, Money, NumInput, PageHead, Skeleton, Tel, UTabs, useDialog, useToast } from '../ui';

type Detail = AdminSupplier & {
  description: string;
  breakdown: PayoutBreakdown;
  services: { id: number; type: string; title: string; price: number; starts_at: string; ends_at: string | null; status: string }[];
  staff: { id: number; name: string; phone: string; role: string; active: number }[];
  ledger: { id: number; type: string; amount: number; note: string; created_at: string }[];
  payouts: { id: number; amount: number; method: string; details: string; status: string; created_at: string; comment: string }[];
};

type Tab = 'overview' | 'finance' | 'services' | 'staff';

export default function SupplierDetail() {
  const { id } = useParams();
  const { data: s, error, reload } = useApi<Detail>(`/suppliers/${id}`);
  const [tab, setTab] = useState<Tab>('overview');
  const [adjusting, setAdjusting] = useState(false);
  const toast = useToast();
  const dialog = useDialog();
  const { can, refresh } = useAuth();

  if (error && !s) return <ErrorBox error={error} retry={reload} />;
  if (!s)
    return (
      <div className="col gap-16">
        <Skeleton h={80} r={20} />
        <div className="grid g-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={110} r={20} />)}</div>
        <Skeleton h={300} r={20} />
      </div>
    );

  const setStatus = async (status: 'active' | 'banned' | 'paused') => {
    let reason = '';
    if (status === 'banned') {
      const r = await dialog.prompt({
        title: `Заблокировать «${s.name}»?`,
        text: 'Товары магазина пропадут из каталога, сотрудники будут разлогинены.',
        label: 'Причина блокировки',
        placeholder: 'Например: жалобы покупателей на качество',
        required: true,
        multiline: true,
        confirmText: 'Заблокировать',
        danger: true,
      });
      if (r === null) return false;
      reason = r;
    } else if (status === 'paused') {
      const ok = await dialog.confirm({ title: 'Поставить магазин на паузу?', text: 'Товары временно скроются из каталога. Можно вернуть в любой момент.', confirmText: 'Пауза' });
      if (!ok) return false;
    }
    await patch(`/suppliers/${s.id}`, { status, reason });
    toast.ok(status === 'active' ? 'Магазин активен' : status === 'banned' ? 'Магазин заблокирован' : 'Магазин на паузе');
    reload();
  };

  const extendTrial = async () => {
    const base = s.trialUntil && new Date(s.trialUntil) > new Date() ? new Date(s.trialUntil) : new Date();
    const next = new Date(base.getTime() + 30 * 86400_000).toISOString();
    await patch(`/suppliers/${s.id}`, { trialUntil: next });
    toast.ok(`Пробный период продлён до ${formatDate(next)}`);
    reload();
  };

  const endTrial = async () => {
    const ok = await dialog.confirm({ title: 'Завершить пробный период?', text: 'С этого момента с продаж магазина начнёт удерживаться комиссия.', confirmText: 'Завершить' });
    if (!ok) return false;
    await patch(`/suppliers/${s.id}`, { trialUntil: null });
    toast.ok('Пробный период завершён');
    reload();
  };

  const setService = async (svc: Detail['services'][number], status: 'active' | 'finished' | 'cancelled') => {
    if (status === 'cancelled') {
      const ok = await dialog.confirm({ title: `Отменить «${svc.title}»?`, text: svc.price ? `Магазину вернётся ${formatPrice(svc.price)} на баланс.` : 'Услуга будет отменена.', confirmText: 'Отменить услугу', danger: true });
      if (!ok) return false;
    }
    await patch(`/services/${svc.id}`, { status });
    toast.ok(status === 'active' ? 'Услуга подключена' : status === 'cancelled' ? 'Услуга отменена, деньги возвращены' : 'Услуга завершена');
    reload();
    refresh();
  };

  const pendingServices = s.services.filter((x) => x.status === 'pending').length;

  return (
    <>
      <PageHead
        back={<Link to="/suppliers" className="back-link"><ArrowLeft size={15} /> Поставщики</Link>}
        title={
          <span className="row gap-16">
            <span className="emoji-badge xl" style={{ background: s.color }}>{s.logoEmoji}</span>
            <span>
              {s.name}
              <div className="mt-8"><SupplierStatusChips s={s} /></div>
            </span>
          </span>
        }
        actions={
          <>
            {s.status !== 'active' && <Btn variant="success" icon={<Play size={16} />} onClick={() => setStatus('active')} data-testid="supplier-unban">{s.status === 'banned' ? 'Разблокировать' : 'Возобновить'}</Btn>}
            {s.status === 'active' && <Btn icon={<Pause size={16} />} onClick={() => setStatus('paused')}>Пауза</Btn>}
            {s.status !== 'banned' && <Btn variant="soft-danger" icon={<Ban size={16} />} onClick={() => setStatus('banned')} data-testid="supplier-ban">Заблокировать</Btn>}
          </>
        }
      />
      {s.status === 'banned' && s.banReason && (
        <div className="callout danger mb-20"><Ban size={18} /><div><b>Причина блокировки:</b> {s.banReason}</div></div>
      )}

      <div className="grid g-4 mb-20">
        <MiniStat label="Баланс к выплате" value={formatPrice(s.balance)} accent />
        <MiniStat label="Выручка (доставлено)" value={formatPrice(s.revenue)} />
        <MiniStat label="Заказов" value={String(s.orders)} />
        <MiniStat label="Предложений в каталоге" value={String(s.offers)} />
      </div>

      <UTabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'overview', label: 'Обзор' },
          { id: 'finance', label: 'Финансы' },
          { id: 'services', label: 'Услуги', count: pendingServices },
          { id: 'staff', label: 'Сотрудники' },
        ]}
      />

      <div className="mt-24">
        {tab === 'overview' && (
          <div className="grid g-2">
            <div className="card card-pad">
              <h3 className="h3">Контакты и реквизиты</h3>
              <dl className="kv mt-16">
                <dt>Телефон</dt><dd><Tel phone={s.phone} /></dd>
                <dt>Адрес</dt><dd>{s.address}</dd>
                <dt>Юр. название</dt><dd>{s.legalName || '—'}</dd>
                <dt>ИНН</dt><dd className="num">{s.inn || '—'}</dd>
                <dt>Реквизиты выплат</dt><dd>{s.payoutDetails || '—'}</dd>
                <dt>Своя доставка</dt><dd>{s.ownDelivery ? `Да, ${formatPrice(s.ownDeliveryFee)}` : 'Нет'}</dd>
                <dt>Наличные</dt><dd>{s.acceptsCash ? 'Принимает' : 'Не принимает'}</dd>
                <dt>На площадке с</dt><dd>{formatDate(s.createdAt)}</dd>
              </dl>
              {s.description && <p className="muted mt-16">{s.description}</p>}
            </div>
            <div className="col gap-20">
              <div className="card card-pad">
                <div className="row between">
                  <h3 className="h3">Пробный период</h3>
                  {s.inTrial ? <Chip tone="primary">Без комиссии</Chip> : <Chip tone="neutral">Обычный тариф</Chip>}
                </div>
                <p className="muted mt-8">
                  {s.inTrial && s.trialUntil
                    ? `Действует до ${formatDate(s.trialUntil)} — осталось ${Math.max(0, Math.ceil((new Date(s.trialUntil).getTime() - Date.now()) / 86400_000))} дн. Комиссия не удерживается.`
                    : 'Пробный период закончился — с продаж удерживается комиссия площадки.'}
                </p>
                <div className="row gap-6 mt-16 wrap">
                  <Btn variant="soft" icon={<CalendarPlus size={16} />} onClick={extendTrial} data-testid="extend-trial">Продлить на 30 дней</Btn>
                  {s.inTrial && <Btn variant="ghost" onClick={endTrial}>Завершить сейчас</Btn>}
                </div>
              </div>
              <RatingCard s={s} onSaved={reload} />
            </div>
          </div>
        )}

        {tab === 'finance' && (
          <div className="grid fin-grid">
            <div className="card card-pad">
              <div className="row between">
                <h3 className="h3">Расчёт баланса</h3>
                {can('payouts') && <Btn size="sm" icon={<Scale size={15} />} onClick={() => setAdjusting(true)} data-testid="adjust-open">Корректировка</Btn>}
              </div>
              <div className="mt-16"><BreakdownTable b={s.breakdown} /></div>
            </div>
            <div className="col gap-20">
              <div className="card">
                <div className="card-head"><h3>Выплаты</h3>{can('payouts') && <Link className="small" to="/payouts">Очередь выплат →</Link>}</div>
                {s.payouts.length === 0 ? <Empty icon={<Wallet size={24} />} title="Выплат ещё не было" /> : (
                  <div className="table-wrap mt-8">
                    <table className="table compact">
                      <thead><tr><th>Дата</th><th>Способ</th><th className="r">Сумма</th><th>Статус</th></tr></thead>
                      <tbody>
                        {s.payouts.map((p) => (
                          <tr key={p.id}>
                            <td className="muted nowrap">{formatDateTime(p.created_at)}</td>
                            <td>{PAYOUT_METHOD[p.method] ?? p.method}</td>
                            <td className="r"><Money v={p.amount} className="strong" /></td>
                            <td><Chip tone={PAYOUT_STATUS[p.status]?.tone}>{PAYOUT_STATUS[p.status]?.label}</Chip></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="card">
                <div className="card-head"><h3>Движение денег</h3><span className="sub">последние 100 операций</span></div>
                {s.ledger.length === 0 ? <Empty title="Операций нет" /> : (
                  <div className="table-wrap mt-8" style={{ maxHeight: 460, overflowY: 'auto' }}>
                    <table className="table compact" data-testid="ledger">
                      <thead><tr><th>Дата</th><th>Тип</th><th>Описание</th><th className="r">Сумма</th></tr></thead>
                      <tbody>
                        {s.ledger.map((l) => (
                          <tr key={l.id}>
                            <td className="muted nowrap">{formatDateTime(l.created_at).slice(0, 5)} {formatDateTime(l.created_at).slice(11)}</td>
                            <td><Chip plain tone={l.amount >= 0 ? 'success' : 'neutral'}>{LEDGER_TYPE[l.type] ?? l.type}</Chip></td>
                            <td><div className="ellipsis" style={{ maxWidth: 200 }} title={l.note}>{l.note}</div></td>
                            <td className="r"><Money v={l.amount} signed /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'services' && (
          <div className="card">
            {s.services.length === 0 ? <Empty title="Магазин не подключал услуги" text="Баннеры, топ в поиске и загрузка каталога появятся здесь." /> : (
              <div className="table-wrap">
                <table className="table" data-testid="services-table">
                  <thead><tr><th>Услуга</th><th>Тип</th><th>Период</th><th className="r">Цена</th><th>Статус</th><th className="r">Действия</th></tr></thead>
                  <tbody>
                    {s.services.map((x) => (
                      <tr key={x.id} className={x.status === 'pending' ? 'row-warn' : ''}>
                        <td className="strong">{x.title}</td>
                        <td>{SERVICE_TYPE[x.type] ?? x.type}</td>
                        <td className="muted nowrap">{formatDate(x.starts_at)}{x.ends_at ? ` — ${formatDate(x.ends_at)}` : ''}</td>
                        <td className="r"><Money v={x.price} /></td>
                        <td><Chip tone={SERVICE_STATUS[x.status]?.tone}>{SERVICE_STATUS[x.status]?.label ?? x.status}</Chip></td>
                        <td className="r">
                          <span className="row gap-4" style={{ justifyContent: 'flex-end' }}>
                            {x.status === 'pending' && <Btn size="sm" variant="success" icon={<Check size={14} />} onClick={() => setService(x, 'active')} data-testid={`approve-service-${x.id}`}>Одобрить</Btn>}
                            {x.status === 'active' && <Btn size="sm" variant="ghost" onClick={() => setService(x, 'finished')}>Завершить</Btn>}
                            {(x.status === 'pending' || x.status === 'active') && <Btn size="sm" variant="soft-danger" icon={<X size={14} />} onClick={() => setService(x, 'cancelled')}>Отменить</Btn>}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'staff' && (
          <div className="card">
            {s.staff.length === 0 ? <Empty title="Нет сотрудников" /> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Имя</th><th>Телефон</th><th>Роль</th><th>Статус</th></tr></thead>
                  <tbody>
                    {s.staff.map((m) => (
                      <tr key={m.id}>
                        <td className="strong">{m.name}</td>
                        <td><Tel phone={m.phone} /></td>
                        <td>{SUPPLIER_ROLE[m.role] ?? m.role}</td>
                        <td>{m.active ? <Chip tone="success">Активен</Chip> : <Chip>Отключён</Chip>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="card-pad small muted">Сотрудниками магазина управляет владелец в приложении «Taptym Бизнес».</div>
          </div>
        )}
      </div>

      {adjusting && (
        <AdjustModal
          supplierId={s.id}
          balance={s.balance}
          onClose={() => setAdjusting(false)}
          onDone={() => {
            setAdjusting(false);
            reload();
          }}
        />
      )}
    </>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`card kpi ${accent ? 'hero' : ''}`}>
      <div className="k-label">{label}</div>
      <div className="k-value" style={{ fontSize: 24, marginTop: 8 }}>{value}</div>
    </div>
  );
}

function RatingCard({ s, onSaved }: { s: Detail; onSaved: () => void }) {
  const [r, setR] = useState(s.rating);
  const toast = useToast();
  return (
    <div className="card card-pad">
      <h3 className="h3">Рейтинг магазина</h3>
      <p className="muted mt-8">Влияет на порядок в выдаче. Считается по отзывам, можно поправить вручную.</p>
      <div className="row gap-16 mt-16">
        <div className="stars">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} size={22} fill={i <= Math.round(r) ? '#FFB800' : 'none'} color={i <= Math.round(r) ? '#FFB800' : '#D0D3DE'} onClick={() => setR(i)} style={{ cursor: 'pointer' }} />
          ))}
        </div>
        <div style={{ width: 110 }}><NumInput value={r} step={0.1} min={0} max={5} onChange={(v) => setR(Math.min(5, Math.max(0, v)))} /></div>
        <Btn
          size="sm"
          disabled={r === s.rating}
          onClick={async () => {
            await patch(`/suppliers/${s.id}`, { rating: Math.round(r * 10) / 10 });
            toast.ok('Рейтинг сохранён');
            onSaved();
          }}
        >
          Сохранить
        </Btn>
      </div>
    </div>
  );
}

function AdjustModal({ supplierId, balance, onClose, onDone }: { supplierId: number; balance: number; onClose: () => void; onDone: () => void }) {
  const [sign, setSign] = useState<1 | -1>(1);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const toast = useToast();
  const submit = async () => {
    await post(`/suppliers/${supplierId}/adjust`, { amount: sign * amount, note });
    toast.ok('Баланс скорректирован');
    onDone();
  };
  return (
    <Modal
      title="Корректировка баланса"
      subtitle="Запись попадёт в историю операций магазина с вашим именем"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Отмена</button>
          <Btn variant="primary" disabled={!amount || !note.trim()} onClick={submit} data-testid="adjust-submit">Провести</Btn>
        </>
      }
    >
      <div className="col gap-16">
        <div className="seg">
          <button className={sign === 1 ? 'on' : ''} onClick={() => setSign(1)}>+ Начислить магазину</button>
          <button className={sign === -1 ? 'on' : ''} onClick={() => setSign(-1)}>− Списать с магазина</button>
        </div>
        <Field label="Сумма">
          <NumInput value={amount} min={0} onChange={setAmount} suffix="сом" data-testid="adjust-amount" />
        </Field>
        <Field label="Комментарий (обязательно)">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Например: компенсация за доставку" data-testid="adjust-note" />
        </Field>
        <div className="callout primary">
          Баланс: <b className="num">{formatPrice(balance)}</b> → <b className="num">{formatPrice(balance + sign * amount)}</b>
        </div>
      </div>
    </Modal>
  );
}
