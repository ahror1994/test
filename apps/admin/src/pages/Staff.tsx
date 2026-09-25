import { useState } from 'react';
import { KeyRound, Pencil, Plus, Power, ShieldCheck, UserCog } from 'lucide-react';
import { ADMIN_PERMISSIONS, type AdminPermission, type AdminUser } from '@taptym/shared';
import { patch, post } from '../api';
import { useAuth } from '../auth';
import { useApi } from '../hooks';
import { ADMIN_ROLE, PERMISSION_LABEL, ROLE_PRESETS } from '../labels';
import { Btn, Chip, Empty, ErrorBox, Field, Modal, PageHead, TableSkeleton, initials, useDialog, useToast } from '../ui';

type Role = AdminUser['role'];
const ROLE_HINT: Record<string, string> = {
  operator: 'Заказы, покупатели, поддержка, поставщики',
  accountant: 'Выплаты и отчёты',
  moderator: 'Товары, баннеры, промокоды',
  custom: 'Отметьте нужные разделы вручную',
};

export default function Staff() {
  const { data, error, loading, reload } = useApi<AdminUser[]>('/staff');
  const [editing, setEditing] = useState<AdminUser | 'new' | null>(null);
  const { me } = useAuth();
  const toast = useToast();
  const dialog = useDialog();

  const toggleActive = async (u: AdminUser) => {
    if (u.active) {
      const ok = await dialog.confirm({ title: `Деактивировать ${u.name}?`, text: 'Сотрудник сразу потеряет доступ к админке.', confirmText: 'Деактивировать', danger: true });
      if (!ok) return false;
    }
    await patch(`/staff/${u.id}`, { active: !u.active });
    toast.ok(u.active ? 'Доступ отключён' : 'Доступ восстановлен');
    reload();
  };
  const resetPassword = async (u: AdminUser) => {
    const pw = await dialog.prompt({ title: `Новый пароль для ${u.name}`, label: 'Пароль (минимум 6 символов)', defaultValue: Math.random().toString(36).slice(2, 10), confirmText: 'Сохранить пароль', required: true });
    if (pw === null) return false;
    if (pw.length < 6) {
      toast.error(new Error('Пароль должен быть не короче 6 символов'));
      return false;
    }
    await patch(`/staff/${u.id}`, { password: pw });
    toast.ok(`Пароль изменён: ${pw} — передайте его сотруднику`);
  };

  return (
    <>
      <PageHead
        title="Сотрудники"
        subtitle="Кто работает в админке и что им доступно. Права назначает владелец."
        actions={<Btn variant="primary" icon={<Plus size={17} />} onClick={() => setEditing('new')} data-testid="staff-create">Добавить сотрудника</Btn>}
      />
      <div className="card">
        {error && !data && <div className="card-pad"><ErrorBox error={error} retry={reload} /></div>}
        {!data && loading && <TableSkeleton rows={4} cols={4} />}
        {data?.length === 0 && <Empty icon={<UserCog size={26} />} title="Сотрудников нет" />}
        {data && data.length > 0 && (
          <div className="table-wrap">
            <table className="table" data-testid="staff-table">
              <thead><tr><th>Сотрудник</th><th>Роль</th><th>Доступ к разделам</th><th>Статус</th><th className="r">Действия</th></tr></thead>
              <tbody>
                {data.map((u) => (
                  <tr key={u.id} className={!u.active ? 'row-muted' : ''}>
                    <td>
                      <div className="row gap-16">
                        <div className="avatar sm">{initials(u.name)}</div>
                        <div>
                          <div className="cell-title">{u.name}{u.id === me?.id && <span className="muted small"> (вы)</span>}</div>
                          <div className="cell-sub">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><Chip tone={u.role === 'owner' ? 'primary' : 'neutral'} plain>{ADMIN_ROLE[u.role]}</Chip></td>
                    <td style={{ maxWidth: 420 }}>
                      {u.role === 'owner' ? <span className="small strong row gap-4"><ShieldCheck size={14} color="#5B3CF5" /> Все разделы</span> : (
                        <div className="perm-tags">
                          {u.permissions.map((p) => <span key={p}>{PERMISSION_LABEL[p]?.label ?? p}</span>)}
                          {!u.permissions.length && <span className="muted small">Нет доступа</span>}
                        </div>
                      )}
                    </td>
                    <td>{u.active ? <Chip tone="success">Активен</Chip> : <Chip>Отключён</Chip>}</td>
                    <td className="r">
                      {u.role !== 'owner' && (
                        <span className="row gap-4" style={{ justifyContent: 'flex-end' }}>
                          <Btn size="sm" variant="ghost" icon={<Pencil size={15} />} onClick={() => setEditing(u)} title="Права" />
                          <Btn size="sm" variant="ghost" icon={<KeyRound size={15} />} onClick={() => resetPassword(u)} title="Сбросить пароль" />
                          <Btn size="sm" variant="ghost" icon={<Power size={15} />} onClick={() => toggleActive(u)} title={u.active ? 'Деактивировать' : 'Активировать'} />
                        </span>
                      )}
                      {u.role === 'owner' && <Btn size="sm" variant="ghost" icon={<KeyRound size={15} />} onClick={() => resetPassword(u)} title="Сменить пароль" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editing && (
        <StaffModal
          user={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function StaffModal({ user, onClose, onDone }: { user: AdminUser | null; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState(() => Math.random().toString(36).slice(2, 10));
  const [role, setRole] = useState<Role>(user?.role ?? 'operator');
  const [perms, setPerms] = useState<AdminPermission[]>(user?.permissions ?? ROLE_PRESETS.operator);
  const toast = useToast();
  const pickRole = (r: Role) => {
    setRole(r);
    if (r !== 'custom') setPerms(ROLE_PRESETS[r]);
  };
  const togglePerm = (p: AdminPermission) => {
    setPerms((l) => (l.includes(p) ? l.filter((x) => x !== p) : [...l, p]));
    if (role !== 'custom') setRole('custom');
  };
  const valid = name.trim() && (user || (/\S+@\S+\.\S+/.test(email) && password.length >= 6)) && perms.length > 0;

  const submit = async () => {
    if (user) {
      await patch(`/staff/${user.id}`, { name: name.trim(), role, permissions: perms });
      toast.ok('Права обновлены');
    } else {
      await post('/staff', { name: name.trim(), email: email.trim(), password, role, permissions: perms });
      toast.ok(`Сотрудник добавлен. Логин: ${email.trim()}, пароль: ${password}`);
    }
    onDone();
  };

  return (
    <Modal
      title={user ? `Права · ${user.name}` : 'Новый сотрудник'}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>Отмена</button>
          <Btn variant="primary" disabled={!valid} onClick={submit} data-testid="staff-submit">{user ? 'Сохранить' : 'Создать'}</Btn>
        </>
      }
    >
      <div className="col gap-20">
        <div className="grid g-3 gap-16">
          <Field label="Имя">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Айгерим" autoFocus data-testid="staff-name" />
          </Field>
          <Field label="Email (логин)">
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} readOnly={!!user} placeholder="name@taptym.kg" data-testid="staff-email" />
          </Field>
          {!user && (
            <Field label="Пароль" hint="Передайте сотруднику">
              <input className="input num" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="staff-password" />
            </Field>
          )}
        </div>
        <Field label="Роль">
          <div className="role-pick">
            {(['operator', 'accountant', 'moderator', 'custom'] as Role[]).map((r) => (
              <button key={r} type="button" className={role === r ? 'on' : ''} onClick={() => pickRole(r)} data-testid={`role-${r}`}>
                <b>{ADMIN_ROLE[r]}</b>
                <span>{ROLE_HINT[r]}</span>
              </button>
            ))}
          </div>
        </Field>
        <Field label={`Доступ к разделам · ${perms.length} из ${ADMIN_PERMISSIONS.length}`}>
          <div className="grid g-3 gap-6">
            {ADMIN_PERMISSIONS.map((p) => (
              <label key={p} className={`check ${perms.includes(p) ? 'on' : ''}`}>
                <input type="checkbox" checked={perms.includes(p)} onChange={() => togglePerm(p)} />
                <div>
                  <b>{PERMISSION_LABEL[p].label}</b>
                  <span>{PERMISSION_LABEL[p].hint}</span>
                </div>
              </label>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
