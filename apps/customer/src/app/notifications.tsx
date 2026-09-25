import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { formatDateTime, type NotificationItem } from '@taptym/shared';
import { AuthGate } from '@/components/auth-gate';
import { Card, Empty, Header, Row, Screen, Skeleton, Txt } from '@/components/ui';
import { useT } from '@/i18n';
import { api, useQuery } from '@/lib/api';
import { useApp } from '@/lib/store';
import { C, R } from '@/lib/theme';

export default function NotificationsScreen() {
  const t = useT();
  return (
    <AuthGate title={t('notifications')}>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const t = useT();
  const q = useQuery<NotificationItem[]>('/notifications', { auth: true });
  useEffect(() => {
    if (q.data?.some((n) => !n.read)) {
      api('/notifications/read', { method: 'POST' })
        .then(() => useApp.getState().setUnread(0))
        .catch(() => {});
    }
  }, [q.data]);
  const open = (link: string | null) => {
    if (!link) return;
    const m = link.match(/^\/orders\/(\d+)/);
    if (m) return router.push(`/order/${m[1]}`);
    if (link.startsWith('/')) router.push(link as never);
  };
  return (
    <Screen header={<Header title={t('notifications')} />} refreshing={q.refreshing} onRefresh={q.refresh}>
      {!q.data ? (
        <View style={{ gap: 10 }}>
          <Skeleton h={80} r={R.xl} />
          <Skeleton h={80} r={R.xl} />
        </View>
      ) : q.data.length === 0 ? (
        <Empty emoji="🔔" title={t('no_notifications')} />
      ) : (
        <View style={{ gap: 10 }}>
          {q.data.map((n) => (
            <Card key={n.id} onPress={n.link ? () => open(n.link) : undefined} style={!n.read ? { borderLeftWidth: 4, borderLeftColor: C.primary } : undefined}>
              <Row gap={12} style={{ alignItems: 'flex-start' }}>
                <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="notifications" size={20} color={C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt v="bodyBold">{n.title}</Txt>
                  <Txt v="body" color={C.muted}>
                    {n.body}
                  </Txt>
                  <Txt v="small" style={{ marginTop: 4 }}>
                    {formatDateTime(n.createdAt)}
                  </Txt>
                </View>
              </Row>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
