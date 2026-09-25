import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AdminPermission, AdminUser } from '@taptym/shared';
import { api, getToken, post, setToken, setUnauthorizedHandler } from './api';

export type Badges = { newOrders: number; payouts: number; promos: number; support: number; services: number };
export type Me = AdminUser & { unread: number; badges: Badges };

type AuthCtx = {
  me: Me | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  can: (p: AdminPermission) => boolean;
};

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(!getToken());

  const refresh = useCallback(async () => {
    if (!getToken()) return;
    try {
      setMe(await api<Me>('/me'));
    } catch {
      /* 401 is handled globally; network blips keep the last state */
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setMe(null));
    refresh();
    // Keeps sidebar badges and the notification counter live.
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await post<{ token: string }>('/auth/login', { email, password });
    setToken(r.token);
    setMe(await api<Me>('/me'));
    setReady(true);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setMe(null);
  }, []);

  const can = useCallback((p: AdminPermission) => !!me && (me.role === 'owner' || me.permissions.includes(p)), [me]);

  return <Ctx.Provider value={{ me, ready, login, logout, refresh, can }}>{children}</Ctx.Provider>;
}
