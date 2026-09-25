import type { DeliveryMethod, PlatformSettings } from './types';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  // Straight line × 1.3 approximates city road distance.
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 1.3 * 10) / 10;
}

export interface SupplierDeliveryInfo {
  ownDelivery: boolean;
  ownDeliveryFee: number;
  ownFreeFrom: number;
  location: GeoPoint;
}

export interface DeliveryQuote {
  method: DeliveryMethod;
  fee: number;
  distanceKm: number;
  vehicle?: 'moped' | 'car';
  etaText: string;
  available: boolean;
}

const HEAVY_ORDER_ITEMS = 25;

export function quoteDelivery(
  settings: PlatformSettings,
  method: DeliveryMethod,
  supplier: SupplierDeliveryInfo,
  to: GeoPoint | null,
  subtotal: number,
  itemsCount: number,
  now = new Date(),
): DeliveryQuote {
  const km = to ? distanceKm(supplier.location, to) : 0;
  const sameDay = now.getHours() < settings.sameDayCutoffHour;
  const etaText = sameDay ? 'today' : 'tomorrow';
  if (method === 'pickup') {
    return { method, fee: 0, distanceKm: km, etaText: 'pickup', available: true };
  }
  if (method === 'supplier') {
    const fee = subtotal >= supplier.ownFreeFrom && supplier.ownFreeFrom > 0 ? 0 : supplier.ownDeliveryFee;
    return { method, fee, distanceKm: km, etaText, available: supplier.ownDelivery };
  }
  if (method === 'courier') {
    const vehicle = itemsCount >= HEAVY_ORDER_ITEMS || subtotal >= settings.carFromSubtotal ? 'car' : 'moped';
    const t = vehicle === 'car' ? settings.courierCar : settings.courierMoped;
    let fee = Math.round(t.base + t.perKm * Math.max(0, km - t.includedKm));
    if (settings.freeDeliveryFrom > 0 && subtotal >= settings.freeDeliveryFrom) fee = 0;
    return { method, fee, distanceKm: km, vehicle, etaText, available: settings.courierEnabled };
  }
  // Yandex: estimate until the real API key is configured; the API replaces this with a live quote.
  const fee = Math.round(settings.yandexEstimate.base + settings.yandexEstimate.perKm * km);
  return { method, fee, distanceKm: km, etaText, available: settings.yandexEnabled };
}

export function calcCommission(settings: PlatformSettings, subtotal: number, inTrial: boolean): number {
  if (inTrial) return 0;
  return Math.round((subtotal * settings.commissionPercent) / 100);
}

export function coinsEarned(settings: PlatformSettings, paidAmount: number): number {
  return Math.floor(paidAmount / 100) * settings.coinsPer100;
}

export function maxCoinsUsable(settings: PlatformSettings, itemsTotal: number, balance: number): number {
  const cap = Math.floor((itemsTotal * settings.coinsMaxPercent) / 100 / settings.coinValue);
  return Math.max(0, Math.min(balance, cap));
}
