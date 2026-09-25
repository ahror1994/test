import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BRAND, CATEGORIES, formatPrice, type SupplierProduct } from '@taptym/shared';
import { api, mediaUrl, uploadFile } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { C, R } from '@/lib/theme';
import { errorText, useT } from '@/lib/useT';
import { useStore } from '@/lib/store';
import { toast } from '@/lib/overlay';
import { useLayout } from '@/lib/layout';
import { Button, Card, Chip, digits, Field, Notice, Row, Stepper, SwitchRow, Txt } from './ui';
import { Thumb } from './Thumb';

type Match = { id: number; title: string; emoji: string; color: string; category_id: string; images: string[]; brand: string | null; min_price?: number | null };

export type ProductFormValue = {
  images: string[];
  title: string;
  productId: number | null;
  categoryId: string;
  price: string;
  oldPrice: string;
  stock: number;
  wholesalePrice: string;
  wholesaleFrom: string;
  barcode: string;
  brand: string;
  description: string;
  videoUrl: string;
  active: boolean;
};

export function emptyProduct(): ProductFormValue {
  return { images: [], title: '', productId: null, categoryId: '', price: '', oldPrice: '', stock: 10, wholesalePrice: '', wholesaleFrom: '', barcode: '', brand: '', description: '', videoUrl: '', active: true };
}

export function fromProduct(p: SupplierProduct): ProductFormValue {
  const s = (n: number | null) => (n == null ? '' : String(n));
  return {
    images: p.images,
    title: p.title,
    productId: p.productId,
    categoryId: p.categoryId,
    price: String(p.price),
    oldPrice: s(p.oldPrice),
    stock: p.stock,
    wholesalePrice: s(p.wholesalePrice),
    wholesaleFrom: s(p.wholesaleFrom),
    barcode: p.barcode ?? '',
    brand: p.brand ?? '',
    description: p.description,
    videoUrl: '',
    active: p.active,
  };
}

export function toBody(v: ProductFormValue) {
  const n = (x: string) => (x.trim() === '' ? null : Number(x));
  return {
    productId: v.productId ?? undefined,
    title: v.title.trim(),
    categoryId: v.categoryId || CATEGORIES[0].id,
    images: v.images,
    price: Number(v.price),
    oldPrice: n(v.oldPrice),
    stock: v.stock,
    wholesalePrice: n(v.wholesalePrice),
    wholesaleFrom: n(v.wholesaleFrom),
    barcode: v.barcode.trim() || null,
    brand: v.brand.trim() || null,
    description: v.description.trim(),
    videoUrl: v.videoUrl.trim() || null,
  };
}

/** Photo → title (with catalog match) → category → price/stock. `mode=edit` hides catalog matching. */
export function ProductForm({ value, onChange, mode }: { value: ProductFormValue; onChange: (v: ProductFormValue) => void; mode: 'new' | 'edit' }) {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const { wide } = useLayout();
  const [uploading, setUploading] = useState(0);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matched, setMatched] = useState<Match | null>(null);
  const [more, setMore] = useState(mode === 'edit');
  const mine = useApi<{ items: SupplierProduct[] }>(mode === 'new' ? '/api/s/products' : null);
  const myIds = new Set((mine.data?.items ?? []).map((x) => x.productId));
  const v = value;
  const set = (patch: Partial<ProductFormValue>) => onChange({ ...v, ...patch });
  const latest = useRef(v);
  latest.current = v;

  useEffect(() => {
    if (mode !== 'new' || matched) return;
    const q = v.title.trim();
    if (q.length < 3) {
      setMatches([]);
      return;
    }
    const id = setTimeout(() => {
      void api<Match[]>(`/api/s/catalog/match?q=${encodeURIComponent(q)}`)
        .then(setMatches)
        .catch(() => setMatches([]));
    }, 300);
    return () => clearTimeout(id);
  }, [v.title, mode, matched]);

  const pickMatch = (m: Match) => {
    setMatched(m);
    setMatches([]);
    set({ productId: m.id, title: m.title, categoryId: m.category_id, brand: m.brand ?? '' });
  };

  const checkBarcode = async () => {
    const b = v.barcode.trim();
    if (mode !== 'new' || matched || b.length < 6) return;
    try {
      const r = await api<Match[]>(`/api/s/catalog/match?barcode=${encodeURIComponent(b)}`);
      if (r.length) setMatches(r);
    } catch {}
  };

  const pick = async (camera: boolean) => {
    try {
      if (camera && Platform.OS !== 'web') {
        const p = await ImagePicker.requestCameraPermissionsAsync();
        if (!p.granted) return toast(t('perm_camera'), 'error');
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
      const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync({ ...opts, allowsMultipleSelection: true, selectionLimit: 8 });
      if (res.canceled) return;
      setUploading((n) => n + res.assets.length);
      for (const a of res.assets) {
        try {
          const up = await uploadFile('/api/s/upload', { uri: a.uri, name: a.fileName || `photo-${Date.now()}.jpg`, mimeType: a.mimeType ?? 'image/jpeg', file: (a as any).file ?? null });
          onChange({ ...latest.current, images: [...latest.current.images, up.url] });
          latest.current = { ...latest.current, images: [...latest.current.images, up.url] };
        } catch (e) {
          toast(errorText(t, e), 'error');
        } finally {
          setUploading((n) => n - 1);
        }
      }
    } catch (e) {
      toast(errorText(t, e), 'error');
    }
  };

  const photos = (
    <Card style={{ gap: 12 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="h3">1. {t('pf_photos')}</Txt>
        <Txt v="cap">{t('pf_photos_hint')}</Txt>
      </Row>
      <Row gap={10} wrap>
        <Pressable onPress={() => pick(true)} style={({ pressed }) => [s.pickBig, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel={t('pf_camera')} testID="pick-camera">
          <Ionicons name="camera" size={30} color="#fff" />
          <Text style={s.pickBigText}>{t('pf_camera')}</Text>
        </Pressable>
        <Pressable onPress={() => pick(false)} style={({ pressed }) => [s.pick, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel={t('pf_gallery')} testID="pick-gallery">
          <Ionicons name="images-outline" size={28} color={C.primary} />
          <Text style={s.pickText}>{t('pf_gallery')}</Text>
        </Pressable>
        {v.images.map((u, i) => (
          <View key={u + i} style={s.photo}>
            <Image source={{ uri: mediaUrl(u)! }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            {i === 0 ? (
              <View style={s.mainBadge}>
                <Text style={s.mainBadgeText}>{t('pf_main')}</Text>
              </View>
            ) : null}
            <Pressable onPress={() => set({ images: v.images.filter((_, j) => j !== i) })} style={s.remove} accessibilityLabel={t('delete')} hitSlop={6}>
              <Ionicons name="close" size={14} color="#fff" />
            </Pressable>
          </View>
        ))}
        {uploading > 0 ? (
          <View style={[s.photo, { alignItems: 'center', justifyContent: 'center', backgroundColor: C.primarySoft }]}>
            <ActivityIndicator color={C.primary} />
          </View>
        ) : null}
      </Row>
    </Card>
  );

  const titleCard = (
    <Card style={{ gap: 12 }}>
      <Txt v="h3">2. {t('pf_title')}</Txt>
      {matched ? (
        <View style={s.matched}>
          <Thumb image={matched.images[0]} emoji={matched.emoji} color={matched.color} size={52} />
          <View style={{ flex: 1 }}>
            <Txt v="capB" color={C.success}>
              ✓ {t('pf_attached')}
            </Txt>
            <Txt v="bodyB">{matched.title}</Txt>
            {matched.min_price ? <Txt v="cap">{t('pf_others_from', { p: formatPrice(matched.min_price) })}</Txt> : null}
          </View>
          <Pressable
            onPress={() => {
              setMatched(null);
              set({ productId: null });
            }}
            hitSlop={8}
            accessibilityLabel={t('cancel')}
          >
            <Ionicons name="close-circle" size={24} color={C.faint} />
          </Pressable>
        </View>
      ) : (
        <Field value={v.title} onChangeText={(x) => set({ title: x })} placeholder={t('pf_title_ph')} testID="pf-title" />
      )}
      {!matched && matches.length ? (
        <View style={s.suggest}>
          <Row gap={8}>
            <Ionicons name="sparkles" size={16} color={C.primary} />
            <Txt v="capB" color={C.primary} style={{ flex: 1 }}>
              {t('pf_exists')}
            </Txt>
          </Row>
          {matches.slice(0, 5).map((m) => {
            const own = myIds.has(m.id);
            return (
            <Pressable key={m.id} disabled={own} onPress={() => pickMatch(m)} style={({ hovered, pressed }: any) => [s.sugRow, hovered && !own && { backgroundColor: C.card }, pressed && { opacity: 0.7 }, own && { opacity: 0.55 }]} testID={`match-${m.id}`}>
              <Thumb image={m.images[0]} emoji={m.emoji} color={m.color} size={40} radius={12} />
              <View style={{ flex: 1 }}>
                <Txt v="bodyB" numberOfLines={2}>
                  {m.title}
                </Txt>
                {own ? <Txt v="cap">{t('pf_already_yours')}</Txt> : m.min_price ? <Txt v="cap">{t('pf_others_from', { p: formatPrice(m.min_price) })}</Txt> : null}
              </View>
              {!own ? (
                <View style={s.addOffer}>
                  <Text style={s.addOfferText}>{t('pf_add_offer')}</Text>
                </View>
              ) : null}
            </Pressable>
            );
          })}
        </View>
      ) : null}
    </Card>
  );

  const category = !matched ? (
    <Card style={{ gap: 12 }}>
      <Txt v="h3">3. {t('pf_category')}</Txt>
      <Row gap={8} wrap>
        {CATEGORIES.map((c) => (
          <Chip key={c.id} label={c.name[lang] ?? c.name.ru} emoji={c.emoji} active={v.categoryId === c.id} onPress={() => set({ categoryId: c.id })} />
        ))}
      </Row>
    </Card>
  ) : null;

  const price = (
    <Card style={{ gap: 14 }}>
      <Txt v="h3">{matched ? 3 : 4}. {t('pf_price_stock')}</Txt>
      <Row gap={12} style={{ alignItems: 'flex-start' }}>
        <Field style={{ flex: 1 }} big label={t('price') + ' *'} value={v.price} onChangeText={(x) => set({ price: digits(x) })} keyboardType="number-pad" suffix={BRAND.currency} placeholder="0" testID="pf-price" />
        <Field style={{ flex: 1 }} big label={t('old_price')} hint={t('old_price_hint')} value={v.oldPrice} onChangeText={(x) => set({ oldPrice: digits(x) })} keyboardType="number-pad" suffix={BRAND.currency} placeholder="—" />
      </Row>
      {matched?.min_price && Number(v.price) > matched.min_price ? <Notice tone="warning" icon="trending-down" text={t('pf_price_warn', { p: formatPrice(matched.min_price) })} /> : null}
      <Stepper label={t('stock')} value={v.stock} onChange={(n) => set({ stock: n })} step={1} />
      <Row gap={8} wrap>
        {[10, 50, 100, 500].map((n) => (
          <Chip key={n} label={`+${n}`} onPress={() => set({ stock: v.stock + n })} />
        ))}
      </Row>
      {mode === 'edit' ? <SwitchRow icon="eye-outline" label={t('pf_active')} hint={t('pf_active_hint')} value={v.active} onChange={(x) => set({ active: x })} /> : null}
    </Card>
  );

  const extra = (
    <Card style={{ gap: 12 }}>
      <Pressable onPress={() => setMore(!more)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 }} accessibilityRole="button">
        <Txt v="h3">{t('pf_more')}</Txt>
        <Ionicons name={more ? 'chevron-up' : 'chevron-down'} size={20} color={C.muted} />
      </Pressable>
      {more ? (
        <View style={{ gap: 12 }}>
          <Row gap={12}>
            <Field style={{ flex: 1 }} label={t('wholesale_price')} value={v.wholesalePrice} onChangeText={(x) => set({ wholesalePrice: digits(x) })} keyboardType="number-pad" suffix={BRAND.currency} />
            <Field style={{ flex: 1 }} label={t('wholesale_from')} value={v.wholesaleFrom} onChangeText={(x) => set({ wholesaleFrom: digits(x) })} keyboardType="number-pad" suffix={t('pcs')} />
          </Row>
          <Field label={t('barcode')} value={v.barcode} onChangeText={(x) => set({ barcode: x })} onBlur={checkBarcode} keyboardType="number-pad" placeholder="4601234567890" />
          {!matched ? <Field label={t('brand')} value={v.brand} onChangeText={(x) => set({ brand: x })} placeholder="Erich Krause" /> : null}
          {!matched ? <Field label={t('description')} value={v.description} onChangeText={(x) => set({ description: x })} multiline placeholder={t('description_ph')} /> : null}
          {!matched ? <Field label={t('video_url')} value={v.videoUrl} onChangeText={(x) => set({ videoUrl: x })} placeholder="https://youtube.com/…" autoCapitalize="none" keyboardType="url" /> : null}
        </View>
      ) : null}
    </Card>
  );

  if (wide)
    return (
      <Row gap={16} style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 16 }}>
          {photos}
          {titleCard}
          {category}
        </View>
        <View style={{ flex: 1, gap: 16 }}>
          {price}
          {extra}
        </View>
      </Row>
    );
  return (
    <View style={{ gap: 16 }}>
      {photos}
      {titleCard}
      {category}
      {price}
      {extra}
    </View>
  );
}

const s = StyleSheet.create({
  pickBig: { width: 140, height: 112, borderRadius: R.lg, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0px 10px 24px rgba(91,60,245,0.30)' },
  pickBigText: { color: '#fff', fontWeight: '800', fontSize: 12, textAlign: 'center', paddingHorizontal: 4 },
  pick: { width: 112, height: 112, borderRadius: R.lg, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.primary + '66' },
  pickText: { color: C.primary, fontWeight: '800', fontSize: 13, textAlign: 'center', paddingHorizontal: 6 },
  photo: { width: 112, height: 112, borderRadius: R.lg, overflow: 'hidden', backgroundColor: C.bg },
  remove: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(15,18,34,0.6)', alignItems: 'center', justifyContent: 'center' },
  mainBadge: { position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(15,18,34,0.6)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  mainBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  suggest: { backgroundColor: C.primaryTint, borderRadius: 18, padding: 12, gap: 6, borderWidth: 1, borderColor: C.primarySoft },
  sugRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 14, minHeight: 56 },
  addOffer: { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  addOfferText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  matched: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.successSoft, borderRadius: 18, padding: 12 },
});
