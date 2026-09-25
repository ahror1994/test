import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CartLine, CustomerProfile, DeliveryMethod, Lang } from '@taptym/shared';

type AppState = {
  hydrated: boolean;
  token: string | null;
  profile: CustomerProfile | null;
  lang: Lang;
  cart: CartLine[];
  recent: string[];
  promo: string | null;
  useCoins: boolean;
  delivery: Record<string, DeliveryMethod>;
  addressId: number | null;
  unread: number;
  setUnread: (n: number) => void;
  setAuth: (token: string, profile: CustomerProfile) => void;
  setProfile: (p: CustomerProfile) => void;
  logout: () => void;
  setLang: (l: Lang) => void;
  addToCart: (offerId: number, qty?: number) => void;
  setQty: (offerId: number, qty: number) => void;
  replaceCart: (lines: CartLine[]) => void;
  mergeCart: (lines: CartLine[]) => void;
  clearCart: () => void;
  pushRecent: (q: string) => void;
  clearRecent: () => void;
  setPromo: (code: string | null) => void;
  setUseCoins: (v: boolean) => void;
  setDelivery: (supplierId: number, m: DeliveryMethod) => void;
  setAddressId: (id: number | null) => void;
};

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      token: null,
      profile: null,
      lang: 'ru',
      cart: [],
      recent: [],
      promo: null,
      useCoins: false,
      delivery: {},
      addressId: null,
      unread: 0,
      setUnread: (unread) => set({ unread }),
      setAuth: (token, profile) => set({ token, profile, addressId: profile.addresses[0]?.id ?? null }),
      setProfile: (profile) => set({ profile }),
      logout: () => set({ token: null, profile: null, useCoins: false, addressId: null, unread: 0 }),
      setLang: (lang) => set({ lang }),
      addToCart: (offerId, qty = 1) => {
        const cart = get().cart;
        const ex = cart.find((l) => l.offerId === offerId);
        set({
          cart: ex ? cart.map((l) => (l.offerId === offerId ? { ...l, qty: l.qty + qty } : l)) : [...cart, { offerId, qty }],
        });
      },
      setQty: (offerId, qty) =>
        set({
          cart:
            qty <= 0
              ? get().cart.filter((l) => l.offerId !== offerId)
              : get().cart.map((l) => (l.offerId === offerId ? { ...l, qty } : l)),
        }),
      replaceCart: (lines) => {
        const map = new Map<number, number>();
        for (const l of lines) if (l.qty > 0) map.set(l.offerId, (map.get(l.offerId) ?? 0) + l.qty);
        set({ cart: [...map].map(([offerId, qty]) => ({ offerId, qty })) });
      },
      mergeCart: (lines) => {
        const map = new Map(get().cart.map((l) => [l.offerId, l.qty]));
        for (const l of lines) map.set(l.offerId, (map.get(l.offerId) ?? 0) + l.qty);
        set({ cart: [...map].map(([offerId, qty]) => ({ offerId, qty })) });
      },
      clearCart: () => set({ cart: [], promo: null, useCoins: false }),
      pushRecent: (q) => {
        const v = q.trim();
        if (!v) return;
        set({ recent: [v, ...get().recent.filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, 8) });
      },
      clearRecent: () => set({ recent: [] }),
      setPromo: (promo) => set({ promo: promo ? promo.trim().toUpperCase() : null }),
      setUseCoins: (useCoins) => set({ useCoins }),
      setDelivery: (supplierId, m) => set({ delivery: { ...get().delivery, [supplierId]: m } }),
      setAddressId: (addressId) => set({ addressId }),
    }),
    {
      name: 'taptym-customer',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hydrated: _h, unread: _u, ...rest }) => rest,
      onRehydrateStorage: () => () => useApp.setState({ hydrated: true }),
    },
  ),
);

export const cartCount = (cart: CartLine[]) => cart.reduce((a, l) => a + l.qty, 0);

type Toast = { id: number; text: string; kind: 'info' | 'success' | 'error' };
export const useToast = create<{
  toast: Toast | null;
  sheets: number;
  show: (text: string, kind?: Toast['kind']) => void;
  hide: () => void;
  sheetDelta: (d: number) => void;
}>()((set, get) => ({
  toast: null,
  sheets: 0,
  show: (text, kind = 'info') => set({ toast: { id: Date.now(), text, kind } }),
  hide: () => set({ toast: null }),
  sheetDelta: (d) => set({ sheets: Math.max(0, get().sheets + d) }),
}));

export const toast = (text: string, kind?: Toast['kind']) => useToast.getState().show(text, kind);
