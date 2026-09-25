import { useState } from 'react';
import { Bell, CheckCircle2, CreditCard, Eye, EyeOff, Landmark, Lock, MessageCircle, MessageSquareText, Plug, Receipt, Send, Server, Truck, type LucideIcon } from 'lucide-react';
import { formatDateTime } from '@taptym/shared';
import { put } from '../api';
import { useApi } from '../hooks';
import { Btn, Chip, Empty, ErrorBox, Field, PageHead, Skeleton, useToast } from '../ui';

type Integration = {
  id: string;
  title: string;
  description: string;
  fields: { key: string; label: string; env: string; secret?: boolean }[];
  configured: boolean;
  values: Record<string, { value: string; fromEnv: boolean; set: boolean }>;
};
type LogRow = { id: number; integration: string; action: string; demo: number; payload: string; created_at: string };

function iconFor(i: Pick<Integration, 'id' | 'title'>): { icon: LucideIcon; color: string } {
  const t = `${i.id} ${i.title}`.toLowerCase();
  if (t.includes('mbank')) return { icon: CreditCard, color: '#12B76A' };
  if (t.includes('bakai') || t.includes('бакай')) return { icon: Landmark, color: '#1D7AFC' };
  if (t.includes('yandex') || t.includes('яндекс')) return { icon: Truck, color: '#F79009' };
  if (t.includes('sms')) return { icon: MessageSquareText, color: '#7A5AF8' };
  if (t.includes('telegram') || t.includes('telegram')) return { icon: Send, color: '#229ED9' };
  if (t.includes('whatsapp')) return { icon: MessageCircle, color: '#25D366' };
  if (t.includes('push')) return { icon: Bell, color: '#EE46BC' };
  if (t.includes('fiscal') || t.includes('фискал')) return { icon: Receipt, color: '#0F1222' };
  return { icon: Plug, color: '#5B3CF5' };
}

export default function Integrations() {
  const { data, error, loading, reload, setData } = useApi<Integration[]>('/integrations');
  const log = useApi<LogRow[]>('/integrations/log');
  const connected = data?.filter((i) => i.configured).length ?? 0;

  return (
    <>
      <PageHead title="Интеграции" subtitle="Банки, доставка, SMS и уведомления. Ключи хранятся на сервере и не показываются целиком." />
      <div className="callout primary mb-20">
        <Server size={18} />
        <div>
          <b>Пока ключи не введены, приложение работает в демо-режиме:</b> оплата QR подтверждается автоматически, SMS-код всегда 1111, выплаты только записываются в учёт, уведомления пишутся в журнал ниже. Как только вы вставите ключи и сохраните — интеграция включится сразу, без обновления приложений.
          {data && <div className="mt-8">Подключено: <b>{connected} из {data.length}</b></div>}
        </div>
      </div>
      {error && !data && <ErrorBox error={error} retry={reload} />}
      {!data && loading && <div className="grid g-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={260} r={20} />)}</div>}
      {data && (
        <div className="grid g-2">
          {data.map((i) => (
            <IntegrationCard key={i.id} i={i} onSaved={(all) => { setData(all); log.reload(); }} />
          ))}
        </div>
      )}
      <div className="card mt-24">
        <div className="card-head">
          <h3>Журнал интеграций</h3>
          <span className="sub">последние 100 событий</span>
        </div>
        {!log.data && log.loading && <div className="card-pad"><Skeleton h={120} /></div>}
        {log.data?.length === 0 && <Empty title="Событий пока нет" text="Здесь появятся платежи, SMS, уведомления и выплаты." />}
        {log.data && log.data.length > 0 && (
          <div className="table-wrap mt-8" style={{ maxHeight: 420, overflowY: 'auto' }}>
            <table className="table compact" data-testid="integration-log">
              <thead><tr><th>Время</th><th>Сервис</th><th>Действие</th><th>Режим</th><th>Данные</th></tr></thead>
              <tbody>
                {log.data.map((r) => (
                  <tr key={r.id}>
                    <td className="muted nowrap">{formatDateTime(r.created_at)}</td>
                    <td className="strong">{r.integration}</td>
                    <td>{r.action}</td>
                    <td>{r.demo ? <Chip tone="warning" plain>Демо</Chip> : <Chip tone="success" plain>Боевой</Chip>}</td>
                    <td><code className="payload" title={r.payload}>{r.payload}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function IntegrationCard({ i, onSaved }: { i: Integration; onSaved: (all: Integration[]) => void }) {
  const initial = Object.fromEntries(i.fields.map((f) => [f.key, i.values[f.key]?.value ?? '']));
  const [vals, setVals] = useState<Record<string, string>>(initial);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const toast = useToast();
  const { icon: Icon, color } = iconFor(i);
  const dirty = i.fields.some((f) => !i.values[f.key]?.fromEnv && vals[f.key] !== initial[f.key]);

  const save = async () => {
    const body = Object.fromEntries(i.fields.filter((f) => !i.values[f.key]?.fromEnv).map((f) => [f.key, vals[f.key].trim()]));
    const all = await put<Integration[]>(`/integrations/${i.id}`, body);
    const next = all.find((x) => x.id === i.id);
    if (next) setVals(Object.fromEntries(next.fields.map((f) => [f.key, next.values[f.key]?.value ?? ''])));
    toast.ok(next?.configured ? `${i.title}: подключено` : `${i.title}: сохранено`);
    onSaved(all);
  };

  return (
    <div className="card card-pad integ" data-testid={`integration-${i.id}`}>
      <div className="row gap-16 top">
        <span className="integ-icon" style={{ background: `${color}16`, color }}><Icon size={22} /></span>
        <div className="grow">
          <div className="row between gap-6">
            <h3 className="h3">{i.title}</h3>
            {i.configured ? (
              <Chip tone="success"><CheckCircle2 size={12} /> Подключено</Chip>
            ) : (
              <Chip tone="warning">Демо-режим</Chip>
            )}
          </div>
          <p className="small muted mt-4">{i.description}</p>
        </div>
      </div>
      <div className="col gap-16 mt-16">
        {i.fields.map((f) => {
          const v = i.values[f.key];
          const masked = (vals[f.key] ?? '').startsWith('••••');
          return (
            <Field
              key={f.key}
              label={
                <span className="row gap-6">
                  {f.label}
                  {f.secret && <Lock size={12} className="muted" />}
                </span>
              }
              hint={v?.fromEnv ? `Задано на сервере через ${f.env} — изменить можно только там` : masked ? 'Ключ сохранён. Чтобы заменить — удалите и вставьте новый.' : undefined}
            >
              <div className="input-wrap has-suffix">
                <input
                  className="input num"
                  type={f.secret && !reveal[f.key] && !masked ? 'password' : 'text'}
                  value={vals[f.key] ?? ''}
                  readOnly={v?.fromEnv}
                  onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
                  onFocus={(e) => masked && e.target.select()}
                  placeholder={f.secret ? 'Вставьте ключ' : f.key === 'baseUrl' ? 'https://…' : ''}
                  autoComplete="off"
                  data-testid={`integ-${i.id}-${f.key}`}
                />
                {f.secret && !masked && !v?.fromEnv && (
                  <button type="button" className="suffix suffix-btn" onClick={() => setReveal({ ...reveal, [f.key]: !reveal[f.key] })} aria-label="Показать">
                    {reveal[f.key] ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                )}
              </div>
            </Field>
          );
        })}
      </div>
      <div className="row between mt-16">
        <span className="small muted">{i.fields.filter((f) => i.values[f.key]?.set).length} из {i.fields.length} полей заполнено</span>
        <Btn variant="primary" size="sm" disabled={!dirty} onClick={save} data-testid={`integ-save-${i.id}`}>Сохранить</Btn>
      </div>
    </div>
  );
}
