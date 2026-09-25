export type Lang = 'ru' | 'ky' | 'uz' | 'kk';
export type Localized = Partial<Record<Lang, string>> & { ru: string };

export type DeliveryMethod = 'supplier' | 'courier' | 'yandex' | 'pickup';
export type PaymentMethod = 'qr' | 'card' | 'cash' | 'invoice' | 'coins_only';
export type PaymentStatus = 'pending' | 'paid' | 'cash_on_delivery' | 'awaiting_invoice' | 'refunded' | 'failed';

export type SubOrderStatus =
  | 'new'
  | 'confirmed'
  | 'assembling'
  | 'ready'
  | 'in_delivery'
  | 'delivered'
  | 'cancelled'
  | 'rejected';

export type OrderStatus = 'placed' | 'in_progress' | 'completed' | 'cancelled';

export type SupplierStatus = 'active' | 'banned' | 'paused';
export type SupplierRole = 'owner' | 'manager' | 'cashier' | 'warehouse';

export type LedgerType =
  | 'sale'
  | 'commission'
  | 'promotion'
  | 'service'
  | 'payout'
  | 'cash_collected'
  | 'promo_discount'
  | 'refund'
  | 'adjustment';

export type PayoutStatus = 'requested' | 'confirmed' | 'paid' | 'rejected';
export type PromoType = 'percent' | 'fixed' | 'free_delivery';
export type PromoStatus = 'active' | 'pending' | 'rejected' | 'disabled';
export type BannerPlacement = 'home_top' | 'home_middle' | 'search' | 'category';

export interface CourierTariff {
  base: number;
  perKm: number;
  includedKm: number;
}

export interface PlatformSettings {
  commissionPercent: number;
  trialDays: number;
  freeFirstCourierDelivery: boolean;
  freeBannerFirstMonth: boolean;
  catalogUploadHourlyRate: number;
  courierEnabled: boolean;
  courierMoped: CourierTariff;
  courierCar: CourierTariff;
  carFromSubtotal: number;
  freeDeliveryFrom: number;
  yandexEnabled: boolean;
  yandexEstimate: { base: number; perKm: number };
  sameDayCutoffHour: number;
  coinsPer100: number;
  coinValue: number;
  coinsMaxPercent: number;
  referralBonusCoins: number;
  referralFriendCoins: number;
  cashDebtLimit: number;
  supportPhone: string;
  supportTelegram: string;
  seasonalTheme: 'back_to_school' | 'new_year' | 'none';
}

export interface Category {
  id: string;
  icon: string;
  emoji: string;
  color: string;
  name: Localized;
  sort: number;
}

export interface SupplierPublic {
  id: number;
  name: string;
  logoEmoji: string;
  color: string;
  address: string;
  rating: number;
  ordersCount: number;
  ownDelivery: boolean;
  isNew: boolean;
}

export interface Offer {
  id: number;
  productId: number;
  supplier: SupplierPublic;
  price: number;
  oldPrice: number | null;
  stock: number;
  wholesalePrice: number | null;
  wholesaleFrom: number | null;
  deliveryToday: boolean;
}

export interface ProductCard {
  id: number;
  title: string;
  brand: string | null;
  categoryId: string;
  emoji: string;
  color: string;
  images: string[];
  minPrice: number;
  maxPrice: number;
  oldPrice: number | null;
  offersCount: number;
  rating: number;
  reviewsCount: number;
  inStock: boolean;
  promoted: boolean;
  savings: number;
}

export interface ProductDetail extends ProductCard {
  description: string;
  barcode: string | null;
  specs: Record<string, string>;
  videoUrl: string | null;
  offers: Offer[];
  reviews: Review[];
  similar: ProductCard[];
}

export interface Review {
  id: number;
  productId: number;
  userName: string;
  rating: number;
  text: string;
  photos: string[];
  videoUrl: string | null;
  createdAt: string;
  supplierName: string | null;
}

export interface Banner {
  id: number;
  title: string;
  subtitle: string;
  emoji: string;
  color: string;
  textColor: string;
  placement: BannerPlacement;
  position: number;
  link: string;
  supplierId: number | null;
  isAd: boolean;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  price: number;
}

export interface Address {
  id: number;
  label: string;
  line: string;
  lat: number;
  lng: number;
}

export interface CustomerProfile {
  id: number;
  phone: string;
  name: string;
  lang: Lang;
  coins: number;
  referralCode: string;
  isCompany: boolean;
  companyName: string | null;
  companyInn: string | null;
  addresses: Address[];
  ordersCount: number;
}

export interface CartLine {
  offerId: number;
  qty: number;
}

export interface CheckoutGroupRequest {
  supplierId: number;
  deliveryMethod: DeliveryMethod;
}

export interface CheckoutRequest {
  lines: CartLine[];
  groups: CheckoutGroupRequest[];
  addressId: number | null;
  paymentMethod: PaymentMethod;
  promoCode: string | null;
  coinsToUse: number;
  comment: string;
}

export interface QuoteGroup {
  supplier: SupplierPublic;
  lines: { offerId: number; productId: number; title: string; emoji: string; color: string; image: string | null; price: number; qty: number; total: number; stock: number }[];
  subtotal: number;
  deliveryOptions: { method: DeliveryMethod; fee: number; available: boolean; etaText: string; distanceKm: number; vehicle?: 'moped' | 'car' }[];
  deliveryMethod: DeliveryMethod;
  deliveryFee: number;
}

export interface CheckoutQuote {
  groups: QuoteGroup[];
  itemsTotal: number;
  deliveryTotal: number;
  promoDiscount: number;
  promoError: string | null;
  coinsAvailable: number;
  coinsMax: number;
  coinsUsed: number;
  total: number;
  coinsToEarn: number;
  savingsVsMax: number;
  cheaperAlternative: { saving: number; lines: CartLine[] } | null;
  cashAllowed: boolean;
  freeFirstDelivery: boolean;
  isFirstOrder: boolean;
}

export interface OrderItem {
  productId: number;
  offerId: number;
  title: string;
  emoji: string;
  color: string;
  image: string | null;
  price: number;
  qty: number;
}

export interface SubOrder {
  id: number;
  orderId: number;
  orderNumber: string;
  supplier: SupplierPublic;
  status: SubOrderStatus;
  deliveryMethod: DeliveryMethod;
  deliveryFee: number;
  distanceKm: number;
  subtotal: number;
  commission: number;
  promoDiscount: number;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
  history: { status: SubOrderStatus; at: string; by: string }[];
  customer?: { name: string; phone: string; address: string; isCompany: boolean; companyName: string | null };
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  comment?: string;
}

export interface Order {
  id: number;
  number: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  itemsTotal: number;
  deliveryTotal: number;
  promoDiscount: number;
  coinsUsed: number;
  total: number;
  coinsEarned: number;
  address: string;
  comment: string;
  createdAt: string;
  subOrders: SubOrder[];
  payment?: PaymentSession | null;
}

export interface PaymentSession {
  id: string;
  orderId: number;
  amount: number;
  method: PaymentMethod;
  provider: string;
  status: 'pending' | 'paid' | 'failed';
  qrDataUrl: string | null;
  deepLinks: { bank: string; url: string }[];
  demo: boolean;
  invoiceUrl: string | null;
}

export interface NotificationItem {
  id: number;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface ChatMessage {
  id: number;
  threadId: number;
  sender: 'customer' | 'supplier' | 'operator' | 'system';
  senderName: string;
  text: string;
  createdAt: string;
}

export interface ChatThread {
  id: number;
  kind: 'customer_support' | 'supplier_support' | 'order';
  title: string;
  orderId: number | null;
  lastMessage: string;
  lastAt: string;
  unread: number;
  status: 'open' | 'closed';
}

export interface SupplierProduct {
  offerId: number;
  productId: number;
  title: string;
  brand: string | null;
  categoryId: string;
  emoji: string;
  color: string;
  images: string[];
  barcode: string | null;
  description: string;
  price: number;
  oldPrice: number | null;
  wholesalePrice: number | null;
  wholesaleFrom: number | null;
  stock: number;
  active: boolean;
  moderation: 'approved' | 'pending' | 'rejected';
  updatedAt: string;
  competitorMinPrice: number | null;
  sold30d: number;
}

export interface LedgerEntry {
  id: number;
  type: LedgerType;
  amount: number;
  note: string;
  subOrderId: number | null;
  createdAt: string;
}

export interface PayoutBreakdown {
  sales: number;
  commission: number;
  promotions: number;
  services: number;
  promoDiscounts: number;
  cashCollected: number;
  refunds: number;
  adjustments: number;
  paidOut: number;
  available: number;
}

export interface Payout {
  id: number;
  supplierId: number;
  supplierName: string;
  amount: number;
  method: 'mbank' | 'bank_account' | 'cash';
  details: string;
  status: PayoutStatus;
  breakdown: PayoutBreakdown;
  services: { name: string; amount: number }[];
  comment: string;
  createdAt: string;
  processedAt: string | null;
}

export interface PromoCode {
  id: number;
  code: string;
  type: PromoType;
  value: number;
  minTotal: number;
  maxUses: number;
  used: number;
  perUser: number;
  supplierId: number | null;
  supplierName: string | null;
  fundedBy: 'platform' | 'supplier' | 'shared';
  status: PromoStatus;
  startsAt: string | null;
  endsAt: string | null;
  description: string;
  createdAt: string;
}

export interface SupplierStaff {
  id: number;
  name: string;
  phone: string;
  role: SupplierRole;
  active: boolean;
}

export interface SupplierProfile {
  id: number;
  name: string;
  legalName: string;
  inn: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  logoEmoji: string;
  color: string;
  description: string;
  status: SupplierStatus;
  trialUntil: string | null;
  inTrial: boolean;
  ownDelivery: boolean;
  ownDeliveryFee: number;
  ownFreeFrom: number;
  acceptsCash: boolean;
  workHours: string;
  rating: number;
  payoutDetails: string;
  integrations: { moysklad: boolean; onec: boolean; apiToken: string | null };
  myRole: SupplierRole;
}

export interface SupplierService {
  id: number;
  type: 'banner' | 'top_search' | 'featured' | 'catalog_upload' | 'courier_plan';
  title: string;
  price: number;
  startsAt: string;
  endsAt: string | null;
  status: 'active' | 'pending' | 'finished';
}

export interface SupplierDashboard {
  today: { orders: number; revenue: number; newOrders: number };
  week: { orders: number; revenue: number };
  month: { orders: number; revenue: number; commission: number };
  balance: number;
  chart: { date: string; revenue: number; orders: number }[];
  topProducts: { title: string; emoji: string; qty: number; revenue: number }[];
  lowStock: { offerId: number; title: string; stock: number }[];
  priceAlerts: { offerId: number; title: string; myPrice: number; minPrice: number }[];
  inTrial: boolean;
  trialDaysLeft: number;
  rating: number;
}

export const ADMIN_PERMISSIONS = [
  'dashboard',
  'orders',
  'suppliers',
  'customers',
  'products',
  'payouts',
  'promos',
  'banners',
  'support',
  'reports',
  'settings',
  'staff',
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: 'owner' | 'operator' | 'accountant' | 'moderator' | 'custom';
  permissions: AdminPermission[];
  active: boolean;
}
