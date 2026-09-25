import type { Order, PayoutBreakdown } from '@taptym/shared';

export type AdminOrder = Order & {
  customer: { id: number; name: string; phone: string; isCompany: boolean; companyName: string | null };
};

export type AdminPayout = {
  id: number;
  supplierId: number;
  supplierName: string;
  supplierPhone: string;
  amount: number;
  method: string;
  details: string;
  status: 'requested' | 'confirmed' | 'paid' | 'rejected';
  breakdown: Partial<PayoutBreakdown>;
  currentBreakdown: PayoutBreakdown;
  services: { name: string; amount: number }[];
  activeServices: { name: string; amount: number }[];
  comment: string;
  createdAt: string;
  processedAt: string | null;
};

export type AdminSupplier = {
  id: number;
  name: string;
  logoEmoji: string;
  color: string;
  address: string;
  rating: number;
  ordersCount: number;
  phone: string;
  legalName: string | null;
  inn: string | null;
  status: 'active' | 'banned' | 'paused';
  banReason: string | null;
  trialUntil: string | null;
  inTrial: boolean;
  createdAt: string;
  offers: number;
  orders: number;
  revenue: number;
  balance: number;
  ownDelivery: boolean;
  ownDeliveryFee: number;
  acceptsCash: boolean;
  payoutDetails: string | null;
};
