import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ProductCard, SupplierPublic } from '@taptym/shared';
import { img } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { C, gridColumns, R, shadow } from '@/lib/theme';
import { useT } from '@/i18n';
import { Badge, price, Row, Skeleton, Txt, useContentWidth } from './ui';

/** Product photo if present, otherwise the emoji on its pastel colour. */
export function Thumb({ image, emoji, color, size, radius = R.lg, style, emojiScale = 0.5 }: { image?: string | null; emoji: string; color: string; size?: number; radius?: number; style?: StyleProp<ViewStyle>; emojiScale?: number }) {
  const [failed, setFailed] = useState(false);
  const uri = img(image);
  const box: ViewStyle = size ? { width: size, height: size } : { width: '100%', aspectRatio: 1 };
  return (
    <View style={[box, { backgroundColor: color || C.surface, borderRadius: radius, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}>
      {uri && !failed ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} onError={() => setFailed(true)} />
      ) : (
        <Text style={{ fontSize: size ? size * emojiScale : 56 }}>{emoji}</Text>
      )}
    </View>
  );
}

export function ProductTile({ p, width }: { p: ProductCard; width: number }) {
  const t = useT();
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        router.push(`/product/${p.id}`);
      }}
      style={({ pressed }) => [s.tile, { width }, pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 }]}
      accessibilityRole="link"
      accessibilityLabel={p.title}
    >
      <View>
        <Thumb image={p.images[0]} emoji={p.emoji} color={p.color} radius={R.lg} />
        {p.savings > 0 ? (
          <View style={s.saveTag}>
            <Text style={s.saveTagText}>−{price(p.savings)}</Text>
          </View>
        ) : null}
        {!p.inStock ? (
          <View style={s.oosVeil}>
            <Badge label={t('out_of_stock')} color={C.muted} bg={C.white} />
          </View>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: 4, paddingTop: 10, gap: 3 }}>
        <Row gap={6} style={{ alignItems: 'baseline' }} wrap>
          <Txt v="price">{t('from_price', { p: price(p.minPrice) })}</Txt>
          {p.oldPrice && p.oldPrice > p.minPrice ? (
            <Txt v="small" style={{ textDecorationLine: 'line-through', color: C.faint }}>
              {price(p.oldPrice)}
            </Txt>
          ) : null}
        </Row>
        <Txt v="body" lines={2} style={{ fontSize: 14, lineHeight: 19, minHeight: 38 }}>
          {p.title}
        </Txt>
        <Row gap={8} style={{ marginTop: 2 }}>
          {p.reviewsCount > 0 ? (
            <Row gap={3}>
              <Ionicons name="star" size={13} color="#FFB800" />
              <Txt v="small" style={{ color: C.ink, fontWeight: '700' }}>
                {p.rating.toFixed(1)}
              </Txt>
            </Row>
          ) : null}
          <Row gap={3}>
            <Ionicons name="storefront-outline" size={13} color={C.muted} />
            <Txt v="small">{t('offers_n', { n: p.offersCount })}</Txt>
          </Row>
        </Row>
      </View>
    </Pressable>
  );
}

export function ProductGrid({ items, width: w0 }: { items: ProductCard[]; width?: number }) {
  const cw = useContentWidth();
  const width = w0 ?? cw;
  const cols = gridColumns(width);
  const gap = 12;
  const tileW = Math.floor((width - gap * (cols - 1)) / cols);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap, rowGap: 18 }}>
      {items.map((p) => (
        <ProductTile key={p.id} p={p} width={tileW} />
      ))}
    </View>
  );
}

export function GridSkeleton({ n = 6 }: { n?: number }) {
  const width = useContentWidth();
  const cols = gridColumns(width);
  const gap = 12;
  const tileW = Math.floor((width - gap * (cols - 1)) / cols);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap, rowGap: 18 }}>
      {Array.from({ length: n }).map((_, i) => (
        <View key={i} style={{ width: tileW, gap: 8 }}>
          <Skeleton h={tileW} r={R.lg} />
          <Skeleton h={18} w="60%" />
          <Skeleton h={14} w="90%" />
        </View>
      ))}
    </View>
  );
}

/** Horizontally scrolling product row that bleeds to the screen edge. */
export function ProductRow({ items }: { items: ProductCard[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
      {items.map((p) => (
        <ProductTile key={p.id} p={p} width={156} />
      ))}
    </ScrollView>
  );
}

export function StoreAvatar({ s: sup, size = 44 }: { s: Pick<SupplierPublic, 'logoEmoji' | 'color'>; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.36, backgroundColor: sup.color || C.surface, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.5 }}>{sup.logoEmoji}</Text>
    </View>
  );
}

export function StoreCard({ s: sup }: { s: SupplierPublic }) {
  const t = useT();
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        router.push(`/store/${sup.id}`);
      }}
      style={({ pressed }) => [s.store, pressed && { opacity: 0.85 }]}
    >
      <StoreAvatar s={sup} size={52} />
      <Txt v="bodyBold" lines={1} style={{ marginTop: 10 }}>
        {sup.name}
      </Txt>
      <Row gap={4} style={{ marginTop: 2 }}>
        <Ionicons name="star" size={13} color="#FFB800" />
        <Txt v="small" style={{ color: C.ink, fontWeight: '700' }}>
          {sup.rating.toFixed(1)}
        </Txt>
        {sup.isNew ? <Badge label={t('new_badge')} style={{ marginLeft: 4 }} /> : null}
      </Row>
    </Pressable>
  );
}

const s = StyleSheet.create({
  tile: { backgroundColor: C.white, borderRadius: R.xl, padding: 8, paddingBottom: 12, ...shadow.sm },
  saveTag: { position: 'absolute', left: 8, top: 8, backgroundColor: C.accent, borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 3 },
  saveTagText: { fontSize: 12, fontWeight: '800', color: C.ink },
  oosVeil: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: R.lg, alignItems: 'center', justifyContent: 'center' },
  store: { width: 140, backgroundColor: C.white, borderRadius: R.xl, padding: 14, ...shadow.sm },
});
