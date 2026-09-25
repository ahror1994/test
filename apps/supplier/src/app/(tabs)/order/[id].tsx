import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDateTime, formatPhone, formatPrice, type SubOrder, type SubOrderStatus } from '@taptym/shared';
import { Screen } from '@/components/Screen';
import { LoadError } from '@/components/LoadError';
import { Sheet } from '@/components/Sheet';
import { Thumb } from '@/components/Thumb';
import { Button, Card, Chip, Divider, Field, IconBtn, Notice, Pill, Row, Skeleton, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useCan, useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { errorText, useT } from '@/lib/useT';
import { useLayout } from '@/lib/layout';
import { deliveryIcon, deliveryKey, nextActionIcon, nextActionKey, paymentIcon, paymentKey, statusKey, statusTone, timeAgo } from '@/lib/labels';
import { toast } from '@/lib/overlay';

type Detail = SubOrder & { next: SubOrderStatus[]; supplierDiscount: number };

const FLOW: SubOrderStatus[] = ['new', 'confirmed', 'assembling', 'ready', 'in_delivery', 'delivered'];

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const can = useCan();
  const { wide } = useLayout();
  const { data: o, setData, error, loading, refresh, refreshing, reload } = useApi<Detail>(id ? `/api/s/orders/${id}` : null, { interval: 15000 });
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [other, setOther] = useState('');

  const change = async (status: SubOrderStatus, why = '') => {
    if (!o) return;
    setBusy(true);
    try {
      const fresh = await api<Detail>(`/api/s/orders/${o.id}/status`, { body: { status, reason: why } });
      setData(fresh);
      toast(t('status_now', { s: t(statusKey(fresh.status)) }));
      void useStore.getState().loadMe();
    } catch (e) {
      toast(errorText(t, e), 'error');
      void reload();
    } finally {
      setBusy(false);
      setRejectOpen(false);
    }
  };

  if (!o) {
    return (
      <Screen back="/orders" title={t('order')} detail>
        <LoadError error={error} onRetry={reload} />
        {loading && !error ? (
          <View style={{ gap: 12 }}>
            <Skeleton h={90} r={24} />
            <Skeleton h={160} r={24} />
            <Skeleton h={220} r={24} />
          </View>
        ) : null}
      </Screen>
    );
  }

  // Pickup orders skip "in delivery"; everything else goes courier → delivered.
  const forward = o.next.filter((x) => x !== 'cancelled' && x !== 'rejected');
  const primary: SubOrderStatus | undefined = o.status === 'ready' ? (o.deliveryMethod === 'pickup' ? 'delivered' : 'in_delivery') : o.status === 'confirmed' ? 'assembling' : forward[0];
  const stopTo: SubOrderStatus | undefined = o.next.includes('rejected') ? 'rejected' : o.next.includes('cancelled') ? 'cancelled' : undefined;
  const canAct = can('orders');
  const payout = o.subtotal + (o.deliveryMethod === 'supplier' ? o.deliveryFee : 0) - o.commission - (o.supplierDiscount ?? 0);
  const flow = FLOW.filter((x) => !(o.deliveryMethod === 'pickup' && x === 'in_delivery'));
  const stepIdx = flow.indexOf(o.status);
  const stopped = o.status === 'cancelled' || o.status === 'rejected';
  // The API appends the reason to the history author: "Поставщик (Имя): Нет в наличии".
  const stopBy = stopped ? [...o.history].reverse().find((x) => x.status === o.status)?.by : undefined;
  const stopReason = stopBy && stopBy.includes(': ') ? stopBy.slice(stopBy.lastIndexOf(': ') + 2) : '';
  const reasons = [t('r_no_stock'), t('r_no_time'), t('r_other')];

  const footer =
    canAct && (primary || stopTo) ? (
      <View style={{ flexDirection: wide ? 'row-reverse' : 'column', gap: 10 }}>
        {primary ? (
          <Button
            title={t(nextActionKey(primary, o.deliveryMethod))}
            icon={nextActionIcon(primary)}
            kind={primary === 'delivered' ? 'success' : 'primary'}
            onPress={() => change(primary)}
            loading={busy}
            style={wide ? { flex: 1 } : undefined}
            testID="order-next"
          />
        ) : null}
        {stopTo ? (
          <Button title={stopTo === 'rejected' ? t('act_reject') : t('act_cancel')} kind="danger" size={wide ? 'lg' : 'md'} full={!wide} icon="close-circle-outline" onPress={() => setRejectOpen(true)} testID="order-reject" />
        ) : null}
      </View>
    ) : undefined;

  const customer = o.customer ? (
    <Card style={{ gap: 12 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt v="capB">{t('customer')}</Txt>
          <Txt v="h3">{o.customer.isCompany && o.customer.companyName ? o.customer.companyName : o.customer.name}</Txt>
          {o.customer.isCompany ? <Txt v="cap">{o.customer.name}</Txt> : null}
        </View>
        {o.customer.isCompany ? <Pill label={t('company')} tone="info" icon="business-outline" /> : null}
      </Row>
      <Button title={formatPhone(o.customer.phone)} icon="call" kind="secondary" size="md" onPress={() => void Linking.openURL(`tel:${o.customer!.phone}`)} testID="call" />
      <Row gap={10} style={{ alignItems: 'flex-start' }}>
        <Ionicons name="location-outline" size={20} color={C.primary} />
        <Txt style={{ flex: 1 }}>{o.deliveryMethod === 'pickup' ? t('pickup_from_store') : o.customer.address}</Txt>
      </Row>
      {o.comment ? (
        <Row gap={10} style={{ alignItems: 'flex-start' }}>
          <Ionicons name="chatbox-ellipses-outline" size={20} color={C.warning} />
          <Txt style={{ flex: 1, fontStyle: 'italic' }}>«{o.comment}»</Txt>
        </Row>
      ) : null}
    </Card>
  ) : null;

  const delivery = (
    <Card style={{ gap: 12 }}>
      <Row gap={12}>
        <View style={s.tile}>
          <Ionicons name={deliveryIcon[o.deliveryMethod]} size={22} color={C.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt v="capB">{t('delivery')}</Txt>
          <Txt v="bodyB">
            {t(deliveryKey(o.deliveryMethod))}
            {o.distanceKm ? ` · ${o.distanceKm.toFixed(1)} ${t('km')}` : ''}
          </Txt>
        </View>
      </Row>
      {o.paymentMethod ? (
        <Row gap={12}>
          <View style={s.tile}>
            <Ionicons name={paymentIcon[o.paymentMethod]} size={22} color={C.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt v="capB">{t('payment')}</Txt>
            <Txt v="bodyB">{t(paymentKey(o.paymentMethod))}</Txt>
          </View>
          {o.paymentStatus === 'paid' ? <Pill label={t('paid')} tone="success" icon="checkmark" /> : o.paymentStatus === 'cash_on_delivery' ? <Pill label={t('cash_on_delivery')} tone="warning" /> : null}
        </Row>
      ) : null}
      {!stopped && o.paymentMethod === 'cash' && (o.deliveryMethod === 'supplier' || o.deliveryMethod === 'pickup') ? (
        <Notice tone="warning" icon="cash-outline" text={t('collect_cash', { s: formatPrice(o.subtotal - o.promoDiscount + (o.deliveryMethod === 'supplier' ? o.deliveryFee : 0)) })} />
      ) : null}
    </Card>
  );

  const items = (
    <Card style={{ gap: 4 }} pad={14}>
      <Txt v="capB" style={{ paddingHorizontal: 4, paddingBottom: 6 }}>
        {t('items_n', { n: o.items.reduce((a, i) => a + i.qty, 0) })}
      </Txt>
      {o.items.map((i) => (
        <Row key={i.offerId} gap={12} style={{ paddingVertical: 8, paddingHorizontal: 4 }}>
          <Thumb image={i.image} emoji={i.emoji} color={i.color} size={52} />
          <View style={{ flex: 1 }}>
            <Txt v="bodyB" numberOfLines={2}>
              {i.title}
            </Txt>
            <Txt v="cap">
              {formatPrice(i.price)} / {t('pcs')}
            </Txt>
          </View>
          <View style={s.qty}>
            <Txt v="bodyB" color={C.primary}>
              ×{i.qty}
            </Txt>
          </View>
          <Txt v="bodyB" style={{ minWidth: 80, textAlign: 'right' }}>
            {formatPrice(i.qty * i.price)}
          </Txt>
        </Row>
      ))}
      <Divider style={{ marginVertical: 8 }} />
      <Line label={t('subtotal')} value={formatPrice(o.subtotal)} />
      {o.deliveryMethod === 'supplier' && o.deliveryFee ? <Line label={t('your_delivery')} value={'+' + formatPrice(o.deliveryFee)} /> : null}
      {o.promoDiscount ? <Line label={t('promo_discount')} value={'−' + formatPrice(o.promoDiscount)} hint={o.supplierDiscount ? t('promo_yours', { s: formatPrice(o.supplierDiscount) }) : t('promo_platform')} /> : null}
      <Line label={t('commission')} value={o.commission ? '−' + formatPrice(o.commission) : t('free_trial_zero')} />
      <Divider style={{ marginVertical: 8 }} />
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: 4 }}>
        <Txt v="h3">{t('to_credit')}</Txt>
        <Txt v="money" color={stopped ? C.faint : C.success} style={stopped ? { textDecorationLine: 'line-through' } : null}>
          {formatPrice(payout)}
        </Txt>
      </Row>
    </Card>
  );

  const timeline = (
    <Card style={{ gap: 14 }}>
      <Txt v="capB">{t('progress')}</Txt>
      {stopped ? <Notice tone="warning" icon="close-circle-outline" text={stopReason ? `${t(statusKey(o.status))} · ${t('reason')}: ${stopReason}` : t(statusKey(o.status))} /> : null}
      <View style={{ gap: 0 }}>
        {flow.map((st, i) => {
          const h = [...o.history].reverse().find((x) => x.status === st);
          const done = stopped ? !!h : stepIdx >= i && stepIdx !== -1;
          const cur = o.status === st;
          return (
            <Row key={st} gap={12} style={{ alignItems: 'flex-start', minHeight: 46 }}>
              <View style={{ alignItems: 'center', width: 24 }}>
                <View style={[s.dot, done && { backgroundColor: C.primary, borderColor: C.primary }, cur && s.dotCur]}>{done ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}</View>
                {i < flow.length - 1 ? <View style={[s.rail, (stopped ? !!o.history.find((x) => x.status === flow[i + 1]) : stepIdx > i) && { backgroundColor: C.primary }]} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: 10 }}>
                <Txt v={cur ? 'bodyB' : 'body'} color={done ? C.ink : C.faint}>
                  {t(statusKey(st))}
                </Txt>
                {h ? <Txt v="cap">{formatDateTime(h.at)}</Txt> : null}
              </View>
            </Row>
          );
        })}
      </View>
    </Card>
  );

  return (
    <Screen
      back="/orders"
      detail
      title={`${t('order')} №${o.orderNumber}`}
      subtitle={`${t(statusKey(o.status))} · ${timeAgo(t, o.createdAt)}`}
      right={<IconBtn icon="refresh" label={t('retry')} onPress={reload} />}
      refreshing={refreshing}
      onRefresh={refresh}
      footer={footer}
    >
      <LoadError error={error} onRetry={reload} compact />
      <Row>
        <Pill label={t(statusKey(o.status))} tone={statusTone(o.status)} />
        <Txt v="cap">{formatDateTime(o.createdAt)}</Txt>
      </Row>
      {!canAct ? <Notice text={t('view_only')} /> : null}
      {wide ? (
        <Row gap={16} style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1.3, gap: 16 }}>{items}</View>
          <View style={{ flex: 1, gap: 16 }}>
            {customer}
            {delivery}
            {timeline}
          </View>
        </Row>
      ) : (
        <>
          {customer}
          {delivery}
          {items}
          {timeline}
        </>
      )}
      <Sheet
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={stopTo === 'rejected' ? t('reject_q') : t('cancel_q')}
        subtitle={t('reject_sub')}
        footer={
          <Button
            title={stopTo === 'rejected' ? t('act_reject') : t('act_cancel')}
            kind="danger"
            loading={busy}
            disabled={!reason || (reason === t('r_other') && !other.trim())}
            onPress={() => stopTo && change(stopTo, reason === t('r_other') ? other.trim() : reason)}
            testID="reject-confirm"
          />
        }
      >
        <View style={{ gap: 10 }}>
          {reasons.map((r) => (
            <Chip key={r} label={r} active={reason === r} onPress={() => setReason(r)} icon={reason === r ? 'radio-button-on' : 'radio-button-off'} />
          ))}
        </View>
        {reason === t('r_other') ? <Field label={t('reason')} value={other} onChangeText={setOther} placeholder={t('reason_ph')} multiline /> : null}
      </Sheet>
    </Screen>
  );
}

function Line({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={{ paddingHorizontal: 4, paddingVertical: 4 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt>{label}</Txt>
        <Txt v="bodyB">{value}</Txt>
      </Row>
      {hint ? <Txt v="cap">{hint}</Txt> : null}
    </View>
  );
}

const s = StyleSheet.create({
  tile: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  qty: { backgroundColor: C.primarySoft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.line, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  dotCur: { boxShadow: '0px 0px 0px 5px rgba(91,60,245,0.18)' },
  rail: { width: 2, flex: 1, minHeight: 22, backgroundColor: C.line, marginTop: 2 },
});
