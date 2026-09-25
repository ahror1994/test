import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { TabBar } from '@/components/TabBar';
import { useLayout } from '@/lib/layout';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { useT } from '@/lib/useT';
import { toast } from '@/lib/overlay';
import { haptic } from '@/lib/haptics';
import { BRAND } from '@taptym/shared';

const HIDDEN = [
  'order/[id]',
  'product/new',
  'product/[id]',
  'import',
  'promotion',
  'promos',
  'staff',
  'reports',
  'reviews',
  'settings',
  'integrations',
  'support/index',
  'support/[id]',
  'notifications',
  'language',
];

export default function TabsLayout() {
  const { wide } = useLayout();
  const ready = useStore((s) => s.ready);
  const token = useStore((s) => s.token);
  const newOrders = useStore((s) => s.me?.newOrders ?? 0);
  const t = useT();
  const prev = useRef<number | null>(null);

  // Keeps the Orders badge fresh and announces new orders wherever the user is.
  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => void useStore.getState().loadMe(), 15000);
    return () => clearInterval(id);
  }, [token]);
  useEffect(() => {
    if (prev.current != null && newOrders > prev.current) {
      haptic.success();
      toast(t('new_order_toast'), 'info');
    }
    prev.current = newOrders;
  }, [newOrders, t]);

  if (!ready)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  if (!token) return <Redirect href="/login" />;

  const title = (k: Parameters<typeof t>[0]) => `${t(k)} · ${BRAND.supplierAppName}`;
  return (
    <Tabs
      backBehavior="history"
      tabBar={(p) => <TabBar {...p} />}
      screenOptions={{ headerShown: false, tabBarPosition: wide ? 'left' : 'bottom', sceneStyle: { backgroundColor: C.bg } }}
    >
      <Tabs.Screen name="index" options={{ title: title('tab_home') }} />
      <Tabs.Screen name="orders" options={{ title: title('tab_orders') }} />
      <Tabs.Screen name="products" options={{ title: title('tab_products') }} />
      <Tabs.Screen name="finance" options={{ title: title('tab_finance') }} />
      <Tabs.Screen name="more" options={{ title: title('tab_more') }} />
      {HIDDEN.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null, title: BRAND.supplierAppName }} />
      ))}
    </Tabs>
  );
}
