import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import type { Order } from '@taptym/shared';
import { Button, Card, ErrorState, Header, price, Row, Screen, Skeleton, Txt } from '@/components/ui';
import { errorText, useT } from '@/i18n';
import { api, API_URL, useQuery } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { toast, useApp } from '@/lib/store';
import { C, R, shadow } from '@/lib/theme';

export default function PayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const token = useApp((s) => s.token);
  const q = useQuery<Order>(`/orders/${id}`, { auth: true, interval: 3000 });
  const o = q.data;
  const pay = o?.payment;
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (o && (o.paymentStatus === 'paid' || o.paymentStatus === 'cash_on_delivery')) router.replace(`/success/${o.id}`);
  }, [o]);

  const demoPay = async () => {
    setBusy(true);
    try {
      await api(`/orders/${id}/pay-demo`, { method: 'POST' });
      haptic.success();
      router.replace(`/success/${id}`);
    } catch (e) {
      toast(errorText(e), 'error');
      setBusy(false);
    }
  };

  const toOrder = () => router.replace(`/order/${id}`);

  if (q.error && !o) {
    return (
      <Screen header={<Header title={t('pay_title')} />}>
        <ErrorState error={q.error} onRetry={q.refresh} />
      </Screen>
    );
  }
  if (!o) {
    return (
      <Screen header={<Header title={t('pay_title')} />}>
        <Skeleton h={420} r={R.xxl} />
      </Screen>
    );
  }

  const isInvoice = o.paymentMethod === 'invoice';
  const isCard = o.paymentMethod === 'card';

  return (
    <Screen header={<Header title={t('pay_title')} onBack={toOrder} />}>
      <View style={{ maxWidth: 480, width: '100%', alignSelf: 'center', gap: 14 }}>
        <Card pad={22} style={{ borderRadius: R.xxl, alignItems: 'center' }}>
          <Txt v="small">{t('order_number', { n: o.number })}</Txt>
          <Txt v="display" style={{ marginTop: 4 }}>
            {price(o.total)}
          </Txt>
          {isInvoice ? (
            <>
              <View style={[s.bigIcon, { backgroundColor: C.primarySoft }]}>
                <Ionicons name="document-text" size={48} color={C.primary} />
              </View>
              <Txt v="body" center color={C.muted}>
                {t('invoice_hint')}
              </Txt>
              <Button
                title={t('open_invoice')}
                icon="open-outline"
                onPress={() => Linking.openURL(`${API_URL}/api/c/orders/${o.id}/invoice?token=${token}`)}
                style={{ marginTop: 16, alignSelf: 'stretch' }}
              />
            </>
          ) : (
            <>
              {pay?.qrDataUrl && !isCard ? (
                <>
                  <View style={s.qrWrap}>
                    <Image source={{ uri: pay.qrDataUrl }} style={{ width: 240, height: 240 }} contentFit="contain" />
                  </View>
                  <Txt v="bodyBold" center>
                    {t('scan_qr')}
                  </Txt>
                  {pay.deepLinks.length ? (
                    <>
                      <Txt v="small" center style={{ marginTop: 14, marginBottom: 8 }}>
                        {t('or_open_bank')}
                      </Txt>
                      <Row gap={8} wrap style={{ justifyContent: 'center' }}>
                        {pay.deepLinks.map((d) => (
                          <Pressable key={d.bank} onPress={() => Linking.openURL(d.url)} style={({ pressed }) => [s.bank, pressed && { opacity: 0.8 }]}>
                            <Ionicons name="phone-portrait-outline" size={16} color={C.ink} />
                            <Txt v="bodyBold" style={{ fontSize: 14 }}>
                              {d.bank}
                            </Txt>
                          </Pressable>
                        ))}
                      </Row>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  <View style={[s.bigIcon, { backgroundColor: C.primarySoft }]}>
                    <Ionicons name="card" size={48} color={C.primary} />
                  </View>
                  <Txt v="body" center color={C.muted}>
                    {t('card_hint')}
                  </Txt>
                  {pay ? (
                    <Button title={t('pm_card')} icon="lock-closed" onPress={() => Linking.openURL(`${API_URL}/api/pay/${pay.id}`)} style={{ marginTop: 14, alignSelf: 'stretch' }} />
                  ) : null}
                </>
              )}
              <Row gap={8} style={{ marginTop: 18 }}>
                <ActivityIndicator size="small" color={C.primary} />
                <Txt v="small">{t('waiting_payment')}</Txt>
              </Row>
            </>
          )}
        </Card>

        {pay?.demo && !isInvoice ? (
          <Card pad={16} style={{ borderRadius: R.xxl, backgroundColor: C.accentSoft, gap: 12 }}>
            <Row gap={10}>
              <Ionicons name="flask" size={20} color={C.accentInk} />
              <Txt v="bodyBold" color={C.accentInk} style={{ flex: 1 }}>
                {t('demo_notice')}
              </Txt>
            </Row>
            <Button title={t('i_paid_demo')} v="success" icon="checkmark-done" onPress={demoPay} loading={busy} />
          </Card>
        ) : null}

        <Button title={t('to_order')} v="ghost" onPress={toOrder} />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  qrWrap: { marginVertical: 18, padding: 14, borderRadius: R.xl, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, ...shadow.md },
  bank: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 14, borderRadius: R.pill, backgroundColor: C.surface },
  bigIcon: { width: 96, height: 96, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginVertical: 18 },
});
