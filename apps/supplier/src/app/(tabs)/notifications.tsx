import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import type { NotificationItem } from '@taptym/shared';
import { Screen } from '@/components/Screen';
import { Card, Divider, Empty, ErrorBox, ListRow, SkeletonList } from '@/components/ui';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { errorText, useT } from '@/lib/useT';
import { timeAgo } from '@/lib/labels';

function hrefFor(link: string | null): string | null {
  if (!link) return null;
  const m = link.match(/^\/orders\/(\d+)/);
  if (m) return `/order/${m[1]}`;
  if (/^\/(finance|promos|support(\/\d+)?)$/.test(link)) return link;
  return null;
}

export default function Notifications() {
  const t = useT();
  const { data, error, loading, refreshing, refresh, reload } = useApi<NotificationItem[]>('/api/s/notifications', { interval: 15000 });
  const unread = data?.some((n) => !n.read);
  useEffect(() => {
    if (!unread) return;
    void api('/api/s/notifications/read', { method: 'POST' })
      .then(() => useStore.getState().loadMe())
      .catch(() => {});
  }, [unread]);

  return (
    <Screen back="/" detail title={t('m_notifications')} subtitle={t('notif_sub')} refreshing={refreshing} onRefresh={refresh}>
      {error && !data ? <ErrorBox text={errorText(t, error)} onRetry={reload} retry={t('retry')} /> : null}
      {loading ? (
        <SkeletonList n={5} h={64} />
      ) : (
        <Card pad={6}>
          {data?.length === 0 ? <Empty emoji="🔔" title={t('no_notifications')} text={t('no_notifications_sub')} /> : null}
          {(data ?? []).map((n, i) => {
            const href = hrefFor(n.link);
            return (
              <View key={n.id}>
                {i > 0 ? <Divider style={{ marginHorizontal: 14 }} /> : null}
                <ListRow
                  icon={n.title.toLowerCase().includes('заказ') ? 'receipt-outline' : n.title.toLowerCase().includes('выплат') ? 'wallet-outline' : 'notifications-outline'}
                  iconBg={n.read ? C.bg : C.primarySoft}
                  title={n.title}
                  subtitle={`${n.body} · ${timeAgo(t, n.createdAt)}`}
                  onPress={href ? () => router.navigate(href as never) : undefined}
                />
              </View>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}
