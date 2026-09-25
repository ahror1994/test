import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View } from 'react-native';
import { formatDateTime, type Order } from '@taptym/shared';
import { OrderStatusChip, PaymentChip } from '@/components/order-bits';
import { Thumb } from '@/components/product';
import { Card, Empty, ErrorState, price, Row, Screen, Skeleton, TabTitle, Txt } from '@/components/ui';
import { useT } from '@/i18n';
import { useQuery } from '@/lib/api';
import { useApp } from '@/lib/store';
import { C, R } from '@/lib/theme';

export default function OrdersScreen() {
  const t = useT();
  const token = useApp((s) => s.token);
  const q = useQuery<Order[]>('/orders', { auth: true, refetchOnFocus: true });

  if (!token) {
    return (
      <Screen header={<TabTitle title={t('orders_title')} />}>
        <Empty emoji="📦" title={t('orders_title')} sub={t('orders_login')} action={t('login_btn')} icon="log-in-outline" onAction={() => router.push({ pathname: '/login', params: { next: '/orders' } })} />
      </Screen>
    );
  }

  return (
    <Screen header={<TabTitle title={t('orders_title')} />} refreshing={q.refreshing} onRefresh={q.refresh}>
      {q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.refresh} />
      ) : !q.data ? (
        <View style={{ gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} h={130} r={R.xxl} />
          ))}
        </View>
      ) : q.data.length === 0 ? (
        <Empty emoji="📦" title={t('no_orders')} sub={t('no_orders_sub')} action={t('to_shopping')} icon="search" onAction={() => router.navigate('/search')} />
      ) : (
        <View style={{ gap: 12 }}>
          {q.data.map((o) => {
            const items = o.subOrders.flatMap((s) => s.items);
            const count = items.reduce((a, i) => a + i.qty, 0);
            return (
              <Card key={o.id} pad={16} style={{ borderRadius: R.xxl }} onPress={() => router.push(`/order/${o.id}`)}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View>
                    <Txt v="h3">{o.number}</Txt>
                    <Txt v="small">{formatDateTime(o.createdAt)}</Txt>
                  </View>
                  <OrderStatusChip status={o.status} />
                </Row>
                <Row gap={8} style={{ marginTop: 12 }}>
                  {items.slice(0, 5).map((i) => (
                    <Thumb key={`${i.offerId}`} image={i.image} emoji={i.emoji} color={i.color} size={48} radius={14} />
                  ))}
                  {items.length > 5 ? (
                    <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
                      <Txt v="bodyBold">+{items.length - 5}</Txt>
                    </View>
                  ) : null}
                </Row>
                <Row style={{ justifyContent: 'space-between', marginTop: 12 }}>
                  <Row gap={6} style={{ flex: 1 }} wrap>
                    <Txt v="small">{t('goods_n', { n: count })}</Txt>
                    <Ionicons name="ellipse" size={4} color={C.faint} />
                    <Txt v="small" lines={1} style={{ flexShrink: 1 }}>
                      {o.subOrders.map((s) => s.supplier.name).join(', ')}
                    </Txt>
                  </Row>
                  <Txt v="price">{price(o.total)}</Txt>
                </Row>
                {o.paymentStatus === 'pending' || o.paymentStatus === 'awaiting_invoice' ? (
                  <View style={{ marginTop: 10 }}>
                    <PaymentChip status={o.paymentStatus} />
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
