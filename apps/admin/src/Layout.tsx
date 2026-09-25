import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  BarChart3,
  CheckCheck,
  Headphones,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Package,
  Plug,
  Search,
  Settings,
  ShoppingBag,
  Store,
  TicketPercent,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { BRAND, type AdminPermission } from '@taptym/shared';
import { useAuth, type Badges } from './auth';
import { api, post } from './api';
import { ADMIN_ROLE } from './labels';
import { initials, relTime } from './ui';

type NavItem = { to: string; label: string; icon: LucideIcon; perm: AdminPermission; badge?: keyof Badges; soft?: boolean };

export const NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Обзор', items: [{ to: '/', label: 'Дашборд', icon: LayoutDashboard, perm: 'dashboard' }] },
  {
    group: 'Операции',
    items: [
      { to: '/orders', label: 'Заказы', icon: ShoppingBag, perm: 'orders', badge: 'newOrders' },
      { to: '/support', label: 'Поддержка', icon: Headphones, perm: 'support', badge: 'support' },
      { to: '/payouts', label: 'Выплаты', icon: Wallet, perm: 'payouts', badge: 'payouts', soft: true },
    ],
  },
  {
    group: 'Площадка',
    items: [
      { to: '/suppliers', label: 'Поставщики', icon: Store, perm: 'suppliers', badge: 'services', soft: true },
      { to: '/customers', label: 'Покупатели', icon: Users, perm: 'customers' },
      { to: '/products', label: 'Товары и отзывы', icon: Package, perm: 'products' },
    ],
  },
  {
    group: 'Маркетинг',
    items: [
      { to: '/promos', label: 'Промокоды', icon: TicketPercent, perm: 'promos', badge: 'promos', soft: true },
      { to: '/banners', label: 'Баннеры и реклама', icon: Megaphone, perm: 'banners' },
    ],
  },
  {
    group: 'Управление',
    items: [
      { to: '/reports', label: 'Отчёты', icon: BarChart3, perm: 'reports' },
      { to: '/settings', label: 'Настройки', icon: Settings, perm: 'settings' },
      { to: '/integrations', label: 'Интеграции', icon: Plug, perm: 'settings' },
      { to: '/staff', label: 'Сотрудники', icon: UserCog, perm: 'staff' },
    ],
  },
];

export function Layout({ children }: { children: ReactNode }) {
  const { me, can } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  if (!me) return null;
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-mark">T</div>
          <div className="logo-text">
            <b>{BRAND.adminName}</b>
            <span>Канцтовары · {BRAND.city}</span>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((g) => {
            const items = g.items.filter((i) => can(i.perm));
            if (!items.length) return null;
            return (
              <div key={g.group}>
                <div className="nav-group">{g.group}</div>
                {items.map((i) => {
                  const n = i.badge ? me.badges[i.badge] : 0;
                  return (
                    <NavLink key={i.to} to={i.to} end={i.to === '/'} title={i.label} data-testid={`nav-${i.to.slice(1) || 'dashboard'}`}>
                      <i.icon size={19} strokeWidth={2} />
                      <span className="label">{i.label}</span>
                      {n > 0 && <span className={`count ${i.soft ? 'soft' : ''}`}>{n > 99 ? '99+' : n}</span>}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <div className="demo-card">
            <b>Демо-режим</b>
            Оплаты, SMS и доставка работают без ключей. Подключите их в разделе «Интеграции».
          </div>
        </div>
      </aside>
      <div className="main">
        <header className={`topbar ${scrolled ? 'scrolled' : ''}`}>
          {can('orders') ? <GlobalSearch /> : <div className="grow" />}
          <div className="grow" />
          <Notifications />
          <UserMenu />
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

function GlobalSearch() {
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  return (
    <form
      className="search-box"
      onSubmit={(e) => {
        e.preventDefault();
        if (!q.trim()) return;
        nav(`/orders?q=${encodeURIComponent(q.trim())}`);
        setQ('');
        ref.current?.blur();
      }}
    >
      <Search size={18} />
      <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти заказ по номеру или телефону…" data-testid="global-search" />
      <kbd>Ctrl K</kbd>
    </form>
  );
}

type Notif = { id: number; title: string; body: string; link: string | null; read: boolean; createdAt: string };

function useOutside(ref: React.RefObject<HTMLElement | null>, fn: () => void) {
  const cb = useRef(fn);
  cb.current = fn;
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && cb.current();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref]);
}

function Notifications() {
  const { me, refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  useOutside(ref, () => setOpen(false));

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) setItems(await api<Notif[]>('/notifications').catch(() => []));
  };
  const readAll = async () => {
    await post('/notifications/read');
    setItems((l) => l?.map((n) => ({ ...n, read: true })) ?? null);
    refresh();
  };
  const unread = me?.unread ?? 0;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="icon-btn" onClick={toggle} aria-label="Уведомления" data-testid="notif-btn">
        <Bell size={19} />
        {unread > 0 && <span className="dot">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="dropdown">
          <div className="dropdown-head">
            <b>Уведомления</b>
            {unread > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={readAll}>
                <CheckCheck size={15} /> Прочитать все
              </button>
            )}
          </div>
          <div className="dropdown-list">
            {!items && <div className="muted" style={{ padding: 20 }}>Загрузка…</div>}
            {items?.length === 0 && <div className="muted" style={{ padding: 20 }}>Пока нет уведомлений</div>}
            {items?.map((n) => (
              <div
                key={n.id}
                className={`notif ${n.read ? '' : 'unread'}`}
                onClick={() => {
                  if (n.link) nav(mapLink(n.link));
                  setOpen(false);
                }}
              >
                <span className="bullet" />
                <div className="grow">
                  <b>{n.title}</b>
                  {n.body && <p>{n.body}</p>}
                  <span className="small muted">{relTime(n.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Notification links are written in app terms by the API; map them to admin routes. */
function mapLink(link: string) {
  if (link.startsWith('/admin/')) return link.slice(6);
  const m = link.match(/^\/orders\/(\d+)/);
  if (m) return `/orders?open=${m[1]}`;
  return link;
}

function UserMenu() {
  const { me, logout } = useAuth();
  const nav = useNavigate();
  if (!me) return null;
  return (
    <div className="user-chip">
      <div className="avatar">{initials(me.name)}</div>
      <div className="who">
        <b>{me.name}</b>
        <span>{ADMIN_ROLE[me.role] ?? me.role}</span>
      </div>
      <button
        className="icon-btn"
        title="Выйти"
        aria-label="Выйти"
        data-testid="logout"
        onClick={() => {
          logout();
          nav('/login');
        }}
      >
        <LogOut size={18} />
      </button>
    </div>
  );
}
