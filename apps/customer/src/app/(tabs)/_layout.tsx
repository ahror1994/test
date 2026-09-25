import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { Platform, useWindowDimensions, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { cartCount, useApp } from '@/lib/store';
import { C } from '@/lib/theme';
import type { IconName } from '@/components/ui';

const icon = (on: IconName, off: IconName) => {
  const TabIcon = ({ focused, color }: { focused: boolean; color: ColorValue }) => <Ionicons name={focused ? on : off} size={24} color={color as string} />;
  return TabIcon;
};

export default function TabsLayout() {
  const t = useT();
  const count = useApp((s) => cartCount(s.cart));
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const side = width >= 1024;
  return (
    <Tabs
      screenListeners={{ tabPress: () => haptic.select() }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: '#8A8FA3',
        tabBarPosition: side ? 'left' : 'bottom',
        tabBarVariant: side ? 'material' : 'uikit',
        tabBarLabelPosition: side ? 'beside-icon' : 'below-icon',
        tabBarLabelStyle: { fontSize: side ? 15 : 11, fontWeight: '700', marginTop: side ? 0 : 2 },
        tabBarItemStyle: side ? { borderRadius: 16, marginVertical: 2, paddingHorizontal: 8, minHeight: 52 } : { paddingTop: 6 },
        tabBarActiveBackgroundColor: side ? C.primarySoft : undefined,
        tabBarStyle: side
          ? { width: 248, minWidth: 248, backgroundColor: C.white, borderRightWidth: 0, paddingTop: 24, paddingHorizontal: 12, boxShadow: '1px 0px 0px #ECEDF3' }
          : {
              backgroundColor: C.white,
              borderTopWidth: 0,
              height: 64 + (Platform.OS === 'web' ? Math.max(insets.bottom, 8) : insets.bottom),
              paddingBottom: Platform.OS === 'web' ? Math.max(insets.bottom, 8) : insets.bottom,
              boxShadow: '0px -1px 0px #ECEDF3, 0px -8px 24px rgba(16,24,40,0.05)',
            },
        tabBarBadgeStyle: { backgroundColor: C.danger, fontSize: 11, fontWeight: '800', minWidth: 18, height: 18, lineHeight: 16 },
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tab_home'), tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen name="search" options={{ title: t('tab_search'), tabBarIcon: icon('search', 'search-outline') }} />
      <Tabs.Screen
        name="cart"
        options={{ title: t('tab_cart'), tabBarIcon: icon('bag-handle', 'bag-handle-outline'), tabBarBadge: count > 0 ? (count > 99 ? '99+' : count) : undefined }}
      />
      <Tabs.Screen name="orders" options={{ title: t('tab_orders'), tabBarIcon: icon('receipt', 'receipt-outline') }} />
      <Tabs.Screen name="profile" options={{ title: t('tab_profile'), tabBarIcon: icon('person-circle', 'person-circle-outline') }} />
    </Tabs>
  );
}
