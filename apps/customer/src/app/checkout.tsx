import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Order, PaymentMethod } from '@taptym/shared';
import { AddressSheet } from '@/components/address-sheet';
import { StoreAvatar } from '@/components/product';
import { SummaryCard } from '@/components/summary';
import { BottomBar, Button, Card, Empty, ErrorState, Field, Header, price, Row, Screen, Section, Skeleton, Txt, type IconName } from '@/components/ui';
import { errorText, useT, type TKey } from '@/i18n';
import { api } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { DELIVERY_ICON, useQuote } from '@/lib/quote';
import { toast, useApp } from '@/lib/store';
import { C, R } from '@/lib/theme';

export default function CheckoutScreen() {
  const t = useT();
  const profile = useApp((s) => s.profile);
  const token = useApp((s) => s.token);
  const addressId = useApp((s) => s.addressId);
  const promo = useApp((s) => s.promo);
  const { quote: q, error: quoteError, refresh: refreshQuote } = useQuote();
  const [method, setMethod] = useState<PaymentMethod>('qr');
  const [comment, setComment] = useState('');
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) router.replace({ pathname: '/login', params: { next: '/checkout' } });
  }, [token]);
  useEffect(() => {
    const addrs = profile?.addresses ?? [];
    if (addrs.length && !addrs.some((a) => a.id === addressId)) useApp.getState().setAddressId(addrs[0].id);
  }, [profile, addressId]);
  useEffect(() => {
    if (q && method === 'cash' && !q.cashAllowed) setMethod('qr');
  }, [q, method]);

  if (!useApp.getState().cart.length && !busy) {
    return (
      <Screen header={<Header title={t('checkout_title')} />}>
        <Empty emoji="🛍️" title={t('cart_empty')} action={t('to_shopping')} onAction={() => router.replace('/')} />
      </Screen>
    );
  }

  const methods: { id: PaymentMethod; icon: IconName; title: TKey; sub: TKey; disabled?: boolean; hidden?: boolean }[] = [
    { id: 'qr', icon: 'qr-code', title: 'pm_qr', sub: 'pm_qr_sub' },
    { id: 'card', icon: 'card', title: 'pm_card', sub: 'pm_card_sub' },
    { id: 'cash', icon: 'cash', title: 'pm_cash', sub: q && !q.cashAllowed ? 'pm_cash_off' : 'pm_cash_sub', disabled: !!q && !q.cashAllowed },
    { id: 'invoice', icon: 'document-text', title: 'pm_invoice', sub: 'pm_invoice_sub', hidden: !profile?.isCompany },
  ];

  const place = async () => {
    if (!q) return;
    if (!addressId) {
      toast(t('err_address_required'), 'error');
      setSheet(true);
      return;
    }
    setBusy(true);
    try {
      const s = useApp.getState();
      const order = await api<Order>('/orders', {
        body: {
          lines: s.cart,
          groups: q.groups.map((g) => ({ supplierId: g.supplier.id, deliveryMethod: g.deliveryMethod })),
          addressId,
          paymentMethod: method,
          promoCode: promo && !q.promoError ? promo : null,
          coinsToUse: q.coinsUsed,
          comment: comment.trim(),
        },
      });
      haptic.success();
      s.clearCart();
      const instant = order.paymentStatus === 'cash_on_delivery' || order.paymentStatus === 'paid';
      router.replace(instant ? `/success/${order.id}` : `/pay/${order.id}`);
    } catch (e) {
      haptic.error();
      toast(errorText(e), 'error');
      setBusy(false);
    }
  };

  return (
    <Screen
      header={<Header title={t('checkout_title')} />}
      footer={
        q ? (
          <BottomBar>
            <Button title={t('place_order', { p: price(q.total) })} icon="lock-closed" onPress={place} loading={busy} style={{ flex: 1 }} />
          </BottomBar>
        ) : null
      }
    >
      <Section title={t('address')} style={{ marginTop: 4 }}>
        <View style={{ gap: 8 }}>
          {(profile?.addresses ?? []).map((a) => {
            const on = a.id === addressId;
            return (
              <Pressable
                key={a.id}
                onPress={() => {
                  haptic.select();
                  useApp.getState().setAddressId(a.id);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[s.opt, on && s.optOn]}
              >
                <View style={[s.optIcon, on && { backgroundColor: C.primary }]}>
                  <Ionicons name={a.label.toLowerCase().includes('раб') ? 'briefcase' : 'home'} size={18} color={on ? C.white : C.primary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt v="bodyBold">{a.label}</Txt>
                  <Txt v="small" lines={2}>
                    {a.line}
                  </Txt>
                </View>
                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={24} color={on ? C.primary : C.faint} />
              </Pressable>
            );
          })}
          <Button title={t('add_address')} icon="add" v="secondary" size="md" onPress={() => setSheet(true)} />
        </View>
      </Section>

      {q ? (
        <Section title={t('delivery')}>
          <Card pad={4} style={{ borderRadius: R.xl }}>
            {q.groups.map((g) => (
              <Row key={g.supplier.id} gap={12} style={{ padding: 12 }}>
                <StoreAvatar s={g.supplier} size={40} />
                <View style={{ flex: 1 }}>
                  <Txt v="bodyBold">{g.supplier.name}</Txt>
                  <Row gap={4}>
                    <Ionicons name={DELIVERY_ICON[g.deliveryMethod]} size={14} color={C.muted} />
                    <Txt v="small">{t(`dm_${g.deliveryMethod}` as TKey)}</Txt>
                  </Row>
                </View>
                <Txt v="bodyBold" color={g.deliveryFee === 0 ? C.successInk : C.ink}>
                  {g.deliveryFee === 0 ? t('free') : price(g.deliveryFee)}
                </Txt>
              </Row>
            ))}
          </Card>
        </Section>
      ) : null}

      <Section title={t('payment')}>
        <View style={s.methods}>
          {methods
            .filter((m) => !m.hidden)
            .map((m) => {
              const on = method === m.id;
              return (
                <Pressable
                  key={m.id}
                  disabled={m.disabled}
                  onPress={() => {
                    haptic.select();
                    setMethod(m.id);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on, disabled: m.disabled }}
                  style={[s.method, on && s.optOn, m.disabled && { opacity: 0.5 }]}
                >
                  <View style={[s.optIcon, on && { backgroundColor: C.primary }]}>
                    <Ionicons name={m.icon} size={20} color={on ? C.white : C.primary} />
                  </View>
                  <Txt v="bodyBold" style={{ marginTop: 10 }}>
                    {t(m.title)}
                  </Txt>
                  <Txt v="small" lines={2}>
                    {t(m.sub)}
                  </Txt>
                  {on ? <Ionicons name="checkmark-circle" size={22} color={C.primary} style={{ position: 'absolute', top: 12, right: 12 }} /> : null}
                </Pressable>
              );
            })}
        </View>
      </Section>

      <Section title={t('comment')}>
        <Field value={comment} onChangeText={setComment} placeholder={t('comment_placeholder')} multiline maxLength={500} />
      </Section>

      <View style={{ marginTop: 24 }}>
        {q ? <SummaryCard q={q} /> : quoteError ? <ErrorState error={quoteError} onRetry={refreshQuote} /> : <Skeleton h={220} r={R.xxl} />}
      </View>

      <AddressSheet visible={sheet} onClose={() => setSheet(false)} />
    </Screen>
  );
}

const s = StyleSheet.create({
  opt: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: R.xl, backgroundColor: C.white, borderWidth: 2, borderColor: 'transparent', minHeight: 64 },
  optOn: { borderColor: C.primary, backgroundColor: '#FAF9FF' },
  optIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  method: { flexGrow: 1, flexBasis: 150, padding: 14, borderRadius: R.xl, backgroundColor: C.white, borderWidth: 2, borderColor: 'transparent', minHeight: 120 },
});
