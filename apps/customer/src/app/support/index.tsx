import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Linking, View } from 'react-native';
import { formatDateTime } from '@taptym/shared';
import { AuthGate } from '@/components/auth-gate';
import { Badge, BottomBar, Button, Card, Empty, ErrorState, Header, Row, Screen, Skeleton, Txt } from '@/components/ui';
import { useT } from '@/i18n';
import { useQuery } from '@/lib/api';
import { C, R } from '@/lib/theme';

type Thread = { id: number; title: string; orderNumber: string | null; isReturn: boolean; lastMessage: string; lastAt: string; unread: number; status: 'open' | 'closed' };

export default function SupportList() {
  const t = useT();
  return (
    <AuthGate title={t('support')}>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const t = useT();
  const q = useQuery<Thread[]>('/support/threads', { auth: true, refetchOnFocus: true, interval: 10000 });
  const home = useQuery<{ settings: { supportPhone: string; supportTelegram: string } }>('/home');
  const phone = home.data?.settings.supportPhone;
  const tg = home.data?.settings.supportTelegram;
  return (
    <Screen
      header={<Header title={t('support')} />}
      refreshing={q.refreshing}
      onRefresh={q.refresh}
      footer={
        <BottomBar>
          <Button title={t('new_question')} icon="add" onPress={() => router.push('/support/new')} style={{ flex: 1 }} />
        </BottomBar>
      }
    >
      <Card pad={16} style={{ borderRadius: R.xxl, marginBottom: 14 }}>
        <Txt v="h3">{t('support')}</Txt>
        <Txt v="small">{t('support_sub')}</Txt>
        <Row gap={10} style={{ marginTop: 12 }}>
          {phone ? <Button title={t('call_support')} icon="call" v="secondary" size="md" onPress={() => Linking.openURL(`tel:${phone.replace(/\s/g, '')}`)} style={{ flex: 1 }} /> : null}
          {tg ? <Button title="Telegram" icon="paper-plane" v="secondary" size="md" onPress={() => Linking.openURL(`https://t.me/${tg.replace('@', '')}`)} style={{ flex: 1 }} /> : null}
        </Row>
      </Card>
      {q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.refresh} />
      ) : !q.data ? (
        <Skeleton h={90} r={R.xl} />
      ) : q.data.length === 0 ? (
        <Empty emoji="💬" title={t('no_threads')} sub={t('describe_problem')} />
      ) : (
        <View style={{ gap: 10 }}>
          {q.data.map((th) => (
            <Card key={th.id} onPress={() => router.push(`/support/${th.id}`)}>
              <Row gap={12}>
                <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: th.isReturn ? C.warningSoft : C.successSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={th.isReturn ? 'return-down-back' : 'chatbubbles'} size={20} color={th.isReturn ? '#B54708' : C.successInk} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Row gap={6}>
                    <Txt v="bodyBold" lines={1} style={{ flexShrink: 1 }}>
                      {th.title}
                    </Txt>
                    {th.status === 'closed' ? <Badge label={t('closed')} color={C.muted} bg={C.surface} /> : null}
                  </Row>
                  <Txt v="small" lines={1}>
                    {th.lastMessage}
                  </Txt>
                  <Txt v="tiny" color={C.faint}>
                    {formatDateTime(th.lastAt)}
                  </Txt>
                </View>
                {th.unread ? <Badge label={String(th.unread)} color={C.white} bg={C.danger} /> : <Ionicons name="chevron-forward" size={18} color={C.faint} />}
              </Row>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
