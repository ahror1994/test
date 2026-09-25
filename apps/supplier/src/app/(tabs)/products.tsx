import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BRAND, formatPrice, type SupplierProduct } from '@taptym/shared';
import { Screen } from '@/components/Screen';
import { LoadError } from '@/components/LoadError';
import { Thumb } from '@/components/Thumb';
import { Button, Card, Chip, Divider, digits, Empty, Pill, Row, SkeletonList, Stepper, Toggle, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { C, FONT } from '@/lib/theme';
import { errorText, useT } from '@/lib/useT';
import { useLayout } from '@/lib/layout';
import { toast } from '@/lib/overlay';

type Filter = 'all' | 'low' | 'inactive' | 'expensive';

export default function Products() {
  const t = useT();
  const params = useLocalSearchParams<{ filter?: Filter }>();
  const { wide } = useLayout();
  const [filter, setFilter] = useState<Filter>(params.filter ?? 'all');
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  // "Все" on the dashboard's low-stock card links here with ?filter=low.
  const [paramSeen, setParamSeen] = useState(params.filter);
  if (params.filter !== paramSeen) {
    setParamSeen(params.filter);
    if (params.filter) setFilter(params.filter);
  }
  useEffect(() => {
    const id = setTimeout(() => setDq(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);
  const qs = new URLSearchParams({ ...(dq ? { q: dq } : {}), ...(filter !== 'all' ? { filter } : {}) }).toString();
  const { data, error, loading, refreshing, refresh, reload, setData } = useApi<{ items: SupplierProduct[] }>(`/api/s/products${qs ? '?' + qs : ''}`);

  const update = (p: SupplierProduct) => data && setData({ ...data, items: data.items.map((x) => (x.offerId === p.offerId ? p : x)) });

  const filters: { key: Filter; label: string; icon: any }[] = [
    { key: 'all', label: t('f_all'), icon: 'apps-outline' },
    { key: 'low', label: t('f_low'), icon: 'alert-circle-outline' },
    { key: 'inactive', label: t('f_inactive'), icon: 'eye-off-outline' },
    { key: 'expensive', label: t('f_expensive'), icon: 'trending-down-outline' },
  ];

  const actions = (
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: 10 }}>
      <Button title={t('add_product')} icon="camera" onPress={() => router.navigate('/product/new')} style={wide ? { flex: 1 } : undefined} testID="add-product" />
      <Button title={t('upload_excel')} icon="document-attach-outline" kind="secondary" size={wide ? 'lg' : 'md'} onPress={() => router.navigate('/import')} full={!wide} testID="upload-excel" />
    </View>
  );

  return (
    <Screen title={t('tab_products')} subtitle={data ? t('n_products', { n: data.items.length }) : undefined} refreshing={refreshing} onRefresh={refresh}>
      {actions}
      <View style={s.search}>
        <Ionicons name="search" size={20} color={C.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder={t('search_products')} placeholderTextColor={C.faint} style={[s.searchInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]} testID="product-search" />
        {q ? (
          <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityLabel={t('clear')}>
            <Ionicons name="close-circle" size={20} color={C.faint} />
          </Pressable>
        ) : null}
      </View>
      <Row gap={8} wrap>
        {filters.map((f) => (
          <Chip key={f.key} label={f.label} icon={f.icon} active={filter === f.key} onPress={() => setFilter(f.key)} tone={f.key === 'expensive' ? 'danger' : f.key === 'low' ? 'warning' : undefined} />
        ))}
      </Row>
      <LoadError error={error} onRetry={reload} compact={!!data} />
      {!data && error ? null : loading ? (
        <SkeletonList n={6} h={wide ? 72 : 130} />
      ) : data && data.items.length === 0 ? (
        <Empty emoji={filter === 'all' && !dq ? '📦' : '🔍'} title={filter === 'all' && !dq ? t('no_products') : t('nothing_found')} text={filter === 'all' && !dq ? t('no_products_sub') : undefined} action={filter === 'all' && !dq ? t('add_product') : undefined} onAction={() => router.navigate('/product/new')} />
      ) : (
        <Card pad={wide ? 8 : 6}>
          {wide ? (
            <Row style={s.th}>
              <Txt v="tiny" style={{ flex: 1 }}>
                {t('th_product').toUpperCase()}
              </Txt>
              <Txt v="tiny" style={{ width: 150 }}>
                {t('price').toUpperCase()}
              </Txt>
              <Txt v="tiny" style={{ width: 170 }}>
                {t('stock').toUpperCase()}
              </Txt>
              <Txt v="tiny" style={{ width: 80, textAlign: 'center' }}>
                {t('th_sold').toUpperCase()}
              </Txt>
              <Txt v="tiny" style={{ width: 70, textAlign: 'center' }}>
                {t('th_active').toUpperCase()}
              </Txt>
            </Row>
          ) : null}
          {(data?.items ?? []).map((p, i) => (
            <View key={p.offerId}>
              {i > 0 ? <Divider style={{ marginHorizontal: 10 }} /> : null}
              <ProductRow p={p} wide={wide} onUpdated={update} />
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

function ProductRow({ p, wide, onUpdated }: { p: SupplierProduct; wide: boolean; onUpdated: (p: SupplierProduct) => void }) {
  const t = useT();
  const [price, setPrice] = useState(String(p.price));
  const [stock, setStock] = useState(p.stock);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Follow server-side changes (refetch, dashboard quick actions) without clobbering typing in between.
  const [synced, setSynced] = useState({ price: p.price, stock: p.stock });
  if (synced.price !== p.price || synced.stock !== p.stock) {
    setSynced({ price: p.price, stock: p.stock });
    if (synced.price !== p.price) setPrice(String(p.price));
    if (synced.stock !== p.stock) setStock(p.stock);
  }

  const save = async (body: Partial<SupplierProduct>, msg: string) => {
    try {
      const fresh = await api<SupplierProduct>(`/api/s/products/${p.offerId}`, { method: 'PATCH', body });
      onUpdated(fresh);
      toast(msg);
    } catch (e) {
      toast(errorText(t, e), 'error');
      setPrice(String(p.price));
      setStock(p.stock);
    }
  };
  const savePrice = () => {
    const n = Number(price);
    if (!n || n === p.price) return setPrice(String(p.price));
    void save({ price: n }, t('price_saved', { p: formatPrice(n) }));
  };
  const changeStock = (n: number) => {
    setStock(n);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save({ stock: n }, t('stock_set', { n })), 700);
  };

  const cheaper = p.competitorMinPrice != null && p.competitorMinPrice < p.price;
  const open = () => router.navigate({ pathname: '/product/[id]', params: { id: String(p.offerId) } });
  const info = (
    <Pressable onPress={open} style={({ hovered }: any) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }, hovered && { opacity: 0.8 }]} accessibilityRole="link" testID={`product-${p.offerId}`}>
      <View style={!p.active && { opacity: 0.45 }}>
        <Thumb image={p.images[0]} emoji={p.emoji} color={p.color} size={wide ? 48 : 56} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Txt v="bodyB" numberOfLines={2} color={p.active ? C.ink : C.muted}>
          {p.title}
        </Txt>
        <Row gap={6} wrap>
          {cheaper ? <Pill tone="danger" icon="trending-down" label={t('comp_from', { p: formatPrice(p.competitorMinPrice!) })} /> : p.competitorMinPrice != null ? <Pill tone="success" icon="trophy-outline" label={t('best_price')} /> : null}
          {p.stock < 10 ? <Pill tone={p.stock === 0 ? 'danger' : 'warning'} label={p.stock === 0 ? t('out_of_stock') : t('left_n', { n: p.stock })} /> : null}
          {!p.active ? <Pill label={t('hidden')} icon="eye-off-outline" /> : null}
          {p.moderation === 'pending' ? <Pill tone="warning" label={t('moderation')} /> : null}
        </Row>
      </View>
    </Pressable>
  );
  const priceInput = (
    <View style={[s.priceBox, cheaper && { borderColor: C.danger + '66' }]}>
      <TextInput
        value={price}
        onChangeText={(x) => setPrice(digits(x))}
        onBlur={savePrice}
        onSubmitEditing={savePrice}
        keyboardType="number-pad"
        selectTextOnFocus
        accessibilityLabel={t('price')}
        style={[s.priceInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
        testID={`price-${p.offerId}`}
      />
      <Txt v="capB">{BRAND.currency}</Txt>
    </View>
  );
  const toggle = <Toggle value={p.active} onChange={(v) => void save({ active: v }, v ? t('shown') : t('hidden_toast'))} label={t('th_active')} />;

  if (wide)
    return (
      <Row gap={12} style={{ paddingHorizontal: 10, paddingVertical: 10 }}>
        {info}
        <View style={{ width: 150 }}>{priceInput}</View>
        <View style={{ width: 170 }}>
          <Stepper compact value={stock} onChange={changeStock} />
        </View>
        <Txt v="bodyB" style={{ width: 80, textAlign: 'center' }}>
          {p.sold30d}
        </Txt>
        <View style={{ width: 70, alignItems: 'center' }}>{toggle}</View>
      </Row>
    );
  return (
    <View style={{ padding: 10, gap: 12 }}>
      <Row gap={8} style={{ alignItems: 'flex-start' }}>
        {info}
        {toggle}
      </Row>
      <Row gap={10}>
        <View style={{ flex: 1 }}>{priceInput}</View>
        <View style={{ flex: 1.3 }}>
          <Stepper compact value={stock} onChange={changeStock} />
        </View>
      </Row>
    </View>
  );
}

const s = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 54, borderRadius: 18, backgroundColor: C.card, paddingHorizontal: 16, borderWidth: 1.5, borderColor: C.line },
  searchInput: { flex: 1, fontSize: 16, fontWeight: '600', color: C.ink, fontFamily: FONT, minWidth: 0 },
  th: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, gap: 12 },
  priceBox: { flexDirection: 'row', alignItems: 'center', height: 40, borderRadius: 12, backgroundColor: C.bg, paddingHorizontal: 12, gap: 6, borderWidth: 1.5, borderColor: 'transparent' },
  priceInput: { flex: 1, fontSize: 16, fontWeight: '800', color: C.ink, fontFamily: FONT, minWidth: 0 },
});
