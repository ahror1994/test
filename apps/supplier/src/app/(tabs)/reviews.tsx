import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDate, type Review } from '@taptym/shared';
import { Screen } from '@/components/Screen';
import { Card, Empty, ErrorBox, Grid, Row, SkeletonList, Txt } from '@/components/ui';
import { useApi } from '@/lib/useApi';
import { C } from '@/lib/theme';
import { errorText, useT } from '@/lib/useT';
import { useLayout } from '@/lib/layout';

export default function Reviews() {
  const t = useT();
  const { cols } = useLayout();
  const { data, error, loading, refreshing, refresh, reload } = useApi<(Review & { productTitle: string })[]>('/api/s/reviews');
  const avg = data?.length ? data.reduce((a, r) => a + r.rating, 0) / data.length : 0;
  return (
    <Screen back="/more" detail title={t('m_reviews')} subtitle={data?.length ? t('reviews_avg', { a: avg.toFixed(1), n: data.length }) : t('reviews_sub')} refreshing={refreshing} onRefresh={refresh}>
      {error && !data ? <ErrorBox text={errorText(t, error)} onRetry={reload} retry={t('retry')} /> : null}
      {loading ? (
        <SkeletonList n={4} h={110} />
      ) : data?.length === 0 ? (
        <Empty emoji="⭐" title={t('no_reviews')} text={t('no_reviews_sub')} />
      ) : (
        <Grid cols={Math.min(cols, 2)}>
          {(data ?? []).map((r) => (
            <Card key={r.id} style={{ gap: 8 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt v="bodyB">{r.userName}</Txt>
                <Row gap={2}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Ionicons key={i} name={i <= r.rating ? 'star' : 'star-outline'} size={16} color={C.accent} />
                  ))}
                </Row>
              </Row>
              <Txt v="capB" color={C.primary} numberOfLines={1}>
                {r.productTitle}
              </Txt>
              <Txt>{r.text}</Txt>
              <View>
                <Txt v="cap">{formatDate(r.createdAt)}</Txt>
              </View>
            </Card>
          ))}
        </Grid>
      )}
    </Screen>
  );
}
