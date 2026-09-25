import { useState } from 'react';
import { Linking, Platform, ScrollView, View } from 'react-native';
import { formatDate, formatPrice, type PaymentMethod } from '@taptym/shared';
import { Screen } from '@/components/Screen';
import { Button, Card, Chip, Divider, Empty, ErrorBox, Grid, Notice, Row, Skeleton, Stat, Txt } from '@/components/ui';
import { downloadUrl } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { C } from '@/lib/theme';
import { errorText, useT } from '@/lib/useT';
import { useLayout } from '@/lib/layout';
import { monthKey, paymentKey } from '@/lib/labels';

type Report = {
  month: string;
  ordersCount: number;
  revenue: number;
  commission: number;
  services: number;
  cashRevenue: number;
  cashlessRevenue: number;
  taxEstimate: number;
  taxNote: string;
  rows: { number: string; date: string; subtotal: number; delivery: number; discount: number; commission: number; payment: PaymentMethod }[];
};

export default function Reports() {
  const t = useT();
  const { wide } = useLayout();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    return { key: monthKey(d), label: `${t('months').split(',')[d.getMonth()]} ${d.getFullYear()}` };
  });
  const [month, setMonth] = useState(months[0].key);
  const { data, error, loading, refreshing, refresh, reload } = useApi<Report>(`/api/s/reports/tax?month=${month}`);

  const csv = () => {
    const url = downloadUrl('/api/s/reports/tax.csv', { month });
    if (Platform.OS === 'web') window.open(url, '_blank');
    else void Linking.openURL(url);
  };

  return (
    <Screen back="/more" detail title={t('m_reports')} subtitle={t('reports_sub')} refreshing={refreshing} onRefresh={refresh}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {months.map((m) => (
          <Chip key={m.key} label={m.label} active={m.key === month} onPress={() => setMonth(m.key)} icon="calendar-outline" />
        ))}
      </ScrollView>
      {error && !data ? <ErrorBox text={errorText(t, error)} onRetry={reload} retry={t('retry')} /> : null}
      {loading || !data ? (
        <Grid cols={wide ? 3 : 2}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} h={118} r={24} />
          ))}
        </Grid>
      ) : (
        <>
          <Grid cols={wide ? 3 : 2}>
            <Stat label={t('r_orders')} value={String(data.ordersCount)} icon="receipt-outline" />
            <Stat label={t('r_revenue')} value={formatPrice(data.revenue)} icon="trending-up" tone={C.success} />
            <Stat label={t('r_commission')} value={formatPrice(data.commission)} icon="pie-chart-outline" tone={C.warning} />
            <Stat label={t('r_services')} value={formatPrice(data.services)} icon="megaphone-outline" tone={C.info} />
            <Stat label={t('r_cash')} value={formatPrice(data.cashRevenue)} icon="cash-outline" tone={C.ink2} />
            <Stat label={t('r_cashless')} value={formatPrice(data.cashlessRevenue)} icon="card-outline" tone={C.primary} />
          </Grid>
          <Card tint="#1E1446" style={{ gap: 6 }}>
            <Txt v="capB" color="rgba(255,255,255,0.7)">
              {t('r_tax')}
            </Txt>
            <Txt v="moneyL" color="#fff">
              {formatPrice(data.taxEstimate)}
            </Txt>
            <Txt v="cap" color="rgba(255,255,255,0.75)">
              {t('r_tax_note')}
            </Txt>
          </Card>
          <Button title={t('download_csv')} icon="download-outline" kind="secondary" onPress={csv} testID="report-csv" />
          <Card pad={8}>
            {data.rows.length === 0 ? <Empty emoji="🗓️" title={t('r_empty')} /> : null}
            {data.rows.length && wide ? (
              <Row gap={10} style={{ padding: 10 }}>
                {[t('th_number'), t('th_date'), t('subtotal'), t('th_delivery'), t('th_discount'), t('commission'), t('payment')].map((h, i) => (
                  <Txt key={i} v="tiny" style={{ flex: 1 }}>
                    {h.toUpperCase()}
                  </Txt>
                ))}
              </Row>
            ) : null}
            {data.rows.map((r, i) => (
              <View key={r.number + i}>
                {i > 0 || wide ? <Divider style={{ marginHorizontal: 10 }} /> : null}
                {wide ? (
                  <Row gap={10} style={{ padding: 10 }}>
                    <Txt v="bodyB" style={{ flex: 1 }}>
                      {r.number}
                    </Txt>
                    <Txt style={{ flex: 1 }}>{formatDate(r.date)}</Txt>
                    <Txt style={{ flex: 1 }}>{formatPrice(r.subtotal)}</Txt>
                    <Txt style={{ flex: 1 }}>{formatPrice(r.delivery)}</Txt>
                    <Txt style={{ flex: 1 }}>{formatPrice(r.discount)}</Txt>
                    <Txt style={{ flex: 1 }}>{formatPrice(r.commission)}</Txt>
                    <Txt style={{ flex: 1 }}>{t(paymentKey(r.payment))}</Txt>
                  </Row>
                ) : (
                  <Row style={{ padding: 10, justifyContent: 'space-between' }}>
                    <View>
                      <Txt v="bodyB">№{r.number}</Txt>
                      <Txt v="cap">
                        {formatDate(r.date)} · {t(paymentKey(r.payment))}
                      </Txt>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Txt v="bodyB">{formatPrice(r.subtotal)}</Txt>
                      <Txt v="cap">
                        {t('commission')}: {formatPrice(r.commission)}
                      </Txt>
                    </View>
                  </Row>
                )}
              </View>
            ))}
          </Card>
          <Notice icon="information-circle-outline" text={t('r_only_delivered')} />
        </>
      )}
    </Screen>
  );
}
