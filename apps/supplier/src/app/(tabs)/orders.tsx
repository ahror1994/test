import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatPrice, type SubOrder } from '@taptym/shared';
import { Screen } from '@/components/Screen';
import { Button, Card, Empty, ErrorBox, Grid, Pill, Row, Segmented, SkeletonList, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useCan, useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { errorText, useT } from '@/lib/useT';
import { useLayout } from '@/lib/layout';
import { deliveryIcon, deliveryKey, paymentIcon, paymentKey, statusKey, statusTone, timeAgo } from '@/lib/labels';
import { toast } from '@/lib/overlay';

type Tab = 'new' | 'active' | 'done' | 'cancelled';
type Resp = { items: SubOrder[]; counts: Record<Tab, number> };

export default function Orders() {
  const t = useT();
  const [tab, setTab] = useState<Tab>('new');
  const { cols } = useLayout();
  const { data, error, loading, refreshing, refresh, reload } = useApi<Resp>(`/api/s/orders?status=${tab}`, { interval: 10000 });

  useEffect(() => {
    const me = useStore.getState().me;
    if (data && me && me.newOrders !== data.counts.new) useStore.setState({ me: { ...me, newOrders: data.counts.new } });
  }, [data]);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'new', label: t('o_new'), count: data?.counts.new },
    { key: 'active', label: t('o_active'), count: data?.counts.active },
    { key: 'done', label: t('o_done') },
    { key: 'cancelled', label: t('o_cancelled') },
  ];
  const empty = { new: ['🎉', 'empty_new', 'empty_new_sub'], active: ['📦', 'empty_active', 'empty_active_sub'], done: ['🗂️', 'empty_done', 'empty_done_sub'], cancelled: ['✨', 'empty_cancelled', 'empty_cancelled_sub'] } as const;

  return (
    <Screen title={t('tab_orders')} subtitle={t('auto_refresh')} refreshing={refreshing} onRefresh={refresh} header={<Segmented items={tabs} value={tab} onChange={setTab} />}>
      {error && !data ? <ErrorBox text={errorText(t, error)} onRetry={reload} retry={t('retry')} /> : null}
      {loading ? (
        <SkeletonList n={4} h={140} />
      ) : data && data.items.length === 0 ? (
        <Empty emoji={empty[tab][0]} title={t(empty[tab][1])} text={t(empty[tab][2])} />
      ) : (
        <Grid cols={cols}>
          {(data?.items ?? []).map((o) => (
            <OrderCard key={o.id} o={o} onChanged={reload} />
          ))}
        </Grid>
      )}
    </Screen>
  );
}

function OrderCard({ o, onChanged }: { o: SubOrder; onChanged: () => void }) {
  const t = useT();
  const can = useCan();
  const [busy, setBusy] = useState(false);
  const qty = o.items.reduce((a, i) => a + i.qty, 0);
  const isNew = o.status === 'new';
  const accept = async () => {
    setBusy(true);
    try {
      await api(`/api/s/orders/${o.id}/status`, { body: { status: 'confirmed' } });
      toast(t('order_confirmed'));
      onChanged();
      void useStore.getState().loadMe();
    } catch (e) {
      toast(errorText(t, e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card onPress={() => router.navigate({ pathname: '/order/[id]', params: { id: String(o.id) } })} style={[{ gap: 12 }, isNew && s.newCard]}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Txt v="h3" testID={`order-${o.orderNumber}`}>
            №{o.orderNumber}
          </Txt>
          <Txt v="cap">{timeAgo(t, o.createdAt)}</Txt>
        </View>
        <Pill label={t(statusKey(o.status))} tone={statusTone(o.status)} />
      </Row>
      <Row gap={6}>
        <Text style={{ fontSize: 20 }} numberOfLines={1}>
          {o.items
            .slice(0, 5)
            .map((i) => i.emoji)
            .join(' ')}
        </Text>
        <Txt v="cap" style={{ flex: 1 }} numberOfLines={1}>
          {t('items_n', { n: qty })}
        </Txt>
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="money">{formatPrice(o.subtotal)}</Txt>
        {o.customer?.isCompany ? <Pill label={t('company')} tone="info" icon="business-outline" /> : null}
      </Row>
      <Row gap={14} wrap>
        <Row gap={6}>
          <Ionicons name={deliveryIcon[o.deliveryMethod]} size={17} color={C.ink2} />
          <Txt v="cap" color={C.ink2}>
            {t(deliveryKey(o.deliveryMethod))}
          </Txt>
        </Row>
        {o.paymentMethod ? (
          <Row gap={6}>
            <Ionicons name={paymentIcon[o.paymentMethod]} size={17} color={C.ink2} />
            <Txt v="cap" color={C.ink2}>
              {t(paymentKey(o.paymentMethod))}
            </Txt>
          </Row>
        ) : null}
      </Row>
      {isNew && can('orders') ? <Button title={t('act_confirm')} icon="checkmark-circle" size="md" onPress={accept} loading={busy} testID={`accept-${o.id}`} /> : null}
    </Card>
  );
}

const s = StyleSheet.create({
  newCard: { borderWidth: 2, borderColor: C.danger + '55' },
});
