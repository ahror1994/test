import { useState } from 'react';
import { Ban, Building2, Coins, Search, Unlock, Users } from 'lucide-react';
import { formatDate } from '@taptym/shared';
import { patch } from '../api';
import { useApi, useDebounced } from '../hooks';
import { Btn, Chip, Empty, ErrorBox, Field, Modal, Money, NumInput, PageHead, TableSkeleton, Tel, initials, useDialog, useToast } from '../ui';

type Customer = {
  id: number;
  name: string;
  phone: string;
  lang: string;
  coins: number;
  isCompany: boolean;
  companyName: string | null;
  banned: boolean;
  ordersCount: number;
  spent: number;
  referralCode: string;
  createdAt: string;
};

const LANG: Record<string, string> = { ru: 'RU', ky: 'KG', uz: 'UZ', kk: 'KZ' };

export default function Customers() {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [filter, setFilter] = useState<'all' | 'company' | 'banned'>('all');
  const [coinsFor, setCoinsFor] = useState<Customer | null>(null);
  const { data, error, loading, reload } = useApi<Customer[]>(`/customers?q=${encodeURIComponent(dq)}`);
  const toast = useToast();
  const dialog = useDialog();

  const rows = data?.filter((c) => (filter === 'company' ? c.isCompany : filter === 'banned' ? c.banned : true));

  const toggleBan = async (c: Customer) => {
    if (!c.banned) {
      const reason = await dialog.prompt({ title: `Заблокировать ${c.name || c.phone}?`, text: 'Покупатель не сможет войти и оформлять заказы.', label: 'Причина', required: true, confirmText: 'Заблокировать', danger: true });
      if (reason === null) return false;
      await patch(`/customers/${c.id}`, { banned: true, reason });
      toast.ok('Покупатель заблокирован');
    } else {
      await patch(`/customers/${c.id}`, { banned: false });
      toast.ok('Покупатель разблокирован');
    }
    reload();
  };

  return (
    <>
      <PageHead title="Покупатели" subtitle="Люди и организации, которые заказывают в приложении" />
      <div className="toolbar">
        <div className="seg" style={{ width: 330 }}>
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>Все</button>
          <button className={filter === 'company' ? 'on' : ''} onClick={() => setFilter('company')}>Юрлица</button>
          <button className={filter === 'banned' ? 'on' : ''} onClick={() => setFilter('banned')}>Заблокированы</button>
        </div>
        <div className="search-box">
          <Search size={17} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя, телефон или компания" />
        </div>
      </div>
      <div className="card">
        {error && !data && <div className="card-pad"><ErrorBox error={error} retry={reload} /></div>}
        {!data && loading && <TableSkeleton rows={8} cols={6} />}
        {rows?.length === 0 && <Empty icon={<Users size={26} />} title="Никого не найдено" />}
        {rows && rows.length > 0 && (
          <div className="table-wrap">
            <table className="table" data-testid="customers-table">
              <thead>
                <tr>
                  <th>Покупатель</th>
                  <th>Телефон</th>
                  <th className="r">Заказов</th>
                  <th className="r">Потратил</th>
                  <th className="r">Монеты</th>
                  <th className="hide-md">С нами с</th>
                  <th className="r">Действия</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className={c.banned ? 'row-muted' : ''}>
                    <td>
                      <div className="row gap-16">
                        <div className="avatar sm">{initials(c.name || '?')}</div>
                        <div>
                          <div className="cell-title row gap-6">
                            {c.name || 'Без имени'}
                            <span className="lang-tag">{LANG[c.lang] ?? c.lang}</span>
                            {c.banned && <Chip tone="danger">Бан</Chip>}
                          </div>
                          {c.isCompany && <div className="cell-sub row gap-4"><Building2 size={12} /> {c.companyName}</div>}
                        </div>
                      </div>
                    </td>
                    <td><Tel phone={c.phone} /></td>
                    <td className="r num">{c.ordersCount}</td>
                    <td className="r"><Money v={c.spent} /></td>
                    <td className="r"><span className="coin-pill num">🪙 {c.coins}</span></td>
                    <td className="hide-md muted">{formatDate(c.createdAt)}</td>
                    <td className="r">
                      <span className="row gap-4" style={{ justifyContent: 'flex-end' }}>
                        <Btn size="sm" variant="soft" icon={<Coins size={14} />} onClick={() => setCoinsFor(c)} data-testid={`coins-${c.id}`}>Монеты</Btn>
                        {c.banned ? (
                          <Btn size="sm" icon={<Unlock size={14} />} onClick={() => toggleBan(c)}>Разбанить</Btn>
                        ) : (
                          <Btn size="sm" variant="ghost" icon={<Ban size={14} />} onClick={() => toggleBan(c)} title="Заблокировать" />
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {coinsFor && (
        <CoinsModal
          c={coinsFor}
          onClose={() => setCoinsFor(null)}
          onDone={() => {
            setCoinsFor(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function CoinsModal({ c, onClose, onDone }: { c: Customer; onClose: () => void; onDone: () => void }) {
  const [sign, setSign] = useState<1 | -1>(1);
  const [n, setN] = useState(50);
  const [reason, setReason] = useState('');
  const toast = useToast();
  const submit = async () => {
    await patch(`/customers/${c.id}`, { coinsDelta: sign * n, reason });
    toast.ok(sign > 0 ? `Начислено ${n} монет` : `Списано ${n} монет`);
    onDone();
  };
  return (
    <Modal
      title={`Монеты · ${c.name || c.phone}`}
      subtitle={`Сейчас на счёте: ${c.coins} монет. 1 монета = 1 сом скидки.`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Отмена</button>
          <Btn variant="primary" disabled={!n || !reason.trim()} onClick={submit} data-testid="coins-submit">{sign > 0 ? 'Начислить' : 'Списать'}</Btn>
        </>
      }
    >
      <div className="col gap-16">
        <div className="seg">
          <button className={sign === 1 ? 'on' : ''} onClick={() => setSign(1)}>+ Начислить</button>
          <button className={sign === -1 ? 'on' : ''} onClick={() => setSign(-1)}>− Списать</button>
        </div>
        <Field label="Количество монет">
          <NumInput value={n} min={1} onChange={setN} suffix="🪙" />
        </Field>
        <div className="row gap-6 wrap">
          {[20, 50, 100, 200].map((v) => (
            <button key={v} className="btn btn-sm" onClick={() => setN(v)}>{v}</button>
          ))}
        </div>
        <Field label="Причина (покупатель увидит в уведомлении)">
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Например: извинения за задержку доставки" data-testid="coins-reason" />
        </Field>
      </div>
    </Modal>
  );
}
