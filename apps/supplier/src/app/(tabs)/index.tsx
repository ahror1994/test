import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatPrice, type SupplierDashboard } from '@taptym/shared';
import { Screen } from '@/components/Screen';
import { Button, Card, ErrorBox, Grid, IconBtn, Money, Row, Section, Skeleton, Stat, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useCan, useStore } from '@/lib/store';
import { C, FONT, shadow } from '@/lib/theme';
import { errorText, useT } from '@/lib/useT';
import { useLayout } from '@/lib/layout';
import { toast } from '@/lib/overlay';

export default function Dashboard() {
  const t = useT();
  const me = useStore((s) => s.me);
  const can = useCan();
  const { wide, cols } = useLayout();
  const { data, error, loading, refreshing, refresh, reload, setData } = useApi<SupplierDashboard>('/api/s/dashboard');
  const [busy, setBusy] = useState<string | null>(null);
  const money = can('finance') || can('finance_view');
  const products = can('products');

  const patch = async (key: string, offerId: number, body: object, msg: string) => {
    setBusy(key);
    try {
      await api(`/api/s/products/${offerId}`, { method: 'PATCH', body });
      toast(msg);
      void reload();
    } catch (e) {
      toast(errorText(t, e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const d = data;
  const right = <IconBtn icon="notifications-outline" label={t('m_notifications')} badge={me?.unread} onPress={() => router.navigate('/notifications')} />;

  return (
    <Screen title={t('hello', { name: me?.staffName ?? '' })} subtitle={me?.name} right={right} refreshing={refreshing} onRefresh={refresh}>
      {error && !d ? <ErrorBox text={errorText(t, error)} onRetry={reload} retry={t('retry')} /> : null}
      {loading || !d ? (
        <View style={{ gap: 14 }}>
          <Skeleton h={120} r={24} />
          <Grid cols={Math.max(2, cols)}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} h={118} r={24} />
            ))}
          </Grid>
          <Skeleton h={220} r={24} />
        </View>
      ) : (
        <>
          {d.inTrial ? (
            <View style={s.trial}>
              <Text style={{ fontSize: 30 }}>🎁</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.trialTitle}>{t('trial_left', { n: d.trialDaysLeft })}</Text>
                <Text style={s.trialSub}>{t('trial_sub')}</Text>
              </View>
            </View>
          ) : null}

          {can('orders') || can('orders_view') ? (
            <Pressable onPress={() => router.navigate('/orders')} style={({ pressed }) => [s.cta, d.today.newOrders ? s.ctaHot : null, pressed && { transform: [{ scale: 0.99 }] }]} testID="cta-new-orders">
              <View style={[s.ctaIcon, d.today.newOrders ? { backgroundColor: 'rgba(255,255,255,0.2)' } : null]}>
                <Ionicons name={d.today.newOrders ? 'notifications' : 'checkmark-done'} size={28} color={d.today.newOrders ? '#fff' : C.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.ctaTitle, !d.today.newOrders && { color: C.ink }]}>{d.today.newOrders ? t('new_orders_cta', { n: d.today.newOrders }) : t('no_new_orders')}</Text>
                <Text style={[s.ctaSub, !d.today.newOrders && { color: C.muted }]}>{d.today.newOrders ? t('new_orders_cta_sub') : t('no_new_orders_sub')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={d.today.newOrders ? '#fff' : C.faint} />
            </Pressable>
          ) : null}

          <Grid cols={wide ? 4 : 2}>
            <Stat label={t('today_orders')} value={String(d.today.orders)} icon="receipt-outline" />
            {money ? <Stat label={t('today_revenue')} value={formatPrice(d.today.revenue)} icon="trending-up" tone={C.success} /> : null}
            {money ? <Stat label={t('week')} value={formatPrice(d.week.revenue)} icon="calendar-outline" tone={C.info} hint={t('n_orders', { n: d.week.orders })} /> : null}
            {money ? (
              <Stat label={t('month')} value={formatPrice(d.month.revenue)} icon="stats-chart-outline" tone={C.warning} hint={t('commission_x', { x: formatPrice(d.month.commission) })} />
            ) : (
              <Stat label={t('new_orders')} value={String(d.today.newOrders)} icon="notifications-outline" tone={C.danger} />
            )}
          </Grid>

          {money ? (
            <Card onPress={() => router.navigate('/finance')} style={s.balance}>
              <View style={{ flex: 1, gap: 4 }}>
                <Txt v="capB" color="rgba(255,255,255,0.75)">
                  {t('balance')}
                </Txt>
                <Money value={d.balance} v="moneyL" color="#fff" />
                <Txt v="cap" color="rgba(255,255,255,0.75)">
                  {t('balance_hint')}
                </Txt>
              </View>
              <View style={s.balanceBtn}>
                <Ionicons name="wallet" size={24} color={C.ink} />
              </View>
            </Card>
          ) : null}

          {/* On phones the actionable column (price alerts, low stock) goes first. */}
          <View style={{ flexDirection: wide ? 'row' : 'column-reverse', gap: 16, alignItems: 'flex-start' }}>
            <View style={{ flex: wide ? 1.3 : undefined, alignSelf: 'stretch', gap: 16 }}>
              {money ? <RevenueChart chart={d.chart} /> : null}
              {d.topProducts.length ? (
                <Section title={t('top_products')} icon="flame-outline">
                  <Card pad={8}>
                    {d.topProducts.map((p, i) => (
                      <Row key={i} style={s.line}>
                        <Text style={s.rank}>{i + 1}</Text>
                        <Text style={{ fontSize: 22 }}>{p.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Txt v="bodyB" numberOfLines={1}>
                            {p.title}
                          </Txt>
                          <Txt v="cap">{t('sold_n', { n: p.qty })}</Txt>
                        </View>
                        {money ? <Txt v="bodyB">{formatPrice(p.revenue)}</Txt> : null}
                      </Row>
                    ))}
                  </Card>
                </Section>
              ) : null}
            </View>
            <View style={{ flex: wide ? 1 : undefined, alignSelf: 'stretch', gap: 16 }}>
              {products && d.priceAlerts.length ? (
                <Section title={t('price_alerts')} icon="alert-circle-outline">
                  <Card pad={14} style={{ gap: 12 }}>
                    <Txt v="cap">{t('price_alerts_hint')}</Txt>
                    {d.priceAlerts.map((a) => (
                      <View key={a.offerId} style={s.alert} testID={`alert-${a.offerId}`}>
                        <Txt v="bodyB" numberOfLines={2}>
                          {a.title}
                        </Txt>
                        <Row gap={6} wrap>
                          <Txt v="cap">{t('yours')}</Txt>
                          <Txt v="bodyB" color={C.danger}>
                            {formatPrice(a.myPrice)}
                          </Txt>
                          <Txt v="cap">· {t('competitors_from')}</Txt>
                          <Txt v="bodyB" color={C.success}>
                            {formatPrice(a.minPrice)}
                          </Txt>
                        </Row>
                        <Row gap={8} wrap>
                          <Button
                            title={t('lower_to', { p: formatPrice(a.minPrice - 1) })}
                            icon="arrow-down"
                            size="md"
                            style={{ flexGrow: 1, minWidth: 200 }}
                            loading={busy === `a${a.offerId}`}
                            onPress={() => {
                              setData({ ...d, priceAlerts: d.priceAlerts.filter((x) => x.offerId !== a.offerId) });
                              return patch(`a${a.offerId}`, a.offerId, { price: a.minPrice - 1 }, t('price_lowered', { p: formatPrice(a.minPrice - 1) }));
                            }}
                            testID={`lower-${a.offerId}`}
                          />
                          <Button
                            title={`= ${formatPrice(a.minPrice)}`}
                            kind="secondary"
                            size="md"
                            full={false}
                            loading={busy === `e${a.offerId}`}
                            onPress={() => {
                              setData({ ...d, priceAlerts: d.priceAlerts.filter((x) => x.offerId !== a.offerId) });
                              return patch(`e${a.offerId}`, a.offerId, { price: a.minPrice }, t('price_lowered', { p: formatPrice(a.minPrice) }));
                            }}
                          />
                        </Row>
                      </View>
                    ))}
                  </Card>
                </Section>
              ) : null}

              {products && d.lowStock.length ? (
                <Section title={t('low_stock')} icon="cube-outline" action={t('all')} onAction={() => router.navigate({ pathname: '/products', params: { filter: 'low' } })}>
                  <Card pad={8}>
                    {d.lowStock.map((p) => (
                      <Row key={p.offerId} style={s.line}>
                        <View style={{ flex: 1 }}>
                          <Txt v="bodyB" numberOfLines={1}>
                            {p.title}
                          </Txt>
                          <Txt v="cap" color={p.stock === 0 ? C.danger : C.warning}>
                            {p.stock === 0 ? t('out_of_stock') : t('left_n', { n: p.stock })}
                          </Txt>
                        </View>
                        {[10, 50].map((n) => (
                          <Button
                            key={n}
                            title={`+${n}`}
                            kind="secondary"
                            size="sm"
                            full={false}
                            loading={busy === `s${p.offerId}-${n}`}
                            onPress={() => patch(`s${p.offerId}-${n}`, p.offerId, { stock: p.stock + n }, t('stock_set', { n: p.stock + n }))}
                          />
                        ))}
                      </Row>
                    ))}
                  </Card>
                </Section>
              ) : null}

              <Card style={{ gap: 6 }} onPress={() => router.navigate('/reviews')}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt v="capB">{t('rating')}</Txt>
                  <Ionicons name="chevron-forward" size={18} color={C.faint} />
                </Row>
                <Row gap={8}>
                  <Txt v="money">{d.rating.toFixed(1)}</Txt>
                  <Row gap={2}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Ionicons key={i} name={d.rating >= i - 0.25 ? 'star' : d.rating >= i - 0.75 ? 'star-half' : 'star-outline'} size={18} color={C.accent} />
                    ))}
                  </Row>
                </Row>
                <Txt v="cap">{t('rating_hint')}</Txt>
              </Card>
            </View>
          </View>
        </>
      )}
    </Screen>
  );
}

function RevenueChart({ chart }: { chart: SupplierDashboard['chart'] }) {
  const t = useT();
  const [sel, setSel] = useState(chart.length - 1);
  const max = Math.max(1, ...chart.map((c) => c.revenue));
  const cur = chart[sel] ?? chart[chart.length - 1];
  const total = chart.reduce((a, c) => a + c.revenue, 0);
  return (
    <Card style={{ gap: 14 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View>
          <Txt v="capB">{t('chart_14')}</Txt>
          <Txt v="money">{formatPrice(total)}</Txt>
        </View>
        {cur ? (
          <View style={s.tip}>
            <Txt v="tiny">{cur.date.slice(8, 10) + '.' + cur.date.slice(5, 7)}</Txt>
            <Txt v="bodyB">{formatPrice(cur.revenue)}</Txt>
            <Txt v="tiny">{t('n_orders', { n: cur.orders })}</Txt>
          </View>
        ) : null}
      </Row>
      <View style={s.bars}>
        {chart.map((c, i) => (
          <Pressable key={c.date} onPress={() => setSel(i)} onHoverIn={() => setSel(i)} style={s.barCol} accessibilityLabel={`${c.date}: ${formatPrice(c.revenue)}`}>
            <View style={[s.bar, { height: `${Math.max(3, (c.revenue / max) * 84)}%`, backgroundColor: i === sel ? C.primary : '#D9D2FF' }]} />
            <Text style={[s.barLbl, i === sel && { color: C.ink }]}>{c.date.slice(8, 10)}</Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  trial: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#1E1446', borderRadius: 24, padding: 18 },
  trialTitle: { color: '#fff', fontSize: 17, fontWeight: '800', fontFamily: FONT },
  trialSub: { color: 'rgba(255,255,255,0.72)', fontSize: 13, fontWeight: '600', fontFamily: FONT, marginTop: 2 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderRadius: 24, padding: 18, minHeight: 88, ...shadow.soft },
  ctaHot: { backgroundColor: C.danger, boxShadow: '0px 12px 28px rgba(240,68,56,0.35)' },
  ctaIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: C.successSoft, alignItems: 'center', justifyContent: 'center' },
  ctaTitle: { color: '#fff', fontSize: 19, fontWeight: '900', fontFamily: FONT, letterSpacing: -0.3 },
  ctaSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', fontFamily: FONT, marginTop: 2 },
  balance: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.primary, ...shadow.primary },
  balanceBtn: { width: 52, height: 52, borderRadius: 18, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  line: { paddingVertical: 10, paddingHorizontal: 10, gap: 12 },
  rank: { width: 22, fontSize: 15, fontWeight: '900', color: C.faint, textAlign: 'center', fontFamily: FONT },
  alert: { gap: 8, padding: 12, borderRadius: 18, backgroundColor: C.bg },
  tip: { alignItems: 'flex-end', backgroundColor: C.bg, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 150, gap: 4 },
  barCol: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: 6 },
  bar: { width: '100%', maxWidth: 28, borderRadius: 8 },
  barLbl: { fontSize: 10, fontWeight: '700', color: C.faint, fontFamily: FONT },
});
