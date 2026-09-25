import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { formatDateTime, type Order, type SubOrder, type SubOrderStatus } from '@taptym/shared';
import { OrderStatusChip, PaymentChip, SubStatusChip } from '@/components/order-bits';
import { StoreAvatar, Thumb } from '@/components/product';
import { Button, Card, Divider, ErrorState, Header, price, Row, Screen, Section, Skeleton, Txt } from '@/components/ui';
import { errorText, useT, type TKey } from '@/i18n';
import { addLines } from '@/lib/actions';
import { api, apiUrl, useQuery } from '@/lib/api';
import { DELIVERY_ICON } from '@/lib/quote';
import { toast, useApp } from '@/lib/store';
import { C, R } from '@/lib/theme';

const FLOW: SubOrderStatus[] = ['new', 'confirmed', 'assembling', 'in_delivery', 'delivered'];

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const token = useApp((s) => s.token);
  const q = useQuery<Order>(`/orders/${id}`, { auth: true, refetchOnFocus: true, interval: 15000 });
  const o = q.data;
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (q.error && !o) {
    return (
      <Screen header={<Header />}>
        <ErrorState error={q.error} onRetry={q.refresh} />
      </Screen>
    );
  }
  if (!o) {
    return (
      <Screen header={<Header />}>
        <View style={{ gap: 12 }}>
          <Skeleton h={120} r={R.xxl} />
          <Skeleton h={260} r={R.xxl} />
        </View>
      </Screen>
    );
  }

  const canCancel = o.status !== 'cancelled' && o.subOrders.every((s) => s.status === 'new' || s.status === 'confirmed');
  const needsPay = o.paymentStatus === 'pending' || o.paymentStatus === 'awaiting_invoice';

  const cancel = async () => {
    if (!confirmCancel) {
      setConfirmCancel(true);
      toast(t('cancel_confirm'));
      return;
    }
    setBusy('cancel');
    try {
      const r = await api<Order>(`/orders/${o.id}/cancel`, { method: 'POST' });
      q.setData({ ...o, ...r });
      toast(t('order_cancelled'), 'success');
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(null);
      setConfirmCancel(false);
    }
  };

  const repeat = async () => {
    setBusy('repeat');
    try {
      const r = await api<{ lines: { offerId: number; qty: number }[] }>(`/orders/${o.id}/repeat`, { method: 'POST' });
      addLines(r.lines, t('repeated'));
      router.navigate('/cart');
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const support = async (isReturn: boolean) => {
    setBusy(isReturn ? 'return' : 'support');
    try {
      const th = await api<{ id: number }>('/support/threads', {
        body: {
          title: isReturn ? `${t('return_item')} · ${o.number}` : t('support_order_text', { n: o.number }),
          text: isReturn ? t('return_text', { n: o.number }) : t('support_order_text', { n: o.number }),
          orderId: o.id,
          isReturn,
        },
      });
      router.push(`/support/${th.id}`);
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const row = (label: string, value: string, color?: string) => (
    <Row style={{ justifyContent: 'space-between', minHeight: 28 }}>
      <Txt v="body" color={C.muted}>
        {label}
      </Txt>
      <Txt v="bodyBold" color={color}>
        {value}
      </Txt>
    </Row>
  );

  return (
    <Screen header={<Header title={t('order_number', { n: o.number })} />} refreshing={q.refreshing} onRefresh={q.refresh}>
      <Card pad={18} style={{ borderRadius: R.xxl, gap: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Txt v="h2">{o.number}</Txt>
            <Txt v="small">{formatDateTime(o.createdAt)}</Txt>
          </View>
          <OrderStatusChip status={o.status} />
        </Row>
        <Row gap={8} wrap>
          <PaymentChip status={o.paymentStatus} />
        </Row>
        {needsPay && o.status !== 'cancelled' ? (
          o.paymentMethod === 'invoice' ? (
            <Button title={t('open_invoice')} icon="document-text" onPress={() => Linking.openURL(`${apiUrl()}/api/c/orders/${o.id}/invoice?token=${token}`)} />
          ) : (
            <Button title={`${t('pay_now')} ${price(o.total)}`} icon="qr-code" onPress={() => router.push(`/pay/${o.id}`)} />
          )
        ) : null}
      </Card>

      {o.subOrders.map((s) => (
        <SubOrderCard key={s.id} s={s} orderId={o.id} />
      ))}

      <Section title={t('summary')}>
        <Card pad={18} style={{ borderRadius: R.xxl }}>
          {row(t('items_sum', { n: o.subOrders.reduce((a, s) => a + s.items.reduce((b, i) => b + i.qty, 0), 0) }), price(o.itemsTotal))}
          {row(t('delivery'), o.deliveryTotal ? price(o.deliveryTotal) : t('free'), o.deliveryTotal ? undefined : C.successInk)}
          {o.promoDiscount ? row(t('promo_code'), `−${price(o.promoDiscount)}`, C.successInk) : null}
          {o.coinsUsed ? row(t('coins_used'), `−${price(o.coinsUsed)}`, C.successInk) : null}
          <Divider style={{ marginVertical: 10 }} />
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt v="h3">{t('total')}</Txt>
            <Txt v="h2">{price(o.total)}</Txt>
          </Row>
          <Divider style={{ marginVertical: 12 }} />
          <Row gap={10} style={{ alignItems: 'flex-start' }}>
            <Ionicons name="location-outline" size={18} color={C.muted} />
            <Txt v="body" style={{ flex: 1 }}>
              {o.address}
            </Txt>
          </Row>
          <Row gap={10} style={{ marginTop: 8 }}>
            <Ionicons name="wallet-outline" size={18} color={C.muted} />
            <Txt v="body">{t(`pm_${o.paymentMethod}` as TKey)}</Txt>
          </Row>
          {o.comment ? (
            <Row gap={10} style={{ marginTop: 8, alignItems: 'flex-start' }}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={C.muted} />
              <Txt v="body" style={{ flex: 1 }}>
                {o.comment}
              </Txt>
            </Row>
          ) : null}
        </Card>
      </Section>

      <View style={{ gap: 10, marginTop: 24 }}>
        <Button title={t('repeat_order')} icon="repeat" onPress={repeat} loading={busy === 'repeat'} />
        <Row gap={10}>
          <Button title={t('support')} icon="chatbubbles-outline" v="secondary" size="md" onPress={() => support(false)} loading={busy === 'support'} style={{ flex: 1 }} />
          <Button title={t('return_item')} icon="return-down-back" v="secondary" size="md" onPress={() => support(true)} loading={busy === 'return'} style={{ flex: 1 }} />
        </Row>
        {canCancel ? (
          <Button title={confirmCancel ? t('cancel_confirm') : t('cancel_order')} icon="close-circle-outline" v="danger" size="md" onPress={cancel} loading={busy === 'cancel'} />
        ) : null}
      </View>
    </Screen>
  );
}

function SubOrderCard({ s, orderId }: { s: SubOrder; orderId: number }) {
  const t = useT();
  const flow = s.deliveryMethod === 'pickup' ? FLOW.map((x) => (x === 'in_delivery' ? 'ready' : x)) : FLOW;
  const failed = s.status === 'cancelled' || s.status === 'rejected';
  const reachedIdx = Math.max(flow.indexOf(s.status), ...s.history.map((h) => flow.indexOf(h.status)));
  const at = (st: SubOrderStatus) => s.history.find((h) => h.status === st)?.at;
  void orderId;
  return (
    <Card pad={16} style={{ borderRadius: R.xxl, marginTop: 14 }}>
      <Row gap={10}>
        <StoreAvatar s={s.supplier} size={42} />
        <View style={{ flex: 1 }}>
          <Txt v="h3">{s.supplier.name}</Txt>
          <Row gap={4}>
            <Ionicons name={DELIVERY_ICON[s.deliveryMethod]} size={14} color={C.muted} />
            <Txt v="small">
              {t(`dm_${s.deliveryMethod}` as TKey)} · {s.deliveryFee ? price(s.deliveryFee) : t('free')}
            </Txt>
          </Row>
        </View>
        <SubStatusChip status={s.status} />
      </Row>

      {failed ? (
        <View style={{ marginTop: 14, gap: 6 }}>
          {s.history.map((h, i) => (
            <Row key={i} gap={8}>
              <Ionicons name="ellipse" size={8} color={h.status === 'cancelled' || h.status === 'rejected' ? C.danger : C.faint} />
              <Txt v="small" style={{ color: C.ink }}>
                {t(`ss_${h.status}` as TKey)}
              </Txt>
              <Txt v="small">{formatDateTime(h.at)}</Txt>
            </Row>
          ))}
        </View>
      ) : (
        <View style={{ marginTop: 16 }}>
          {flow.map((st, i) => {
            const done = i <= reachedIdx;
            const current = i === reachedIdx;
            const time = at(st);
            return (
              <View key={st} style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ alignItems: 'center', width: 22 }}>
                  <View style={[ts.dot, done && ts.dotDone, current && ts.dotCurrent]}>{done ? <Ionicons name="checkmark" size={12} color={C.white} /> : null}</View>
                  {i < flow.length - 1 ? <View style={[ts.line, i < reachedIdx && { backgroundColor: C.primary }]} /> : null}
                </View>
                <View style={{ flex: 1, paddingBottom: i < flow.length - 1 ? 14 : 0, flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Txt v={current ? 'bodyBold' : 'body'} color={done ? C.ink : C.faint}>
                    {t(`ss_${st}` as TKey)}
                  </Txt>
                  {time ? <Txt v="small">{formatDateTime(time).slice(0, 16)}</Txt> : null}
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Divider style={{ marginVertical: 14 }} />
      <View style={{ gap: 10 }}>
        {s.items.map((i) => (
          <Pressable key={i.offerId} onPress={() => router.push(`/product/${i.productId}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Thumb image={i.image} emoji={i.emoji} color={i.color} size={52} radius={14} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt v="body" lines={2} style={{ fontWeight: '600' }}>
                {i.title}
              </Txt>
              <Txt v="small">
                {price(i.price)} × {i.qty}
              </Txt>
            </View>
            <Txt v="bodyBold">{price(i.price * i.qty)}</Txt>
          </Pressable>
        ))}
      </View>
      {s.status === 'delivered' ? (
        <Button
          title={t('write_review')}
          icon="star-outline"
          v="secondary"
          size="sm"
          onPress={() => router.push(`/review/${s.items[0].productId}`)}
          style={{ marginTop: 12, alignSelf: 'flex-start' }}
        />
      ) : null}
    </Card>
  );
}

const ts = StyleSheet.create({
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.line, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: C.primary, borderColor: C.primary },
  dotCurrent: { boxShadow: '0px 0px 0px 4px rgba(91,60,245,0.18)' },
  line: { width: 2, flex: 1, backgroundColor: C.line, marginVertical: 2 },
});
