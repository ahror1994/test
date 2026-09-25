import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Linking } from 'react-native';
import type { ChatThread } from '@taptym/shared';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Button, Card, Divider, Empty, ErrorBox, Field, ListRow, Row, SkeletonList, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { errorText, useT } from '@/lib/useT';
import { toast } from '@/lib/overlay';
import { timeAgo } from '@/lib/labels';

export default function Support() {
  const t = useT();
  const { data, error, loading, refreshing, refresh, reload } = useApi<ChatThread[]>('/api/s/support/threads', { interval: 10000 });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const th = await api<ChatThread>('/api/s/support/threads', { body: { title, text } });
      setOpen(false);
      setTitle('');
      setText('');
      void reload();
      router.navigate({ pathname: '/support/[id]', params: { id: String(th.id) } });
    } catch (e) {
      toast(errorText(t, e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen back="/more" detail title={t('m_support')} subtitle={t('support_sub')} refreshing={refreshing} onRefresh={refresh} footer={<Button title={t('new_question')} icon="create-outline" onPress={() => setOpen(true)} testID="support-new" />}>
      <Row gap={10}>
        <Button title="Telegram" icon="paper-plane-outline" kind="secondary" size="md" style={{ flex: 1 }} onPress={() => void Linking.openURL('https://t.me/taptym_support')} />
        <Button title="WhatsApp" icon="logo-whatsapp" kind="secondary" size="md" style={{ flex: 1 }} onPress={() => void Linking.openURL('https://wa.me/996555000000')} />
      </Row>
      {error && !data ? <ErrorBox text={errorText(t, error)} onRetry={reload} retry={t('retry')} /> : null}
      {loading ? (
        <SkeletonList n={3} h={70} />
      ) : (
        <Card pad={6}>
          {data?.length === 0 ? <Empty emoji="💬" title={t('no_threads')} text={t('no_threads_sub')} /> : null}
          {(data ?? []).map((th, i) => (
            <View key={th.id}>
              {i > 0 ? <Divider style={{ marginHorizontal: 14 }} /> : null}
              <ListRow
                icon={th.status === 'closed' ? 'checkmark-done-outline' : 'chatbubble-ellipses-outline'}
                title={th.title}
                subtitle={`${th.lastMessage} · ${timeAgo(t, th.lastAt)}`}
                badge={th.unread || undefined}
                onPress={() => router.navigate({ pathname: '/support/[id]', params: { id: String(th.id) } })}
              />
            </View>
          ))}
        </Card>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={t('new_question')} subtitle={t('support_eta')} footer={<Button title={t('send')} icon="paper-plane" onPress={create} loading={busy} disabled={!text.trim()} testID="support-send" />}>
        <Field label={t('topic')} value={title} onChangeText={setTitle} placeholder={t('topic_ph')} />
        <Field label={t('message')} value={text} onChangeText={setText} placeholder={t('message_ph')} multiline testID="support-text" />
      </Sheet>
    </Screen>
  );
}
