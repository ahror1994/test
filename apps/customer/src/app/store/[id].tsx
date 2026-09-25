import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import type { SupplierPublic } from '@taptym/shared';
import { CatalogBlock } from '@/components/catalog';
import { StoreAvatar } from '@/components/product';
import { Badge, Card, ErrorState, Header, Row, Screen, Section, Skeleton, Txt } from '@/components/ui';
import { useT } from '@/i18n';
import { useQuery } from '@/lib/api';
import { C, R } from '@/lib/theme';

type Store = SupplierPublic & { description: string; workHours: string };

export default function StoreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const q = useQuery<Store>(`/suppliers/${id}`);
  const s = q.data;
  return (
    <Screen header={<Header title={s?.name} />} refreshing={q.refreshing} onRefresh={q.refresh}>
      {q.error && !s ? (
        <ErrorState error={q.error} onRetry={q.refresh} />
      ) : !s ? (
        <Skeleton h={180} r={R.xxl} />
      ) : (
        <Card pad={20} style={{ borderRadius: R.xxl }}>
          <Row gap={14} style={{ alignItems: 'flex-start' }}>
            <StoreAvatar s={s} size={72} />
            <View style={{ flex: 1, gap: 4 }}>
              <Txt v="h1">{s.name}</Txt>
              <Row gap={10} wrap>
                <Row gap={3}>
                  <Ionicons name="star" size={15} color="#FFB800" />
                  <Txt v="bodyBold">{s.rating.toFixed(1)}</Txt>
                </Row>
                <Txt v="small">{t('orders_done', { n: s.ordersCount })}</Txt>
                {s.ownDelivery ? <Badge label={t('own_delivery')} icon="bicycle" color={C.successInk} bg={C.successSoft} /> : null}
                {s.isNew ? <Badge label={t('new_badge')} /> : null}
              </Row>
            </View>
          </Row>
          {s.description ? (
            <Txt v="body" style={{ marginTop: 14, color: '#3A3E52' }}>
              {s.description}
            </Txt>
          ) : null}
          <View style={{ marginTop: 14, gap: 8 }}>
            <Row gap={8}>
              <Ionicons name="location-outline" size={18} color={C.muted} />
              <Txt v="body" style={{ flex: 1 }}>
                {s.address}
              </Txt>
            </Row>
            {s.workHours ? (
              <Row gap={8}>
                <Ionicons name="time-outline" size={18} color={C.muted} />
                <Txt v="body" style={{ flex: 1 }}>
                  {t('work_hours')}: {s.workHours}
                </Txt>
              </Row>
            ) : null}
          </View>
        </Card>
      )}
      <Section title={t('store_products')}>
        <CatalogBlock base={{ supplierId: id }} />
      </Section>
    </Screen>
  );
}
