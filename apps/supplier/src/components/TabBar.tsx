import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND } from '@taptym/shared';
import { C, FONT } from '@/lib/theme';
import { useLayout } from '@/lib/layout';
import { activeFor, allowed, MAIN_TABS, MORE_ITEMS, type NavItem } from '@/lib/nav';
import { useStore } from '@/lib/store';
import { useT } from '@/lib/useT';
import { haptic } from '@/lib/haptics';
import { confirm } from '@/lib/overlay';

export function TabBar({ state }: BottomTabBarProps) {
  const { wide } = useLayout();
  const insets = useSafeAreaInsets();
  const me = useStore((s) => s.me);
  const t = useT();
  const perms = me?.permissions ?? [];
  const current = state.routes[state.index]?.name ?? 'index';
  const active = activeFor(current);
  const tabs = MAIN_TABS.filter((x) => allowed(x, perms));
  const badge = (x: NavItem) => (x.route === 'orders' ? me?.newOrders : x.route === 'support/index' || x.route === 'notifications' ? 0 : 0) || 0;
  const go = (x: NavItem) => {
    haptic.tap();
    router.navigate(x.href as never);
  };

  if (!wide) {
    // Detail screens are full-screen on phones.
    if (!MAIN_TABS.some((x) => x.route === current)) return null;
    return (
      <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {tabs.map((x) => {
          const on = active === x.route;
          const b = badge(x);
          return (
            <Pressable key={x.route} accessibilityRole="tab" accessibilityLabel={t(x.label)} accessibilityState={{ selected: on }} onPress={() => go(x)} style={s.tab} testID={`tab-${x.route}`}>
              <View style={[s.tabIcon, on && { backgroundColor: C.primarySoft }]}>
                <Ionicons name={on ? x.iconOn : x.icon} size={23} color={on ? C.primary : C.muted} />
                {b ? (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{b > 99 ? '99+' : b}</Text>
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={1} style={[s.tabLabel, on && { color: C.primary }]}>
                {t(x.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  const extra = MORE_ITEMS.filter((x) => allowed(x, perms));
  const item = (x: NavItem) => {
    const on = active === x.route;
    const b = badge(x);
    return (
      <Pressable
        key={x.route}
        accessibilityRole="link"
        accessibilityLabel={t(x.label)}
        onPress={() => go(x)}
        testID={`nav-${x.route}`}
        style={({ hovered }: any) => [s.side, on && { backgroundColor: C.primarySoft }, hovered && !on && { backgroundColor: C.bg }]}
      >
        <Ionicons name={on ? x.iconOn : x.icon} size={20} color={on ? C.primary : C.ink2} />
        <Text numberOfLines={2} style={[s.sideLabel, on && { color: C.primary }]}>
          {t(x.label)}
        </Text>
        {b ? (
          <View style={[s.badge, { position: 'relative', top: 0, right: 0 }]}>
            <Text style={s.badgeText}>{b}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };
  return (
    <View style={s.sidebar}>
      <View style={s.logo}>
        <View style={s.logoMark}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>T</Text>
        </View>
        <View>
          <Text style={s.logoText}>
            Tap<Text style={{ color: C.primary }}>tym</Text>
          </Text>
          <Text style={s.logoSub}>{t('business')}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ gap: 2, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
        {tabs.filter((x) => x.route !== 'more').map(item)}
        <Text style={s.group}>{t('tools')}</Text>
        {extra.map(item)}
      </ScrollView>
      <Pressable onPress={() => router.navigate('/more')} style={({ hovered }: any) => [s.store, hovered && { backgroundColor: C.bg }]} accessibilityLabel={t('tab_more')}>
        <View style={[s.storeLogo, { backgroundColor: me?.color ?? C.primarySoft }]}>
          <Text style={{ fontSize: 20 }}>{me?.logoEmoji ?? '🏪'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={s.storeName}>
            {me?.name}
          </Text>
          <Text numberOfLines={1} style={s.logoSub}>
            {me?.staffName} · {me ? t(`role_${me.myRole}` as never) : ''}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={t('logout')}
          hitSlop={8}
          onPress={async () => {
            if (await confirm({ title: t('logout_q'), confirmText: t('logout'), danger: true })) void useStore.getState().signOut();
          }}
        >
          <Ionicons name="log-out-outline" size={22} color={C.muted} />
        </Pressable>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8, paddingHorizontal: 4 },
  tab: { flex: 1, alignItems: 'center', gap: 3, minHeight: 52 },
  tabIcon: { width: 58, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 11, fontWeight: '700', color: C.muted, fontFamily: FONT },
  badge: { position: 'absolute', top: -4, right: 6, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  sidebar: { width: 256, backgroundColor: C.card, borderRightWidth: 1, borderRightColor: C.line, paddingHorizontal: 14, paddingTop: 22, paddingBottom: 14, gap: 12, ...(Platform.OS === 'web' ? ({ height: '100vh' } as any) : {}) },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingBottom: 10 },
  logoMark: { width: 38, height: 38, borderRadius: 12, backgroundColor: BRAND.primary, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 20, fontWeight: '900', color: C.ink, letterSpacing: -0.5, fontFamily: FONT },
  logoSub: { fontSize: 12, fontWeight: '600', color: C.muted, fontFamily: FONT },
  side: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 46, paddingVertical: 5, paddingHorizontal: 12, borderRadius: 14 },
  sideLabel: { flex: 1, fontSize: 15, lineHeight: 19, fontWeight: '700', color: C.ink2, fontFamily: FONT },
  group: { fontSize: 11, fontWeight: '800', color: C.faint, letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 12, paddingTop: 18, paddingBottom: 6, fontFamily: FONT },
  store: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 18, borderWidth: 1, borderColor: C.line },
  storeLogo: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  storeName: { fontSize: 14, fontWeight: '800', color: C.ink, fontFamily: FONT },
});
