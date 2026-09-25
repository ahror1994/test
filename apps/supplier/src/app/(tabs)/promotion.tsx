import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { formatDate, formatPrice } from '@taptym/shared';
import { Screen } from '@/components/Screen';
import { LoadError } from '@/components/LoadError';
import { Button, Card, Empty, Grid, Pill, Row, Section, SkeletonList, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { C } from '@/lib/theme';
import { errorText, useT } from '@/lib/useT';
import { useLayout } from '@/lib/layout';
import { confirm, toast } from '@/lib/overlay';
import type { TKey } from '../../i18n';

type Svc = { type: string; title: string; description: string; price: number; days: number; free: boolean };
type Mine = { id: number; type: string; title: string; price: number; startsAt: string; endsAt: string | null; status: 'active' | 'pending' | 'finished' };

const EMOJI: Record<string, string> = { top_search: '🔝', featured: '⭐', banner: '🖼️', catalog_upload: '🧑‍💻', courier_plan: '🛵' };
const STATUS_TONE = { active: 'success', pending: 'warning', finished: 'neutral' } as const;

export default function Promotion() {
  const t = useT();
  const { cols } = useLayout();
  const { data, error, loading, refreshing, refresh, reload } = useApi<{ catalog: Svc[]; mine: Mine[] }>('/api/s/services');

  const buy = async (x: Svc) => {
    if (x.type === 'catalog_upload') return router.navigate('/import');
    const price = x.free ? 0 : x.price;
    const ok = await confirm({
      title: t(`svc_${x.type}` as TKey),
      message: price ? t('buy_msg', { p: formatPrice(price) }) : t('buy_free_msg'),
      confirmText: price ? t('buy_for', { p: formatPrice(price) }) : t('get_free'),
    });
    if (!ok) return;
    try {
      await api('/api/s/services', { body: { type: x.type } });
      toast(t('svc_bought'));
      void reload();
    } catch (e) {
      toast(errorText(t, e), 'error');
    }
  };

  return (
    <Screen back="/more" detail title={t('m_promotion')} subtitle={t('promotion_sub')} refreshing={refreshing} onRefresh={refresh}>
      <LoadError error={error} onRetry={reload} compact={!!data} />
      {!data && error ? null : loading || !data ? (
        <SkeletonList n={4} h={150} />
      ) : (
        <>
          <Grid cols={cols}>
            {data.catalog.map((x) => (
              <Card key={x.type} style={{ gap: 10, flex: 1 }}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={s.emoji}>
                    <Text style={{ fontSize: 28 }}>{EMOJI[x.type] ?? '✨'}</Text>
                  </View>
                  {x.free ? <Pill tone="success" label={t('free')} icon="gift-outline" /> : null}
                </Row>
                <Txt v="h3">{t(`svc_${x.type}` as TKey)}</Txt>
                <Txt v="cap" style={{ flex: 1 }}>
                  {t(`svc_${x.type}_d` as TKey)}
                </Txt>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View>
                    {x.free ? (
                      <Txt v="cap" style={{ textDecorationLine: 'line-through' }}>
                        {formatPrice(x.price)}
                      </Txt>
                    ) : null}
                    <Txt v="money" color={x.free ? C.success : C.ink}>
                      {x.free ? t('free') : formatPrice(x.price)}
                    </Txt>
                    <Txt v="cap">{x.type === 'catalog_upload' ? t('per_hour') : x.days ? t('for_days', { n: x.days }) : ''}</Txt>
                  </View>
                  <Button title={x.type === 'catalog_upload' ? t('order_service') : t('buy')} size="md" full={false} kind={x.free ? 'success' : 'primary'} onPress={() => buy(x)} testID={`buy-${x.type}`} />
                </Row>
              </Card>
            ))}
          </Grid>
          <Section title={t('my_services')} icon="albums-outline">
            <Card pad={8}>
              {data.mine.length === 0 ? <Empty emoji="📣" title={t('no_services')} text={t(data.catalog.some((x) => x.free) ? 'no_services_sub' : 'no_services_sub_paid')} /> : null}
              {data.mine.map((m) => (
                <Row key={m.id} gap={12} style={{ padding: 12 }}>
                  <Text style={{ fontSize: 24 }}>{EMOJI[m.type] ?? '✨'}</Text>
                  <View style={{ flex: 1 }}>
                    <Txt v="bodyB">{m.title}</Txt>
                    <Txt v="cap">
                      {formatDate(m.startsAt)}
                      {m.endsAt ? ` — ${formatDate(m.endsAt)}` : ''} · {m.price ? formatPrice(m.price) : t('free')}
                    </Txt>
                  </View>
                  <Pill tone={STATUS_TONE[m.status]} label={t(`ss_${m.status}` as TKey)} />
                </Row>
              ))}
            </Card>
          </Section>
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  emoji: { width: 52, height: 52, borderRadius: 16, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
