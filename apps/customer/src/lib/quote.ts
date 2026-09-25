import { useEffect, useRef, useState } from 'react';
import type { CheckoutQuote, CheckoutRequest, DeliveryMethod } from '@taptym/shared';
import { errorText } from '@/i18n';
import { api, type ApiError } from './api';
import { useServer } from './server';
import { toast, useApp } from './store';

export function quoteRequest(): Partial<CheckoutRequest> {
  const s = useApp.getState();
  return {
    lines: s.cart,
    groups: Object.entries(s.delivery).map(([supplierId, deliveryMethod]) => ({ supplierId: Number(supplierId), deliveryMethod })),
    addressId: s.token ? s.addressId : null,
    promoCode: s.promo,
    // Server clamps to coinsMax.
    coinsToUse: s.useCoins && s.token ? 1_000_000 : 0,
  };
}

/** Recomputes the cart via `/cart/quote` whenever cart-affecting state changes. */
export function useQuote() {
  const cart = useApp((s) => s.cart);
  const delivery = useApp((s) => s.delivery);
  const promo = useApp((s) => s.promo);
  const useCoins = useApp((s) => s.useCoins);
  const addressId = useApp((s) => s.addressId);
  const token = useApp((s) => s.token);
  const server = useServer((s) => s.url);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const seq = useRef(0);
  const shown = useRef(false);
  useEffect(() => {
    shown.current = quote != null;
  }, [quote]);
  const key = JSON.stringify([cart, delivery, promo, useCoins, addressId, token, server]);

  const run = async () => {
    const id = ++seq.current;
    if (!useApp.getState().cart.length) {
      setQuote(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const q = await api<CheckoutQuote>('/cart/quote', { body: quoteRequest() });
      if (id !== seq.current) return;
      setQuote(q);
      setError(null);
    } catch (e) {
      if (id !== seq.current) return;
      setError(e as ApiError);
      // The previous totals stay on screen; tell the user they were not recalculated.
      if (shown.current) toast(errorText(e), 'error');
    } finally {
      if (id === seq.current) setLoading(false);
    }
  };

  useEffect(() => {
    const h = setTimeout(run, 120);
    return () => clearTimeout(h);
  }, [key]);

  return { quote, loading, error, refresh: run };
}

export const DELIVERY_ICON: Record<DeliveryMethod, 'bicycle' | 'storefront' | 'car' | 'walk'> = {
  courier: 'bicycle',
  supplier: 'storefront',
  yandex: 'car',
  pickup: 'walk',
};
