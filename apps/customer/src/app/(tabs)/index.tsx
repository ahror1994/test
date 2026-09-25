import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, type Banner, type ProductCard, type SupplierPublic } from '@taptym/shared';
import { BannerCard, BannerCarousel } from '@/components/banners';
import { GridSkeleton, ProductGrid, ProductRow, StoreCard } from '@/components/product';
import { ErrorState, IconLabel, Row, Screen, Section, Skeleton, styles as ui, Txt, useContentWidth } from '@/components/ui';
import { useT } from '@/i18n';
import { addSchoolList } from '@/lib/actions';
import { useQuery } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { useApp } from '@/lib/store';
import { C, gradient, R, shadow } from '@/lib/theme';

type Home = {
  banners: Banner[];
  popular: ProductCard[];
  deals: ProductCard[];
  suppliers: SupplierPublic[];
  seasonal: string;
  schoolLists: { id: string; title: string; emoji: string; itemsCount: number }[];
};

export default function HomeScreen() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const q = useQuery<Home>('/home', { refetchOnFocus: true });
  const width = useContentWidth();
  const { width: winW } = useWindowDimensions();
  const d = q.data;
  const top = d?.banners.filter((b) => b.placement === 'home_top') ?? [];
  const middle = d?.banners.filter((b) => b.placement === 'home_middle') ?? [];
  const bannerW = winW >= 900 ? Math.min(width, 720) : width;
  const catCols = width >= 700 ? 8 : 4;
  const catW = Math.floor((width - 10 * (catCols - 1)) / catCols);

  return (
    <Screen header={<HomeHeader />} refreshing={q.refreshing} onRefresh={q.refresh}>
      <SearchBar />
      {q.error && !d ? (
        <ErrorState error={q.error} onRetry={q.refresh} />
      ) : !d ? (
        <View style={{ gap: 16, marginTop: 16 }}>
          <Skeleton h={156} r={R.xxl} />
          <Skeleton h={120} r={R.xxl} />
          <GridSkeleton n={4} />
        </View>
      ) : (
        <>
          <View style={{ marginTop: 16 }}>
            <BannerCarousel banners={top} width={bannerW} />
          </View>

          {d.seasonal === 'back_to_school' && d.schoolLists.length ? <SchoolBlock lists={d.schoolLists} /> : null}

          <Section title={t('categories')}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, rowGap: 14 }}>
              {CATEGORIES.map((c) => {
                const label = c.name[lang] ?? c.name.ru;
                // Labels may use the gap next to the tile; long single words (kk/ky) shrink instead of breaking mid-word.
                const labelW = catW + 10;
                const longest = Math.max(...label.split(/\s+/).map((w) => w.length));
                const fs = Math.max(9, Math.min(11, labelW / (longest * 0.7)));
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      haptic.tap();
                      router.push(`/category/${c.id}`);
                    }}
                    style={({ pressed }) => [{ width: catW, alignItems: 'center', gap: 6 }, pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] }]}
                  >
                    <View style={[s.cat, { backgroundColor: c.color, width: Math.min(catW, 84), height: Math.min(catW, 84) }]}>
                      <Text style={{ fontSize: Math.min(catW, 84) * 0.44 }}>{c.emoji}</Text>
                    </View>
                    {/* Text is capped at its parent's width on web, so a View carries the wider label box. */}
                    <View style={{ width: labelW, alignItems: 'center' }}>
                      <Txt v="small" center lines={2} style={{ color: C.ink, fontWeight: '700', fontSize: fs, lineHeight: Math.round(fs * 1.3), letterSpacing: -0.2 }}>
                        {label}
                      </Txt>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Section>

          {d.deals.length ? (
            <Section title={t('deals_now')} action={t('all')} onAction={() => router.push({ pathname: '/search', params: { deals: '1', sort: 'savings' } })}>
              <ProductRow items={d.deals} />
            </Section>
          ) : null}

          {middle.map((b) => (
            <View key={b.id} style={{ marginTop: 28 }}>
              <BannerCard b={b} width={width} height={120} />
            </View>
          ))}

          <Section title={t('popular')} action={t('all')} onAction={() => router.push({ pathname: '/search', params: { sort: 'popular', all: '1' } })}>
            <ProductGrid items={d.popular} />
          </Section>

          <Section title={t('stores_osh')}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 4 }}>
              {d.suppliers.map((sup) => (
                <StoreCard key={sup.id} s={sup} />
              ))}
            </ScrollView>
          </Section>
        </>
      )}
    </Screen>
  );
}

function HomeHeader() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const profile = useApp((s) => s.profile);
  const addressId = useApp((s) => s.addressId);
  const token = useApp((s) => s.token);
  const unread = useApp((s) => s.unread);
  const addr = profile?.addresses.find((a) => a.id === addressId) ?? profile?.addresses[0];
  return (
    <View style={{ paddingTop: insets.top + 10, backgroundColor: C.bg }}>
      <Row style={[ui.page, ui.pagePad, { paddingBottom: 6, justifyContent: 'space-between' }]} gap={12}>
        <Pressable
          onPress={() => {
            haptic.tap();
            router.push(token ? '/addresses' : { pathname: '/login', params: { next: '/addresses' } });
          }}
          style={({ pressed }) => [s.addr, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          <View style={s.addrIcon}>
            <Ionicons name="location" size={18} color={C.primary} />
          </View>
          <View style={{ flexShrink: 1 }}>
            <Txt v="tiny" color={C.muted}>
              {t('deliver_to')}
            </Txt>
            <Row gap={2}>
              <Txt v="bodyBold" lines={1} style={{ flexShrink: 1 }}>
                {addr ? `${addr.label} · ${addr.line.replace(/^Ош,\s*/, '')}` : t('choose_address')}
              </Txt>
              <Ionicons name="chevron-down" size={16} color={C.ink} />
            </Row>
          </View>
        </Pressable>
        <IconLabel
          icon="notifications-outline"
          label={t('notifications')}
          badge={unread}
          onPress={() => router.push(token ? '/notifications' : { pathname: '/login', params: { next: '/notifications' } })}
        />
      </Row>
    </View>
  );
}

function SearchBar() {
  const t = useT();
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        router.push({ pathname: '/search', params: { focus: String(Date.now()) } });
      }}
      style={({ pressed }) => [s.search, pressed && { opacity: 0.9 }]}
      accessibilityRole="search"
    >
      <Ionicons name="search" size={22} color={C.primary} />
      <Txt v="body" color={C.faint} style={{ flex: 1, fontSize: 16 }} lines={1}>
        {t('search_placeholder')}
      </Txt>
      <View style={s.searchGo}>
        <Ionicons name="arrow-forward" size={18} color={C.white} />
      </View>
    </Pressable>
  );
}

function SchoolBlock({ lists }: { lists: Home['schoolLists'] }) {
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const add = async (id: string) => {
    setBusy(id);
    await addSchoolList(id);
    setBusy(null);
  };
  return (
    <View style={[s.school, gradient('linear-gradient(135deg, #FFF4CC 0%, #FFE9D6 100%)', '#FFF4CC')]}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Txt v="h2">🎒 {t('back_to_school')}</Txt>
          <Txt v="small" style={{ color: '#6B5A2B', marginTop: 4 }}>
            {t('back_to_school_sub')}
          </Txt>
        </View>
        <Pressable onPress={() => router.push('/school')} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 32 }}>
          <Txt v="bodyBold" color={C.primary}>
            {t('all')}
          </Txt>
          <Ionicons name="chevron-forward" size={16} color={C.primary} />
        </Pressable>
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, marginTop: 14 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
        {lists.map((l) => (
          <View key={l.id} style={s.schoolCard}>
            <Text style={{ fontSize: 34 }}>{l.emoji}</Text>
            <Txt v="bodyBold" lines={2} style={{ minHeight: 42 }}>
              {l.title}
            </Txt>
            <Txt v="small">{t('items_count', { n: l.itemsCount })}</Txt>
            <Pressable
              onPress={() => add(l.id)}
              disabled={!!busy}
              style={({ pressed }) => [s.schoolBtn, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
            >
              {busy === l.id ? (
                <ActivityIndicator color={C.white} size="small" />
              ) : (
                <>
                  <Ionicons name="flash" size={16} color={C.accent} />
                  <Text style={{ color: C.white, fontWeight: '800', fontSize: 14 }}>{t('add_set')}</Text>
                </>
              )}
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  addr: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, minHeight: 48 },
  addrIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 58, borderRadius: R.xl, backgroundColor: C.white, paddingLeft: 18, paddingRight: 7, marginTop: 8, borderWidth: 2, borderColor: C.primary, ...shadow.md },
  searchGo: { width: 44, height: 44, borderRadius: 16, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  cat: { borderRadius: R.xl, alignItems: 'center', justifyContent: 'center' },
  school: { marginTop: 24, borderRadius: R.xxl, padding: 16 },
  schoolCard: { width: 170, backgroundColor: C.white, borderRadius: R.xl, padding: 14, gap: 6, ...shadow.sm },
  schoolBtn: { marginTop: 6, height: 44, borderRadius: R.md, backgroundColor: C.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
