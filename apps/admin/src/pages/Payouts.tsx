import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Banknote, CheckCircle2, Copy, CreditCard, Landmark, PhoneCall, Send, Wallet, XCircle } from 'lucide-react';
import { formatDateTime, formatPrice, type PayoutBreakdown } from '@taptym/shared';
import { post } from '../api';
import { useAuth } from '../auth';
import { useApi } from '../hooks';
import { PAYOUT_METHOD, PAYOUT_STATUS } from '../labels';
import type { AdminPayout } from '../types';
import { BreakdownTable } from '../components/Breakdown';
import { Btn, Chip, Empty, ErrorBox, Modal, PageHead, Skeleton, Tabs, Tel, relTime, useDialog, useToast } from '../ui';

type Status = AdminPayout['status'];
const METHOD_ICON = { mbank: CreditCard, bank_account: Landmark, cash: Banknote } as const;

export default function Payouts() {
  const [tab, setTab] = useState<Status>('requested');
  const [paid, setPaid] = useState<Paid | null>(null);
  const { refresh } = useAuth();
  const closePaid = () => {
    setPaid(null);
    reload();
    refresh();
  };
  const { data, error, loading, reload } = useApi<AdminPayout[]>('/payouts', { poll: 20000 });
  const count = (s: Status) => data?.filter((p) => p.status === s).length ?? 0;
  const list = data?.filter((p) => p.status === tab) ?? [];
  const totalOpen = data?.filter((p) => p.status === 'requested' || p.status === 'confirmed').reduce((a, p) => a + p.amount, 0) ?? 0;

  return (
    <>
      <PageHead
        title="Выплаты поставщикам"
        subtitle="Система сама считает, сколько можно выплатить: продажи минус комиссия, реклама, услуги и наличные на руках у магазина"
        actions={data && totalOpen > 0 ? <div className="head-stat">В очереди <b className="num">{formatPrice(totalOpen)}</b></div> : null}
      />
      <div className="toolbar">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { id: 'requested', label: 'Новые запросы', count: count('requested') },
            { id: 'confirmed', label: 'Подтверждены', count: count('confirmed') },
            { id: 'paid', label: 'Выплачены' },
            { id: 'rejected', label: 'Отклонены' },
          ]}
        />
      </div>
      {error && !data && <ErrorBox error={error} retry={reload} />}
      {!data && loading && (
        <div className="col gap-20">
          <Skeleton h={380} r={24} />
          <Skeleton h={380} r={24} />
        </div>
      )}
      {data && list.length === 0 && (
        <div className="card">
          <Empty
            icon={<Wallet size={26} />}
            title={tab === 'requested' ? 'Новых запросов нет' : tab === 'confirmed' ? 'Нет подтверждённых выплат' : 'Пусто'}
            text={tab === 'requested' ? 'Когда магазин запросит выплату в приложении, запрос появится здесь.' : undefined}
          />
        </div>
      )}
      <div className="col gap-20">
        {list.map((p) => (
          <PayoutCard key={p.id} p={p} onChanged={reload} onPaid={setPaid} />
        ))}
      </div>
      {paid && (
        <Modal
          title="Выплата отправлена"
          onClose={closePaid}
          footer={
            <button
              className="btn btn-primary"
              onClick={closePaid}
              data-testid="paid-ok"
            >
              Готово
            </button>
          }
        >
          <div className="col gap-16" style={{ alignItems: 'center', textAlign: 'center' }}>
            <CheckCircle2 size={56} color="#12B76A" />
            <div>
              <div className="payout-amount num">{formatPrice(paid.payout.amount)}</div>
              <div className="muted">{paid.payout.supplierName} · {PAYOUT_METHOD[paid.payout.method]}</div>
            </div>
            <div className="ref-box">
              Номер операции: <b className="num" data-testid="paid-ref">{paid.reference || '—'}</b>
            </div>
            {paid.demo && (
              <div className="callout warn" style={{ textAlign: 'left' }}>
                <AlertTriangle size={18} />
                <div>
                  <b>Демо-режим.</b> API банка ещё не подключён, поэтому реальный перевод не выполнялся — выплата только записана в учёт. Переведите деньги вручную или подключите MBank в разделе «Интеграции».
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

function hasSnapshot(b: Partial<PayoutBreakdown>): b is PayoutBreakdown {
  return typeof b.available === 'number' && typeof b.sales === 'number';
}

type Paid = { reference: string; demo: boolean; payout: AdminPayout };

function PayoutCard({ p, onChanged, onPaid }: { p: AdminPayout; onChanged: () => void; onPaid: (r: Paid) => void }) {
  const toast = useToast();
  const dialog = useDialog();
  const { refresh, can } = useAuth();
  const open = p.status === 'requested' || p.status === 'confirmed';
  // Open requests are judged against the live balance; closed ones show the snapshot taken at request time.
  const b = open || !hasSnapshot(p.breakdown) ? p.currentBreakdown : p.breakdown;
  const services = open ? p.activeServices : p.services.length ? p.services : p.activeServices;
  const keepCommission = Math.abs(Math.min(0, b.commission));
  const keepServices = Math.abs(Math.min(0, b.promotions + b.services));
  const toPay = Math.max(0, Math.min(p.amount, b.available));
  const over = open && p.amount > b.available;
  const MIcon = METHOD_ICON[p.method as keyof typeof METHOD_ICON] ?? Wallet;

  const done = () => {
    onChanged();
    refresh();
  };

  const confirm = async () => {
    const c = await dialog.prompt({
      title: 'Подтвердить выплату',
      text: `Вы позвонили ${p.supplierName} и уточнили сумму ${formatPrice(p.amount)} и реквизиты?`,
      label: 'Комментарий',
      defaultValue: 'Позвонил, подтверждено по телефону',
      confirmText: 'Подтверждаю',
    });
    if (c === null) return false;
    await post(`/payouts/${p.id}/confirm`, { comment: c });
    toast.ok('Выплата подтверждена — магазин получил уведомление');
    done();
  };

  const pay = async () => {
    const ok = await dialog.confirm({
      title: `Выплатить ${formatPrice(p.amount)}?`,
      text: (
        <>
          Деньги будут отправлены: <b>{PAYOUT_METHOD[p.method]}</b> — {p.details}. Сумма спишется с баланса магазина.
        </>
      ),
      confirmText: 'Выплатить',
    });
    if (!ok) return false;
    const r = await post<AdminPayout>(`/payouts/${p.id}/pay`, {});
    const reference = r.comment.split(' ').pop() ?? '';
    onPaid({ reference, demo: reference.startsWith('DEMO-'), payout: p });
  };

  const reject = async () => {
    const c = await dialog.prompt({ title: 'Отклонить запрос на выплату?', label: 'Причина (магазин увидит её)', placeholder: 'Например: неверные реквизиты, свяжитесь с нами', required: true, multiline: true, confirmText: 'Отклонить', danger: true });
    if (c === null) return false;
    await post(`/payouts/${p.id}/reject`, { comment: c });
    toast.ok('Запрос отклонён');
    done();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(p.details);
      toast.ok('Реквизиты скопированы');
    } catch {
      toast.error(new Error('Не удалось скопировать'));
    }
  };

  return (
    <div className={`card payout ${over ? 'over' : ''}`} data-testid={`payout-${p.id}`}>
      <div className="payout-head">
        <div className="row gap-16">
          <div className="avatar lg">{p.supplierName.slice(0, 1)}</div>
          <div>
            {can('suppliers') ? <Link to={`/suppliers/${p.supplierId}`} className="payout-name">{p.supplierName}</Link> : <span className="payout-name">{p.supplierName}</span>}
            <div className="row gap-6 mt-4 wrap">
              <Tel phone={p.supplierPhone} />
              <span className="small muted">Запрос #{p.id} · {relTime(p.createdAt)}</span>
            </div>
          </div>
        </div>
        <Chip tone={PAYOUT_STATUS[p.status]?.tone}>{PAYOUT_STATUS[p.status]?.label}</Chip>
      </div>

      <div className="payout-body">
        <div className="payout-left">
          <div className="panel-label">Запрошено</div>
          <div className="payout-amount num">{formatPrice(p.amount)}</div>
          <div className="method-box mt-16">
            <span className="k-icon"><MIcon size={18} /></span>
            <div className="grow" style={{ minWidth: 0 }}>
              <b>{PAYOUT_METHOD[p.method] ?? p.method}</b>
              <div className="small muted" style={{ overflowWrap: 'anywhere' }}>{p.details}</div>
            </div>
            <Btn size="sm" variant="ghost" icon={<Copy size={14} />} onClick={copy} title="Скопировать реквизиты" />
          </div>
          <div className="panel-label mt-24">Подключённые платные услуги</div>
          {services.length === 0 ? (
            <div className="small muted">Нет активных услуг</div>
          ) : (
            <div className="svc-list">
              {services.map((s, i) => (
                <div key={i} className="row between small">
                  <span>{s.name}</span>
                  <b className="num">{formatPrice(s.amount)}</b>
                </div>
              ))}
            </div>
          )}
          {p.comment && (
            <>
              <div className="panel-label mt-24">Комментарий</div>
              <div className="small">{p.comment}</div>
            </>
          )}
          {p.processedAt && <div className="small muted mt-8">Обработано {formatDateTime(p.processedAt)}</div>}
        </div>

        <div className="payout-right">
          <div className="row between">
            <div className="panel-label">Автоматический расчёт · {open ? 'по текущему балансу' : hasSnapshot(p.breakdown) ? 'на момент запроса' : 'текущий баланс'}</div>
          </div>
          <BreakdownTable b={b} />
          <div className={`verdict ${over ? 'warn' : ''}`} data-testid={`verdict-${p.id}`}>
            <div>
              <div className="v-label">К выплате</div>
              <div className="v-amount num">{formatPrice(open ? toPay : p.amount)}</div>
            </div>
            <div className="v-keep">
              Останется у площадки:
              <br />
              комиссия <b className="num">{formatPrice(keepCommission)}</b> + услуги <b className="num">{formatPrice(keepServices)}</b>
            </div>
          </div>
          {over && (
            <div className="callout danger mt-8">
              <AlertTriangle size={18} />
              <div>
                Запрошено больше, чем доступно, на <b className="num">{formatPrice(p.amount - b.available)}</b>. Выплатить можно не больше {formatPrice(Math.max(0, b.available))} — отклоните запрос и попросите магазин запросить меньшую сумму.
              </div>
            </div>
          )}
        </div>
      </div>

      {open && (
        <div className="payout-actions">
          <Btn variant="soft-danger" icon={<XCircle size={16} />} onClick={reject} data-testid={`reject-${p.id}`}>Отклонить</Btn>
          <span className="grow" />
          {p.status === 'requested' && (
            <Btn icon={<PhoneCall size={16} />} onClick={confirm} data-testid={`confirm-${p.id}`}>Позвонил, подтверждаю</Btn>
          )}
          <Btn variant="success" icon={<Send size={16} />} onClick={pay} disabled={over} data-testid={`pay-${p.id}`}>
            Выплатить {formatPrice(p.amount)}
          </Btn>
        </div>
      )}

    </div>
  );
}
