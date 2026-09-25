import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { formatDate, type Offer, type ProductDetail } from '@taptym/shared';
import { ProductRow, StoreAvatar, Thumb } from '@/components/product';
import { Badge, BottomBar, Button, Card, ErrorState, Header, Row, Screen, Section, Skeleton, Stars, Stepper, Txt, price, useContentWidth } from '@/components/ui';
import { errorText, useT } from '@/i18n';
import { requireAuth } from '@/lib/actions';
import { api, img, useQuery } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { toast, useApp } from '@/lib/store';
import { C, R, shadow } from '@/lib/theme';

type Detail = ProductDetail & { isFavorite: boolean };

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const q = useQuery<Detail>(`/products/${id}`, { refetchOnFocus: true });
  const p = q.data;
  const cart = useApp((s) => s.cart);
  const addToCart = useApp((s) => s.addToCart);
  const setQty = useApp((s) => s.setQty);
  const width = useContentWidth();
  const wide = width >= 860;
  const [favBusy, setFavBusy] = useState(false);

  const offers = p ? [...p.offers].sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0) || a.price - b.price) : [];
  const best = offers.find((o) => o.stock > 0) ?? null;
  const stores = new Set(offers.map((o) => o.supplier.id)).size;
  const qtyOf = (o: Offer) => cart.find((l) => l.offerId === o.id)?.qty ?? 0;
  const add = (o: Offer) => {
    addToCart(o.id, 1);
    haptic.success();
    toast(`${t('added_to_cart')} · ${o.supplier.name}`, 'success');
  };

  const toggleFav = async () => {
    if (!p || !requireAuth(`/product/${id}`)) return;
    setFavBusy(true);
    const next = !p.isFavorite;
    q.setData({ ...p, isFavorite: next });
    try {
      await api(`/favorites/${p.id}`, { method: next ? 'POST' : 'DELETE' });
      haptic.success();
      toast(t(next ? 'favorite_added' : 'favorite_removed'), 'success');
    } catch (e) {
      q.setData({ ...p, isFavorite: !next });
      toast(errorText(e), 'error');
    } finally {
      setFavBusy(false);
    }
  };

  const favBtn = p ? (
    <Pressable onPress={toggleFav} disabled={favBusy} accessibilityRole="button" accessibilityLabel={t('favorite')} style={({ pressed }) => [s.favBtn, pressed && { opacity: 0.7 }]}>
      <Ionicons name={p.isFavorite ? 'heart' : 'heart-outline'} size={22} color={p.isFavorite ? C.danger : C.ink} />
      <Text style={s.favText}>{t('favorite')}</Text>
    </Pressable>
  ) : null;

  const bestQty = best ? qtyOf(best) : 0;
  const footer = best ? (
    <BottomBar>
      {bestQty > 0 ? (
        <>
          <Stepper qty={bestQty} onChange={(n) => setQty(best.id, n)} max={best.stock} />
          <Button title={t('tab_cart')} icon="bag-check-outline" onPress={() => router.navigate('/cart')} style={{ flex: 1 }} />
        </>
      ) : (
        <Button title={t('add_to_cart_for', { p: price(best.price) })} icon="bag-add-outline" sub={best.supplier.name} onPress={() => add(best)} style={{ flex: 1 }} />
      )}
    </BottomBar>
  ) : null;

  if (q.error && !p) {
    return (
      <Screen header={<Header />}>
        <ErrorState error={q.error} onRetry={q.refresh} />
      </Screen>
    );
  }
  if (!p) {
    return (
      <Screen header={<Header />}>
        <View style={{ gap: 14 }}>
          <Skeleton h={300} r={R.xxl} />
          <Skeleton h={28} w="80%" />
          <Skeleton h={20} w="40%" />
          <Skeleton h={110} r={R.xl} />
          <Skeleton h={110} r={R.xl} />
        </View>
      </Screen>
    );
  }

  const info = (
    <View style={{ gap: 10 }}>
      {p.brand ? (
        <Txt v="small" style={{ fontWeight: '700', color: C.primary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {p.brand}
        </Txt>
      ) : null}
      <Txt v="h1">{p.title}</Txt>
      <Row gap={8}>
        <Stars value={p.rating} size={16} />
        <Txt v="small" style={{ color: C.ink, fontWeight: '700' }}>
          {p.reviewsCount > 0 ? p.rating.toFixed(1) : ''}
        </Txt>
        <Txt v="small">{t('reviews_n', { n: p.reviewsCount })}</Txt>
      </Row>
      <View style={s.priceCard}>
        <Row gap={10} style={{ alignItems: 'baseline' }} wrap>
          <Txt v="display">{t('from_price', { p: price(p.minPrice) })}</Txt>
          {p.oldPrice && p.oldPrice > p.minPrice ? (
            <Txt v="h3" style={{ textDecorationLine: 'line-through', color: C.faint, fontWeight: '600' }}>
              {price(p.oldPrice)}
            </Txt>
          ) : null}
        </Row>
        <Row gap={8} wrap style={{ marginTop: 8 }}>
          {p.savings > 0 ? <Badge label={t('savings_upto', { x: price(p.savings) })} icon="trending-down" color={C.accentInk} bg={C.accent} /> : null}
          <Badge label={t('offers_in_stores', { n: p.offers.length, m: stores })} icon="storefront" />
        </Row>
      </View>
    </View>
  );

  const offersBlock = (
    <View style={{ marginTop: 24 }}>
      <Txt v="h2" style={{ marginBottom: 12 }}>
        {t('compare_prices')}
      </Txt>
      <View style={{ gap: 10 }}>
        {offers.map((o) => (
          <OfferCard key={o.id} o={o} best={o.id === best?.id} qty={qtyOf(o)} onAdd={() => add(o)} onQty={(n) => setQty(o.id, n)} />
        ))}
      </View>
    </View>
  );

  return (
    <Screen header={<Header title={p.title} right={favBtn} />} footer={footer} refreshing={q.refreshing} onRefresh={q.refresh}>
      {wide ? (
        <Row gap={28} style={{ alignItems: 'flex-start' }}>
          <View style={{ width: Math.min(460, width * 0.45) }}>
            <Gallery p={p} width={Math.min(460, width * 0.45)} />
          </View>
          <View style={{ flex: 1 }}>
            {info}
            {offersBlock}
          </View>
        </Row>
      ) : (
        <>
          <Gallery p={p} width={width} />
          <View style={{ marginTop: 18 }}>{info}</View>
          {offersBlock}
        </>
      )}

      {p.description ? (
        <Section title={t('description')}>
          <Card>
            <Txt v="body" style={{ color: '#3A3E52', lineHeight: 23 }}>
              {p.description}
            </Txt>
          </Card>
        </Section>
      ) : null}

      {Object.keys(p.specs).length ? (
        <Section title={t('specs')}>
          <Card pad={0} style={{ overflow: 'hidden' }}>
            {Object.entries(p.specs).map(([k, v], i) => (
              <Row key={k} style={[s.specRow, i % 2 === 1 && { backgroundColor: '#FAFAFD' }]}>
                <Txt v="body" color={C.muted} style={{ flex: 1 }}>
                  {k}
                </Txt>
                <Txt v="bodyBold" style={{ flex: 1, textAlign: 'right' }}>
                  {v}
                </Txt>
              </Row>
            ))}
            {p.barcode ? (
              <Row style={s.specRow}>
                <Txt v="body" color={C.muted} style={{ flex: 1 }}>
                  EAN
                </Txt>
                <Txt v="bodyBold">{p.barcode}</Txt>
              </Row>
            ) : null}
          </Card>
          {p.videoUrl ? <Button title={t('watch_video')} icon="play-circle" v="secondary" onPress={() => Linking.openURL(p.videoUrl!)} style={{ marginTop: 12 }} /> : null}
        </Section>
      ) : null}

      <Section
        title={`${t('reviews')} · ${p.reviewsCount}`}
        action={t('write_review')}
        onAction={() => requireAuth(`/review/${p.id}`) && router.push(`/review/${p.id}`)}
      >
        {p.reviews.length === 0 ? (
          <Card>
            <Txt v="body" color={C.muted}>
              {t('no_reviews')}
            </Txt>
          </Card>
        ) : (
          <View style={{ gap: 10 }}>
            {p.reviews.slice(0, 6).map((r) => (
              <Card key={r.id}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row gap={10}>
                    <View style={s.avatar}>
                      <Text style={{ fontWeight: '800', color: C.primary }}>{(r.userName || '?').slice(0, 1)}</Text>
                    </View>
                    <View>
                      <Txt v="bodyBold">{r.userName}</Txt>
                      <Txt v="small">{formatDate(r.createdAt)}</Txt>
                    </View>
                  </Row>
                  <Stars value={r.rating} />
                </Row>
                {r.text ? (
                  <Txt v="body" style={{ marginTop: 10 }}>
                    {r.text}
                  </Txt>
                ) : null}
                {r.photos.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginTop: 10 }}>
                    {r.photos.map((ph) => (
                      <Pressable key={ph} onPress={() => Linking.openURL(img(ph)!)}>
                        <Image source={{ uri: img(ph)! }} style={{ width: 84, height: 84, borderRadius: 14, backgroundColor: C.surface }} contentFit="cover" />
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}
                {r.videoUrl ? (
                  <Pressable onPress={() => Linking.openURL(r.videoUrl!)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, minHeight: 32 }}>
                    <Ionicons name="play-circle" size={20} color={C.primary} />
                    <Txt v="bodyBold" color={C.primary}>
                      {t('watch_video')}
                    </Txt>
                  </Pressable>
                ) : null}
                {r.supplierName ? (
                  <Txt v="small" style={{ marginTop: 8 }}>
                    {t('bought_at', { s: r.supplierName })}
                  </Txt>
                ) : null}
              </Card>
            ))}
          </View>
        )}
        <Button title={t('write_review')} icon="create-outline" v="secondary" onPress={() => requireAuth(`/review/${p.id}`) && router.push(`/review/${p.id}`)} style={{ marginTop: 12 }} />
      </Section>

      {p.similar.length ? (
        <Section title={t('similar')}>
          <ProductRow items={p.similar} />
        </Section>
      ) : null}
    </Screen>
  );
}

function Gallery({ p, width }: { p: Detail; width: number }) {
  const [i, setI] = useState(0);
  const { width: winW } = useWindowDimensions();
  const h = Math.min(width, winW < 500 ? width * 0.9 : 460);
  if (!p.images.length) {
    return (
      <View style={[s.hero, { height: h, backgroundColor: p.color }]}>
        <View style={s.heroGlow} />
        <Text style={{ fontSize: h * 0.42 }}>{p.emoji}</Text>
      </View>
    );
  }
  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / width))}
        scrollEventThrottle={32}
        style={{ borderRadius: R.xxl }}
      >
        {p.images.map((u) => (
          <View key={u} style={{ width, height: h, backgroundColor: p.color }}>
            <Image source={{ uri: img(u)! }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />
          </View>
        ))}
      </ScrollView>
      {p.images.length > 1 ? (
        <Row gap={6} style={{ justifyContent: 'center', marginTop: 10 }}>
          {p.images.map((u, k) => (
            <View key={u} style={{ width: k === i ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: k === i ? C.primary : '#D5D7E0' }} />
          ))}
        </Row>
      ) : null}
    </View>
  );
}

function OfferCard({ o, best, qty, onAdd, onQty }: { o: Offer; best: boolean; qty: number; onAdd: () => void; onQty: (n: number) => void }) {
  const t = useT();
  const out = o.stock <= 0;
  return (
    <View style={[s.offer, best && s.offerBest, out && { opacity: 0.6 }]}>
      {best ? (
        <View style={s.bestTag}>
          <Ionicons name="checkmark-circle" size={14} color={C.white} />
          <Text style={s.bestTagText}>{t('best_price')}</Text>
        </View>
      ) : null}
      <Row gap={12} style={{ alignItems: 'flex-start' }}>
        <Pressable onPress={() => router.push(`/store/${o.supplier.id}`)}>
          <StoreAvatar s={o.supplier} size={46} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Pressable onPress={() => router.push(`/store/${o.supplier.id}`)}>
            <Txt v="bodyBold" lines={1}>
              {o.supplier.name}
            </Txt>
          </Pressable>
          <Row gap={4}>
            <Ionicons name="star" size={13} color="#FFB800" />
            <Txt v="small" style={{ color: C.ink, fontWeight: '700' }}>
              {o.supplier.rating.toFixed(1)}
            </Txt>
            <Txt v="small" lines={1} style={{ flexShrink: 1 }}>
              · {o.supplier.address.replace(/^Ош,\s*/, '')}
            </Txt>
          </Row>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Txt v="h2" color={best ? C.successInk : C.ink}>
            {price(o.price)}
          </Txt>
          {o.oldPrice && o.oldPrice > o.price ? (
            <Txt v="small" style={{ textDecorationLine: 'line-through', color: C.faint }}>
              {price(o.oldPrice)}
            </Txt>
          ) : null}
        </View>
      </Row>
      <Row gap={6} wrap style={{ marginTop: 10 }}>
        {out ? (
          <Badge label={t('out_of_stock')} color={C.muted} bg={C.surface} />
        ) : o.stock <= 5 ? (
          <Badge label={t('few_left', { n: o.stock })} color={C.warning} bg={C.warningSoft} icon="alert-circle" />
        ) : (
          <Badge label={t('in_stock_n', { n: o.stock })} color={C.successInk} bg={C.successSoft} icon="cube" />
        )}
        {o.deliveryToday && !out ? <Badge label={t('today_badge')} icon="flash" color={C.primary} bg={C.primarySoft} /> : null}
        {o.wholesalePrice && o.wholesaleFrom ? (
          <Badge label={t('wholesale', { n: o.wholesaleFrom, p: price(o.wholesalePrice) })} icon="layers" color="#1D5FD1" bg="#E7F0FF" />
        ) : null}
      </Row>
      {!out ? (
        <View style={{ marginTop: 12 }}>
          {qty > 0 ? (
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="bodyBold" color={C.primary}>
                {t('in_cart_n', { n: qty })}
              </Txt>
              <Stepper qty={qty} onChange={onQty} max={o.stock} compact />
            </Row>
          ) : (
            <Button title={t('add_to_cart')} icon="add" size="md" v={best ? 'success' : 'secondary'} onPress={onAdd} />
          )}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  favBtn: { alignItems: 'center', justifyContent: 'center', minWidth: 64, height: 50, borderRadius: 16, backgroundColor: C.white, paddingHorizontal: 8, ...shadow.sm },
  favText: { fontSize: 10, fontWeight: '700', color: C.muted, marginTop: 1 },
  hero: { borderRadius: R.xxl, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  heroGlow: { position: 'absolute', width: '70%', aspectRatio: 1, borderRadius: 999, backgroundColor: '#fff', opacity: 0.45 },
  priceCard: { marginTop: 6, backgroundColor: C.white, borderRadius: R.xl, padding: 16, ...shadow.sm },
  offer: { backgroundColor: C.white, borderRadius: R.xl, padding: 14, borderWidth: 2, borderColor: 'transparent', ...shadow.sm },
  offerBest: { borderColor: C.success, paddingTop: 22 },
  bestTag: { position: 'absolute', top: -11, left: 14, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.success, borderRadius: R.pill, paddingHorizontal: 10, height: 22 },
  bestTagText: { color: C.white, fontSize: 12, fontWeight: '800' },
  specRow: { paddingHorizontal: 16, minHeight: 48, gap: 12 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
