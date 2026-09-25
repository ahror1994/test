import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ProductCard } from '@taptym/shared';
import { api, type ApiError } from '@/lib/api';
import { C, R } from '@/lib/theme';
import { useT, type TKey } from '@/i18n';
import { GridSkeleton, ProductGrid } from './product';
import { Button, Chip, Empty, ErrorState, Field, Row, Sheet, Toggle, Txt } from './ui';

export type Sort = 'popular' | 'price_asc' | 'price_desc' | 'rating' | 'savings' | 'new';
export type Filters = { minPrice: string; maxPrice: string; inStock: boolean; deals: boolean };
export const emptyFilters: Filters = { minPrice: '', maxPrice: '', inStock: false, deals: false };

const SORTS: { id: Sort; key: TKey }[] = [
  { id: 'popular', key: 'sort_popular' },
  { id: 'price_asc', key: 'sort_price_asc' },
  { id: 'savings', key: 'sort_savings' },
  { id: 'rating', key: 'sort_rating' },
  { id: 'new', key: 'sort_new' },
  { id: 'price_desc', key: 'sort_price_desc' },
];

type Result = { items: ProductCard[]; total: number; correctedQuery: string | null; priceRange: { min: number; max: number } };

const PAGE = 24;

/** Loads `/products` with sort, filters and "show more" paging. */
export function useCatalog(base: Record<string, string | undefined>, sort: Sort, f: Filters, enabled = true) {
  const [items, setItems] = useState<ProductCard[]>([]);
  const [meta, setMeta] = useState<Omit<Result, 'items'> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const seq = useRef(0);
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) if (v) qs.set(k, v);
  qs.set('sort', sort);
  if (f.minPrice) qs.set('minPrice', f.minPrice);
  if (f.maxPrice) qs.set('maxPrice', f.maxPrice);
  if (f.inStock) qs.set('inStock', '1');
  if (f.deals) qs.set('deals', '1');
  qs.set('limit', String(PAGE));
  const key = qs.toString();

  const load = async (p: number) => {
    const id = ++seq.current;
    setLoading(true);
    try {
      const r = await api<Result>(`/products?${key}&page=${p}`);
      if (id !== seq.current) return;
      setItems((prev) => (p === 1 ? r.items : [...prev, ...r.items.filter((x) => !prev.some((y) => y.id === x.id))]));
      setMeta({ total: r.total, correctedQuery: r.correctedQuery, priceRange: r.priceRange });
      setPage(p);
      setError(null);
    } catch (e) {
      if (id === seq.current) setError(e as ApiError);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled) return;
    setItems([]);
    setMeta(null);
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return {
    items,
    meta,
    loading,
    error,
    hasMore: !!meta && items.length < meta.total,
    more: () => load(page + 1),
    reload: () => load(1),
  };
}

export function activeFilterCount(f: Filters) {
  return (f.minPrice ? 1 : 0) + (f.maxPrice ? 1 : 0) + (f.inStock ? 1 : 0) + (f.deals ? 1 : 0);
}

export function SortChips({ sort, onSort, filters, onFilters }: { sort: Sort; onSort: (s: Sort) => void; filters: Filters; onFilters: () => void }) {
  const t = useT();
  const n = activeFilterCount(filters);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 2 }}>
      <Pressable onPress={onFilters} style={({ pressed }) => [s.filterBtn, n > 0 && { backgroundColor: C.primary, borderColor: C.primary }, pressed && { opacity: 0.8 }]}>
        <Ionicons name="options-outline" size={18} color={n > 0 ? C.white : C.ink} />
        <Text style={[s.filterText, n > 0 && { color: C.white }]}>{t('filters')}</Text>
        {n > 0 ? (
          <View style={s.filterCount}>
            <Text style={{ color: C.primary, fontSize: 11, fontWeight: '800' }}>{n}</Text>
          </View>
        ) : null}
      </Pressable>
      {SORTS.map((x) => (
        <Chip key={x.id} label={t(x.key)} selected={sort === x.id} onPress={() => onSort(x.id)} />
      ))}
    </ScrollView>
  );
}

export function FilterSheet({
  visible,
  onClose,
  value,
  onApply,
  range,
}: {
  visible: boolean;
  onClose: () => void;
  value: Filters;
  onApply: (f: Filters) => void;
  range?: { min: number; max: number } | null;
}) {
  const t = useT();
  const [f, setF] = useState(value);
  useEffect(() => {
    if (visible) setF(value);
  }, [visible, value]);
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 7);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('filters')}
      footer={
        <Row gap={10}>
          <Button title={t('reset')} v="secondary" onPress={() => setF(emptyFilters)} style={{ flex: 1 }} />
          <Button
            title={t('show_results')}
            onPress={() => {
              onApply(f);
              onClose();
            }}
            style={{ flex: 2 }}
          />
        </Row>
      }
    >
      <Txt v="h3" style={{ marginTop: 8, marginBottom: 10 }}>
        {t('price_range')}
      </Txt>
      <Row gap={10}>
        <Field
          style={{ flex: 1 }}
          placeholder={range ? `${t('price_from')} ${range.min}` : t('price_from')}
          keyboardType="number-pad"
          value={f.minPrice}
          onChangeText={(v) => setF({ ...f, minPrice: digits(v) })}
        />
        <Field
          style={{ flex: 1 }}
          placeholder={range ? `${t('price_to')} ${range.max}` : t('price_to')}
          keyboardType="number-pad"
          value={f.maxPrice}
          onChangeText={(v) => setF({ ...f, maxPrice: digits(v) })}
        />
      </Row>
      <Row wrap gap={8} style={{ marginTop: 10 }}>
        {[
          [0, 50],
          [50, 200],
          [200, 500],
          [500, 0],
        ].map(([a, b]) => (
          <Chip
            key={`${a}-${b}`}
            label={b ? `${a}–${b}` : `${a}+`}
            selected={f.minPrice === (a ? String(a) : '') && f.maxPrice === (b ? String(b) : '')}
            onPress={() => setF({ ...f, minPrice: a ? String(a) : '', maxPrice: b ? String(b) : '' })}
          />
        ))}
      </Row>
      <View style={s.switchCard}>
        <Pressable style={s.switchRow} onPress={() => setF({ ...f, inStock: !f.inStock })}>
          <Ionicons name="cube-outline" size={22} color={C.primary} />
          <Txt v="bodyBold" style={{ flex: 1 }}>
            {t('in_stock_only')}
          </Txt>
          <Toggle value={f.inStock} onChange={(v) => setF({ ...f, inStock: v })} />
        </Pressable>
        <View style={{ height: 1, backgroundColor: C.line, marginLeft: 50 }} />
        <Pressable style={s.switchRow} onPress={() => setF({ ...f, deals: !f.deals })}>
          <Ionicons name="pricetag-outline" size={22} color={C.primary} />
          <Txt v="bodyBold" style={{ flex: 1 }}>
            {t('deals_only')}
          </Txt>
          <Toggle value={f.deals} onChange={(v) => setF({ ...f, deals: v })} />
        </Pressable>
      </View>
    </Sheet>
  );
}

/** Sort chips + filters + grid + paging, used by search, category and store screens. */
export function CatalogBlock({
  base,
  initialSort = 'popular',
  initialFilters = emptyFilters,
  header,
  emptyTitle,
  enabled = true,
}: {
  base: Record<string, string | undefined>;
  initialSort?: Sort;
  initialFilters?: Filters;
  header?: (meta: { total: number; correctedQuery: string | null } | null) => React.ReactNode;
  emptyTitle?: string;
  enabled?: boolean;
}) {
  const t = useT();
  const [sort, setSort] = useState<Sort>(initialSort);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [sheet, setSheet] = useState(false);
  const c = useCatalog(base, sort, filters, enabled);
  return (
    <View>
      <SortChips sort={sort} onSort={setSort} filters={filters} onFilters={() => setSheet(true)} />
      {header ? header(c.meta) : null}
      <View style={{ marginTop: 14 }}>
        {c.error && !c.items.length ? (
          <ErrorState error={c.error} onRetry={c.reload} />
        ) : !c.meta ? (
          <GridSkeleton n={6} />
        ) : c.items.length === 0 ? (
          <Empty
            emoji="🔍"
            title={emptyTitle ?? t('nothing_found')}
            sub={t('nothing_found_tips')}
            action={activeFilterCount(filters) ? t('reset') : undefined}
            onAction={() => setFilters(emptyFilters)}
          />
        ) : (
          <>
            <ProductGrid items={c.items} />
            {c.hasMore ? <Button title={t('show_more')} v="secondary" loading={c.loading} onPress={c.more} style={{ marginTop: 20 }} /> : null}
          </>
        )}
      </View>
      <FilterSheet visible={sheet} onClose={() => setSheet(false)} value={filters} onApply={setFilters} range={c.meta?.priceRange} />
    </View>
  );
}

const s = StyleSheet.create({
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: R.pill, backgroundColor: C.white, borderWidth: 1, borderColor: C.line },
  filterText: { fontSize: 14, fontWeight: '700', color: C.ink },
  filterCount: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
  switchCard: { marginTop: 20, backgroundColor: C.white, borderRadius: R.xl, overflow: 'hidden' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, minHeight: 60 },
});
