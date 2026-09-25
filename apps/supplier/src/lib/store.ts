import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { create } from 'zustand';
import type { Lang, SupplierProfile } from '@taptym/shared';
import { api, setAuthToken, setUnauthorizedHandler } from './api';

export type Permission = 'orders' | 'orders_view' | 'products' | 'finance' | 'finance_view' | 'staff' | 'promos' | 'settings' | 'reports' | 'support';

export type Me = SupplierProfile & { staffName?: string; unread: number; newOrders: number; permissions: Permission[] };

type State = {
  ready: boolean;
  token: string | null;
  lang: Lang;
  me: Me | null;
  hydrate: () => Promise<void>;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  setLang: (l: Lang) => void;
  loadMe: () => Promise<Me | null>;
};

const K_TOKEN = 'taptym.business.token';
const K_LANG = 'taptym.business.lang';

export const useStore = create<State>((set, get) => ({
  ready: false,
  token: null,
  lang: 'ru',
  me: null,
  hydrate: async () => {
    const [token, lang] = await Promise.all([AsyncStorage.getItem(K_TOKEN), AsyncStorage.getItem(K_LANG)]);
    setAuthToken(token);
    set({ token, lang: (lang as Lang) || 'ru' });
    if (token) await get().loadMe();
    set({ ready: true });
  },
  signIn: async (token) => {
    setAuthToken(token);
    await AsyncStorage.setItem(K_TOKEN, token);
    await get().loadMe();
    set({ token });
  },
  signOut: async () => {
    setAuthToken(null);
    await AsyncStorage.removeItem(K_TOKEN);
    set({ token: null, me: null });
    try {
      router.replace('/login');
    } catch {}
  },
  setLang: (lang) => {
    void AsyncStorage.setItem(K_LANG, lang);
    set({ lang });
  },
  loadMe: async () => {
    try {
      const me = await api<Me>('/api/s/me');
      set({ me });
      return me;
    } catch {
      return null;
    }
  },
}));

setUnauthorizedHandler(() => void useStore.getState().signOut());

export function useCan() {
  // Select the stable array reference; a `?? []` inside the selector would loop in zustand v5.
  const perms = useStore((s) => s.me?.permissions);
  return (p: Permission) => !!perms?.includes(p);
}
