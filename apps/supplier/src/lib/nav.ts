import { router } from 'expo-router';
import type { TKey } from '../i18n';
import type { IconName } from '@/components/ui';
import type { Permission } from './store';

export type NavItem = { route: string; href: string; label: TKey; icon: IconName; iconOn: IconName; perm?: Permission[] };

export const MAIN_TABS: NavItem[] = [
  { route: 'index', href: '/', label: 'tab_home', icon: 'home-outline', iconOn: 'home' },
  { route: 'orders', href: '/orders', label: 'tab_orders', icon: 'receipt-outline', iconOn: 'receipt', perm: ['orders', 'orders_view'] },
  { route: 'products', href: '/products', label: 'tab_products', icon: 'cube-outline', iconOn: 'cube', perm: ['products'] },
  { route: 'finance', href: '/finance', label: 'tab_finance', icon: 'wallet-outline', iconOn: 'wallet', perm: ['finance', 'finance_view'] },
  { route: 'more', href: '/more', label: 'tab_more', icon: 'grid-outline', iconOn: 'grid' },
];

export const MORE_ITEMS: NavItem[] = [
  { route: 'promotion', href: '/promotion', label: 'm_promotion', icon: 'megaphone-outline', iconOn: 'megaphone', perm: ['promos'] },
  { route: 'promos', href: '/promos', label: 'm_promos', icon: 'pricetag-outline', iconOn: 'pricetag', perm: ['promos'] },
  { route: 'reports', href: '/reports', label: 'm_reports', icon: 'document-text-outline', iconOn: 'document-text', perm: ['reports'] },
  { route: 'staff', href: '/staff', label: 'm_staff', icon: 'people-outline', iconOn: 'people', perm: ['staff'] },
  { route: 'reviews', href: '/reviews', label: 'm_reviews', icon: 'star-outline', iconOn: 'star' },
  { route: 'settings', href: '/settings', label: 'm_settings', icon: 'storefront-outline', iconOn: 'storefront', perm: ['settings'] },
  { route: 'integrations', href: '/integrations', label: 'm_integrations', icon: 'git-network-outline', iconOn: 'git-network', perm: ['settings'] },
  { route: 'support/index', href: '/support', label: 'm_support', icon: 'chatbubbles-outline', iconOn: 'chatbubbles', perm: ['support'] },
  { route: 'notifications', href: '/notifications', label: 'm_notifications', icon: 'notifications-outline', iconOn: 'notifications' },
  { route: 'language', href: '/language', label: 'm_language', icon: 'language-outline', iconOn: 'language' },
];

/** Which sidebar/tab item is highlighted for a given (possibly hidden) route. */
export function activeFor(route: string): string {
  if (route.startsWith('order/')) return 'orders';
  if (route.startsWith('product/') || route === 'import') return 'products';
  if (route.startsWith('support/')) return 'support/index';
  return route;
}

export function allowed(item: NavItem, perms: Permission[]) {
  return !item.perm || item.perm.some((p) => perms.includes(p));
}

export function goBack(fallback: string) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
}
