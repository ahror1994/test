import { all, get, run, nowIso } from '../db.ts';
import { sendPush, sendTelegram, sendWhatsApp } from '../integrations.ts';

export type Audience = 'customer' | 'supplier' | 'admin';

export function notify(audience: Audience, targetId: number | null, title: string, body: string, link: string | null = null) {
  run(
    'INSERT INTO notifications(audience, target_id, title, body, link, created_at) VALUES(?,?,?,?,?,?)',
    audience,
    targetId,
    title,
    body,
    link,
    nowIso(),
  );
  // External channels are fire-and-forget; failures are recorded in integration_log.
  if (audience === 'admin') {
    void sendTelegram(null, `<b>${title}</b>\n${body}`);
  } else if (audience === 'supplier' && targetId) {
    const s = get<{ phone: string }>('SELECT phone FROM suppliers WHERE id = ?', targetId);
    if (s) void sendWhatsApp(s.phone, `${title}\n${body}`);
  } else if (audience === 'customer' && targetId) {
    const u = get<{ push_token: string | null }>('SELECT push_token FROM users WHERE id = ?', targetId);
    if (u?.push_token) void sendPush([u.push_token], title, body, { link });
  }
}

export function listNotifications(audience: Audience, targetId: number | null, limit = 50) {
  const rows = all<any>(
    `SELECT * FROM notifications WHERE audience = ? AND (target_id IS ? OR target_id = ?) ORDER BY id DESC LIMIT ?`,
    audience,
    targetId,
    targetId,
    limit,
  );
  return rows.map((r) => ({ id: r.id, title: r.title, body: r.body, link: r.link, read: !!r.read, createdAt: r.created_at }));
}

export function unreadCount(audience: Audience, targetId: number | null) {
  return (
    get<{ n: number }>(
      'SELECT COUNT(*) AS n FROM notifications WHERE audience = ? AND (target_id IS ? OR target_id = ?) AND read = 0',
      audience,
      targetId,
      targetId,
    )?.n ?? 0
  );
}

export function markRead(audience: Audience, targetId: number | null) {
  run('UPDATE notifications SET read = 1 WHERE audience = ? AND (target_id IS ? OR target_id = ?)', audience, targetId, targetId);
}
