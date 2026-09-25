import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { DeliveryPicker } from '@/components/delivery';
import { StoreAvatar, Thumb } from '@/components/product';
import { SummaryCard } from '@/components/summary';
import { BottomBar, Button, Card, Empty, ErrorState, Field, price, Row, Screen, Skeleton, Stepper, TabTitle, Toggle, Txt } from '@/components/ui';
import { promoErrorKey, useT } from '@/i18n';
import { requireAuth } from '@/lib/actions';
import { haptic } from '@/lib/haptics';
import { useQuote } from '@/lib/quote';
import { toast, useApp } from '@/lib/store';
import { C, gradient, R } from '@/lib/theme';

export default function CartScreen() {
  const t = useT();
  const cart = useApp((s) => s.cart);
  const token = useApp((s) => s.token);
  const promo = useApp((s) => s.promo);
  const useCoins = useApp((s) => s.useCoins);
  const { setQty, setDelivery, setPromo, setUseCoins, replaceCart } = useApp.getState();
  const { quote: q, loading, error, refresh } = useQuote();
  const [code, setCode] = useState(promo ?? '');
  useEffect(() => setCode(promo ?? ''), [promo]);

  if (!cart.length) {
    return (
      <Screen header={<TabTitle title={t('cart_title')} />}>
        <Empty emoji="🛍️" title={t('cart_empty')} sub={t('cart_empty_sub')} action={t('to_shopping')} icon="search" onAction={() => router.navigate('/search')} />
      </Screen>
    );
  }

  const applyCheaper = () => {
    if (!q?.cheaperAlternative) return;
    const saving = q.cheaperAlternative.saving;
    replaceCart(q.cheaperAlternative.lines);
    haptic.success();
    toast(t('cheaper_applied', { x: price(saving) }), 'success');
  };

  const footer = q ? (
    <BottomBar>
      <View style={{ flex: 1 }}>
        <Txt v="small">{t('total')}</Txt>
        <Row gap={6}>
          <Txt v="h2">{price(q.total)}</Txt>
          {loading ? <ActivityIndicator size="small" color={C.primary} /> : null}
        </Row>
      </View>
      <Button title={t('checkout')} icon="arrow-forward" onPress={() => requireAuth('/checkout') && router.push('/checkout')} style={{ flex: 1.4 }} />
    </BottomBar>
  ) : null;

  return (
    <Screen
      header={<TabTitle title={t('cart_title')} sub={q && q.groups.length > 1 ? t('stores_in_cart', { n: q.groups.length }) : undefined} />}
      footer={footer}
      refreshing={false}
      onRefresh={refresh}
    >
      {error && !q ? (
        <ErrorState error={error} onRetry={refresh} />
      ) : !q ? (
        <View style={{ gap: 12 }}>
          <Skeleton h={220} r={R.xxl} />
          <Skeleton h={160} r={R.xxl} />
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          {q.cheaperAlternative ? (
            <View style={[s.cheaper, gradient('linear-gradient(120deg, #FFCC00 0%, #FFB300 100%)', C.accent)]}>
              <Row gap={12}>
                <Text style={{ fontSize: 34 }}>💡</Text>
                <View style={{ flex: 1 }}>
                  <Txt v="h3">{t('cheaper_found', { x: price(q.cheaperAlternative.saving) })}</Txt>
                  <Txt v="small" style={{ color: '#5C4700' }}>
                    {t('cheaper_found_sub')}
                  </Txt>
                </View>
              </Row>
              <Button title={t('apply_cheaper')} icon="swap-horizontal" v="dark" size="md" onPress={applyCheaper} style={{ marginTop: 12 }} />
            </View>
          ) : null}

          {q.freeFirstDelivery || (q.isFirstOrder && token) ? (
            <Row gap={10} style={s.hint}>
              <Ionicons name="gift" size={20} color={C.successInk} />
              <Txt v="bodyBold" color={C.successInk} style={{ flex: 1 }}>
                {t('free_first_delivery')}
              </Txt>
            </Row>
          ) : null}

          {q.groups.map((g) => (
            <Card key={g.supplier.id} pad={16} style={{ borderRadius: R.xxl }}>
              <Pressable onPress={() => router.push(`/store/${g.supplier.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <StoreAvatar s={g.supplier} size={40} />
                <View style={{ flex: 1 }}>
                  <Txt v="h3">{g.supplier.name}</Txt>
                  <Row gap={4}>
                    <Ionicons name="star" size={12} color="#FFB800" />
                    <Txt v="small">{g.supplier.rating.toFixed(1)}</Txt>
                  </Row>
                </View>
                <Txt v="bodyBold">{price(g.subtotal)}</Txt>
              </Pressable>
              <View style={{ marginTop: 12, gap: 12 }}>
                {g.lines.map((l) => (
                  <Row key={l.offerId} gap={12} style={{ alignItems: 'flex-start' }}>
                    <Pressable onPress={() => router.push(`/product/${l.productId}`)}>
                      <Thumb image={l.image} emoji={l.emoji} color={l.color} size={68} radius={16} />
                    </Pressable>
                    <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                      <Txt v="body" lines={2} style={{ fontWeight: '600' }}>
                        {l.title}
                      </Txt>
                      <Row style={{ justifyContent: 'space-between' }} wrap>
                        <View>
                          <Txt v="price">{price(l.total)}</Txt>
                          {l.qty > 1 ? <Txt v="small">{`${price(l.price)} × ${l.qty}`}</Txt> : null}
                        </View>
                        <Stepper qty={l.qty} onChange={(n) => setQty(l.offerId, n)} max={l.stock} compact />
                      </Row>
                    </View>
                  </Row>
                ))}
              </View>
              <Txt v="bodyBold" style={{ marginTop: 16, marginBottom: 8 }}>
                {t('delivery')}
              </Txt>
              <DeliveryPicker g={g} onPick={(m) => setDelivery(g.supplier.id, m)} />
            </Card>
          ))}

          <Card pad={16} style={{ borderRadius: R.xxl, gap: 10 }}>
            <Txt v="h3">{t('promo_code')}</Txt>
            <Row gap={8}>
              <Field
                style={{ flex: 1 }}
                placeholder={t('promo_placeholder')}
                value={code}
                autoCapitalize="characters"
                autoCorrect={false}
                onChangeText={(v) => setCode(v.toUpperCase())}
                onSubmitEditing={() => setPromo(code || null)}
                right={
                  promo ? (
                    <Pressable
                      onPress={() => {
                        setPromo(null);
                        setCode('');
                      }}
                      hitSlop={10}
                      accessibilityLabel={t('remove')}
                    >
                      <Ionicons name="close-circle" size={22} color={C.faint} />
                    </Pressable>
                  ) : null
                }
              />
              <Button title={t('apply')} v="dark" size="sm" disabled={!code.trim()} onPress={() => setPromo(code || null)} style={{ height: 54 }} />
            </Row>
            {promo && q.promoError ? (
              <Row gap={6}>
                <Ionicons name="alert-circle" size={18} color={C.danger} />
                <Txt v="bodyBold" color={C.danger} style={{ flex: 1 }}>
                  {t(promoErrorKey(q.promoError))}
                </Txt>
              </Row>
            ) : promo && q.promoDiscount > 0 ? (
              <Row gap={6}>
                <Ionicons name="checkmark-circle" size={18} color={C.successInk} />
                <Txt v="bodyBold" color={C.successInk}>
                  {t('promo_applied', { x: price(q.promoDiscount) })}
                </Txt>
              </Row>
            ) : null}
          </Card>

          <Card pad={16} style={{ borderRadius: R.xxl }}>
            {token ? (
              <Pressable onPress={() => q.coinsMax > 0 && setUseCoins(!useCoins)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={s.coin}>
                  <Text style={{ fontSize: 22 }}>🪙</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Txt v="bodyBold">{t('pay_with_coins')}</Txt>
                  <Txt v="small">{t('coins_available', { n: q.coinsMax, b: q.coinsAvailable })}</Txt>
                </View>
                <Toggle value={useCoins && q.coinsMax > 0} onChange={setUseCoins} disabled={q.coinsMax <= 0} />
              </Pressable>
            ) : (
              <Pressable onPress={() => requireAuth('/cart')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
                <View style={s.coin}>
                  <Text style={{ fontSize: 22 }}>🪙</Text>
                </View>
                <Txt v="bodyBold" color={C.primary} style={{ flex: 1 }}>
                  {t('coins_login')}
                </Txt>
                <Ionicons name="chevron-forward" size={18} color={C.primary} />
              </Pressable>
            )}
          </Card>

          <SummaryCard q={q} />
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  cheaper: { borderRadius: R.xxl, padding: 16 },
  hint: { backgroundColor: C.successSoft, borderRadius: R.lg, padding: 14 },
  coin: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' },
});
