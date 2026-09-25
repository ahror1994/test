import { Hono } from 'hono';
import { all, get, nowIso, run } from '../db.ts';
import { body, type Vars } from '../http.ts';
import { ApiError } from '../services/orders.ts';
import { notify } from '../services/notify.ts';

type Side = 'customer' | 'supplier';

export function threadRow(t: any, forOperator = false) {
  const last = get<any>('SELECT text, created_at FROM messages WHERE thread_id = ? ORDER BY id DESC LIMIT 1', t.id);
  const order = t.order_id ? get<any>('SELECT number FROM orders WHERE id = ?', t.order_id) : null;
  return {
    id: t.id,
    kind: t.kind,
    title: t.title,
    orderId: t.order_id,
    orderNumber: order?.number ?? null,
    isReturn: !!t.is_return,
    lastMessage: last?.text ?? '',
    lastAt: last?.created_at ?? t.updated_at,
    unread: forOperator ? t.unread_operator : t.unread_client,
    status: t.status,
  };
}

export function messageRow(m: any) {
  return { id: m.id, threadId: m.thread_id, sender: m.sender, senderName: m.sender_name, text: m.text, createdAt: m.created_at };
}

export function addMessage(threadId: number, sender: string, senderName: string, text: string) {
  const now = nowIso();
  run('INSERT INTO messages(thread_id, sender, sender_name, text, created_at) VALUES(?,?,?,?,?)', threadId, sender, senderName, text, now);
  if (sender === 'operator') run('UPDATE threads SET unread_client = unread_client + 1, updated_at = ?, status = ? WHERE id = ?', now, 'open', threadId);
  else run('UPDATE threads SET unread_operator = unread_operator + 1, updated_at = ?, status = ? WHERE id = ?', now, 'open', threadId);
}

/** Support chat between a client (customer or supplier) and platform operators. */
export function threadsRouter(side: Side) {
  const r = new Hono<{ Variables: Vars }>();
  const owner = (c: any) => (side === 'customer' ? { col: 'user_id', id: c.get('userId') } : { col: 'supplier_id', id: c.get('supplierId') });
  const senderName = (c: any) => {
    if (side === 'customer') return get<any>('SELECT name, phone FROM users WHERE id = ?', c.get('userId'))?.name || 'Клиент';
    return get<any>('SELECT name FROM suppliers WHERE id = ?', c.get('supplierId'))?.name ?? 'Поставщик';
  };
  const own = (c: any, id: number) => {
    const o = owner(c);
    const t = get<any>(`SELECT * FROM threads WHERE id = ? AND ${o.col} = ?`, id, o.id);
    if (!t) throw new ApiError(404, 'thread_not_found');
    return t;
  };

  r.get('/threads', (c) => {
    const o = owner(c);
    return c.json(all<any>(`SELECT * FROM threads WHERE ${o.col} = ? ORDER BY updated_at DESC`, o.id).map((t) => threadRow(t)));
  });

  r.post('/threads', async (c) => {
    const b = await body<{ title?: string; text: string; orderId?: number; isReturn?: boolean }>(c);
    if (!b.text?.trim()) throw new ApiError(400, 'text_required');
    const o = owner(c);
    const now = nowIso();
    const title = b.title?.trim() || (b.isReturn ? 'Возврат товара' : 'Вопрос в поддержку');
    const { lastInsertRowid } = run(
      `INSERT INTO threads(kind, ${o.col}, order_id, title, is_return, updated_at, created_at) VALUES(?,?,?,?,?,?,?)`,
      side === 'customer' ? 'customer_support' : 'supplier_support',
      o.id,
      b.orderId ?? null,
      title,
      b.isReturn ? 1 : 0,
      now,
      now,
    );
    addMessage(lastInsertRowid, side, senderName(c), b.text.trim());
    addMessage(lastInsertRowid, 'system', 'Taptym', 'Оператор ответит в течение 10 минут. Рабочее время 08:00–22:00.');
    run('UPDATE threads SET unread_client = 0 WHERE id = ?', lastInsertRowid);
    notify('admin', null, b.isReturn ? 'Запрос на возврат' : 'Новое обращение', `${senderName(c)}: ${b.text.slice(0, 120)}`, `/support/${lastInsertRowid}`);
    return c.json(threadRow(get('SELECT * FROM threads WHERE id = ?', lastInsertRowid)));
  });

  r.get('/threads/:id/messages', (c) => {
    const t = own(c, Number(c.req.param('id')));
    run('UPDATE threads SET unread_client = 0 WHERE id = ?', t.id);
    return c.json({ thread: threadRow(t), messages: all('SELECT * FROM messages WHERE thread_id = ? ORDER BY id', t.id).map(messageRow) });
  });

  r.post('/threads/:id/messages', async (c) => {
    const t = own(c, Number(c.req.param('id')));
    const b = await body<{ text: string }>(c);
    if (!b.text?.trim()) throw new ApiError(400, 'text_required');
    addMessage(t.id, side, senderName(c), b.text.trim());
    notify('admin', null, `Сообщение: ${t.title}`, `${senderName(c)}: ${b.text.slice(0, 120)}`, `/support/${t.id}`);
    return c.json({ ok: true });
  });

  return r;
}
