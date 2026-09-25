import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Order } from '@taptym/shared';
import { Button, Card, price, Row, Txt } from '@/components/ui';
import { useT } from '@/i18n';
import { refreshMe } from '@/lib/actions';
import { useQuery } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { C, R } from '@/lib/theme';

const PIECES = ['🎉', '✏️', '📒', '🖍️', '⭐', '🎒', '📐', '🪙'];
const COLORS = [C.primary, C.accent, C.success, '#FF6B9A', '#3BA8FF'];
const native = Platform.OS !== 'web';

function Confetti() {
  const { width, height } = useWindowDimensions();
  const items = useRef(
    Array.from({ length: 28 }).map((_, i) => ({
      x: Math.random(),
      delay: Math.random() * 600,
      dur: 2200 + Math.random() * 1600,
      rot: (Math.random() - 0.5) * 720,
      emoji: i % 3 === 0 ? PIECES[i % PIECES.length] : null,
      color: COLORS[i % COLORS.length],
      size: 8 + Math.random() * 8,
      v: new Animated.Value(0),
    })),
  ).current;
  useEffect(() => {
    Animated.parallel(
      items.map((it) => Animated.timing(it.v, { toValue: 1, duration: it.dur, delay: it.delay, easing: Easing.out(Easing.quad), useNativeDriver: native })),
    ).start();
  }, [items]);
  return (
    <View pointerEvents="none" aria-hidden style={StyleSheet.absoluteFill}>
      {items.map((it, i) => {
        const style = {
          position: 'absolute' as const,
          left: it.x * width,
          top: -30,
          opacity: it.v.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
          transform: [
            { translateY: it.v.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.9] }) },
            { rotate: it.v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${it.rot}deg`] }) },
          ],
        };
        return it.emoji ? (
          <Animated.Text key={i} style={[style, { fontSize: 22 }]}>
            {it.emoji}
          </Animated.Text>
        ) : (
          <Animated.View key={i} style={[style, { width: it.size, height: it.size * 1.6, borderRadius: 2, backgroundColor: it.color }]} />
        );
      })}
    </View>
  );
}

export default function SuccessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const insets = useSafeAreaInsets();
  const q = useQuery<Order>(`/orders/${id}`, { auth: true });
  const o = q.data;
  const scale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    haptic.success();
    refreshMe();
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: native }).start();
  }, [scale]);

  const sub = !o ? '' : o.paymentStatus === 'cash_on_delivery' ? t('success_cash') : o.paymentStatus === 'awaiting_invoice' ? t('success_invoice') : t('success_paid');
  const coins = o?.coinsEarned ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }}>
      <Confetti />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 14, maxWidth: 480, width: '100%', alignSelf: 'center' }}>
        <Animated.View style={[st.check, { transform: [{ scale }] }]}>
          <Ionicons name="checkmark" size={64} color={C.white} />
        </Animated.View>
        <Txt v="display" center>
          {t('success_title')}
        </Txt>
        {o ? (
          <>
            <Txt v="body" center color={C.muted}>
              {sub}
            </Txt>
            <Card pad={16} style={{ alignSelf: 'stretch', borderRadius: R.xxl, marginTop: 8 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt v="bodyBold">{t('order_number', { n: o.number })}</Txt>
                <Txt v="h3">{price(o.total)}</Txt>
              </Row>
              <Row gap={8} style={{ marginTop: 8 }}>
                <Ionicons name="storefront-outline" size={16} color={C.muted} />
                <Txt v="small" style={{ flex: 1 }} lines={1}>
                  {o.subOrders.map((s) => s.supplier.name).join(' · ')}
                </Txt>
              </Row>
              {coins > 0 ? (
                <View style={st.coins}>
                  <Text style={{ fontSize: 18 }}>🪙</Text>
                  <Txt v="bodyBold" color={C.accentInk} style={{ flex: 1 }}>
                    {t('success_coins', { n: coins })}
                  </Txt>
                </View>
              ) : null}
            </Card>
          </>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: 20, gap: 10, maxWidth: 480, width: '100%', alignSelf: 'center' }}>
        <Button title={t('track_order')} icon="navigate" onPress={() => router.replace(`/order/${id}`)} />
        <Button title={t('continue_shopping')} v="ghost" onPress={() => router.replace('/')} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  check: { width: 120, height: 120, borderRadius: 60, backgroundColor: C.success, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 16px 40px rgba(18,183,106,0.35)' },
  coins: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: C.accentSoft, borderRadius: R.md, padding: 12 },
});
