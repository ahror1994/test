import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { AuthGate } from '@/components/auth-gate';
import { BottomBar, Button, Field, Header, Screen, Txt } from '@/components/ui';
import { errorText, useT } from '@/i18n';
import { api } from '@/lib/api';
import { toast } from '@/lib/store';
import { C } from '@/lib/theme';

export default function NewThread() {
  const t = useT();
  return (
    <AuthGate title={t('new_question')}>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const t = useT();
  const { orderId, isReturn } = useLocalSearchParams<{ orderId?: string; isReturn?: string }>();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      const th = await api<{ id: number }>('/support/threads', {
        body: { title: title.trim() || undefined, text: text.trim(), orderId: orderId ? Number(orderId) : undefined, isReturn: isReturn === '1' },
      });
      router.replace(`/support/${th.id}`);
    } catch (e) {
      toast(errorText(e), 'error');
      setBusy(false);
    }
  };
  return (
    <Screen
      header={<Header title={t('new_question')} />}
      footer={
        <BottomBar>
          <Button title={t('send')} icon="send" onPress={send} loading={busy} disabled={!text.trim()} style={{ flex: 1 }} />
        </BottomBar>
      }
    >
      <Txt v="body" color={C.muted} style={{ marginBottom: 16 }}>
        {t('describe_problem')}
      </Txt>
      <Field label={t('topic')} value={title} onChangeText={setTitle} placeholder={t('topic_placeholder')} icon="pricetag-outline" />
      <Field label={t('message_placeholder').replace('…', '')} value={text} onChangeText={setText} placeholder={t('message_placeholder')} multiline style={{ marginTop: 14 }} autoFocus />
    </Screen>
  );
}
