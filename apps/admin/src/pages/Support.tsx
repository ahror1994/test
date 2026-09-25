import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Headphones, Lock, RotateCcw, Send, ShoppingBag, Store, Undo2, User } from 'lucide-react';
import { formatDateTime, type ChatMessage } from '@taptym/shared';
import { post } from '../api';
import { useAuth } from '../auth';
import { useApi } from '../hooks';
import { Btn, Chip, Empty, ErrorBox, Skeleton, Tel, relTime, useToast } from '../ui';

type Thread = {
  id: number;
  kind: string;
  title: string;
  orderId: number | null;
  orderNumber: string | null;
  isReturn: boolean;
  lastMessage: string;
  lastAt: string;
  unread: number;
  status: 'open' | 'closed';
  who: string | null;
  whoType: 'customer' | 'supplier';
  phone: string | null;
};

const QUICK = ['Здравствуйте! Сейчас проверю ваш заказ.', 'Курьер уже в пути, будет в течение часа.', 'Оформили возврат, деньги вернутся в течение 1–3 дней.', 'Спасибо, что написали! Чем ещё помочь?'];

export default function Support() {
  const { id } = useParams();
  const nav = useNavigate();
  const [filter, setFilter] = useState<'open' | 'closed' | 'all'>('open');
  const list = useApi<Thread[]>(`/support/threads?status=${filter}`, { poll: 5000 });
  const selected = list.data?.find((t) => String(t.id) === id);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Поддержка</h1>
          <p>Чаты с покупателями и магазинами. Обновляется автоматически каждые 5 секунд.</p>
        </div>
      </div>
      <div className="card chat-shell">
        <aside className="chat-list">
          <div className="chat-list-head">
            <div className="seg">
              <button className={filter === 'open' ? 'on' : ''} onClick={() => setFilter('open')}>Открытые</button>
              <button className={filter === 'closed' ? 'on' : ''} onClick={() => setFilter('closed')}>Закрытые</button>
              <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>Все</button>
            </div>
          </div>
          <div className="chat-items">
            {list.error && !list.data && <div style={{ padding: 16 }}><ErrorBox error={list.error} retry={list.reload} /></div>}
            {!list.data && list.loading && [0, 1, 2, 3].map((i) => <div key={i} style={{ padding: 14 }}><Skeleton h={52} r={14} /></div>)}
            {list.data?.length === 0 && <Empty icon={<Headphones size={24} />} title={filter === 'open' ? 'Открытых чатов нет' : 'Пусто'} text="Всё обработано 👌" />}
            {list.data?.map((t) => (
              <button key={t.id} className={`chat-item ${String(t.id) === id ? 'on' : ''}`} onClick={() => nav(`/support/${t.id}`)} data-testid={`thread-${t.id}`}>
                <span className={`chat-ava ${t.whoType}`}>{t.whoType === 'supplier' ? <Store size={16} /> : <User size={16} />}</span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row between gap-6">
                    <b className="ellipsis">{t.who || 'Клиент'}</b>
                    <span className="small muted nowrap">{relTime(t.lastAt)}</span>
                  </div>
                  <div className="small strong ellipsis">{t.title}</div>
                  <div className="row between gap-6">
                    <span className="small muted ellipsis">{t.lastMessage}</span>
                    {t.unread > 0 && <span className="unread-pill">{t.unread}</span>}
                  </div>
                  <div className="row gap-4 mt-4">
                    <span className={`who-tag ${t.whoType}`}>{t.whoType === 'supplier' ? 'Магазин' : 'Покупатель'}</span>
                    {t.isReturn && <span className="who-tag ret"><Undo2 size={10} /> Возврат</span>}
                    {t.orderNumber && <span className="who-tag">{t.orderNumber}</span>}
                    {t.status === 'closed' && <span className="who-tag">Закрыт</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>
        <section className="chat-main">
          {id ? <ChatView key={id} id={Number(id)} meta={selected} onChanged={list.reload} /> : <Empty icon={<Headphones size={26} />} title="Выберите чат слева" text="Здесь будет переписка с покупателем или магазином." />}
        </section>
      </div>
    </>
  );
}

function ChatView({ id, meta, onChanged }: { id: number; meta?: Thread; onChanged: () => void }) {
  const { data, error, reload } = useApi<{ thread: Omit<Thread, 'who' | 'whoType' | 'phone'>; messages: ChatMessage[] }>(`/support/threads/${id}`, { poll: 5000 });
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const { refresh, can } = useAuth();
  const count = data?.messages.length ?? 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [count]);
  useEffect(() => {
    if (data) refresh();
    // Opening a thread marks it read on the server; refresh the sidebar badge once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      await post(`/support/threads/${id}/messages`, { text: t });
      setText('');
      await reload();
      onChanged();
    } catch (e) {
      toast.error(e);
    } finally {
      setSending(false);
    }
  };
  const setStatus = async (status: 'open' | 'closed') => {
    await post(`/support/threads/${id}/status`, { status });
    toast.ok(status === 'closed' ? 'Чат закрыт' : 'Чат снова открыт');
    await reload();
    onChanged();
  };

  if (error && !data) return <div style={{ padding: 20 }}><ErrorBox error={error} retry={reload} /></div>;
  if (!data) return <div style={{ padding: 20 }} className="col gap-16"><Skeleton h={40} /><Skeleton h={300} /></div>;
  const t = data.thread;
  return (
    <>
      <div className="chat-head">
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row gap-6">
            <b className="ellipsis">{meta?.who ?? t.title}</b>
            {t.isReturn && <Chip tone="warning" plain>Возврат</Chip>}
            {t.status === 'closed' && <Chip>Закрыт</Chip>}
          </div>
          <div className="row gap-6 small muted wrap mt-4">
            <span>{t.title}</span>
            {meta?.phone && <Tel phone={meta.phone} />}
            {t.orderId && can('orders') && (
              <Link to={`/orders?open=${t.orderId}`} className="order-link"><ShoppingBag size={13} /> {t.orderNumber}</Link>
            )}
          </div>
        </div>
        {t.status === 'open' ? (
          <Btn size="sm" icon={<Lock size={14} />} onClick={() => setStatus('closed')} data-testid="thread-close">Закрыть</Btn>
        ) : (
          <Btn size="sm" icon={<RotateCcw size={14} />} onClick={() => setStatus('open')} data-testid="thread-reopen">Открыть снова</Btn>
        )}
      </div>
      <div className="chat-msgs" data-testid="chat-msgs">
        {data.messages.map((m, i) => {
          const mine = m.sender === 'operator';
          const showDate = i === 0 || new Date(m.createdAt).toDateString() !== new Date(data.messages[i - 1].createdAt).toDateString();
          return (
            <div key={m.id}>
              {showDate && <div className="chat-date">{new Date(m.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</div>}
              {m.sender === 'system' ? (
                <div className="msg-sys">{m.text}</div>
              ) : (
                <div className={`msg ${mine ? 'mine' : ''}`}>
                  <div className="bubble">
                    {!mine && <div className="msg-name">{m.senderName}</div>}
                    {m.text}
                    <div className="msg-time" title={formatDateTime(m.createdAt)}>{mine ? `${m.senderName} · ` : ''}{new Date(m.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="chat-quick">
        {QUICK.map((q) => (
          <button key={q} onClick={() => setText(q)}>{q}</button>
        ))}
      </div>
      <div className="chat-input">
        <textarea
          className="textarea"
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ответ… Enter — отправить, Shift+Enter — перенос"
          data-testid="chat-input"
        />
        <Btn variant="primary" icon={<Send size={16} />} onClick={send} loading={sending} disabled={!text.trim()} data-testid="chat-send">Отправить</Btn>
      </div>
    </>
  );
}
