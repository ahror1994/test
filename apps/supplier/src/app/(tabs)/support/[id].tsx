import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { ChatMessage, ChatThread } from '@taptym/shared';
import { Screen } from '@/components/Screen';
import { LoadError } from '@/components/LoadError';
import { IconBtn, SkeletonList, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { C, FONT } from '@/lib/theme';
import { errorText, useT } from '@/lib/useT';
import { toast } from '@/lib/overlay';
import { useLayout } from '@/lib/layout';

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const { height } = useLayout();
  const { data, error, reload } = useApi<{ thread: ChatThread; messages: ChatMessage[] }>(id ? `/api/s/support/threads/${id}/messages` : null, { interval: 5000 });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const count = data?.messages.length ?? 0;
  useEffect(() => {
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }, [count]);

  const send = async () => {
    const s = text.trim();
    if (!s) return;
    setBusy(true);
    try {
      await api(`/api/s/support/threads/${id}/messages`, { body: { text: s } });
      setText('');
      void reload();
    } catch (e) {
      toast(errorText(t, e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      back="/support"
      detail
      scroll={false}
      title={data?.thread.title ?? t('m_support')}
      subtitle={t('support_eta')}
      footer={
        <View style={s.composer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('message_ph')}
            placeholderTextColor={C.faint}
            multiline
            onKeyPress={(e: any) => {
              if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                e.preventDefault?.();
                void send();
              }
            }}
            style={[s.input, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
            testID="chat-input"
          />
          <IconBtn icon="send" label={t('send')} bg={C.primary} color="#fff" size={48} onPress={() => void (busy ? null : send())} />
        </View>
      }
    >
      <LoadError error={error} onRetry={reload} compact={!!data} />
      {!data ? (
        error ? null : <SkeletonList n={3} h={60} />
      ) : (
        <ScrollView ref={scroll} style={{ flex: 1, maxHeight: Platform.OS === 'web' ? height - 190 : undefined }} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
          {data.messages.map((m) => {
            const mine = m.sender === 'supplier';
            const sys = m.sender === 'system';
            if (sys)
              return (
                <Txt key={m.id} v="cap" center style={{ paddingVertical: 4 }}>
                  {m.text}
                </Txt>
              );
            return (
              <View key={m.id} style={[s.bubble, mine ? s.mine : s.theirs]}>
                {!mine ? (
                  <Txt v="tiny" color={C.primary}>
                    {m.senderName}
                  </Txt>
                ) : null}
                <Txt color={mine ? '#fff' : C.ink}>{m.text}</Txt>
                <Txt v="tiny" color={mine ? 'rgba(255,255,255,0.7)' : C.faint} style={{ alignSelf: 'flex-end' }}>
                  {new Date(m.createdAt).toTimeString().slice(0, 5)}
                </Txt>
              </View>
            );
          })}
        </ScrollView>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  bubble: { maxWidth: '82%', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
  mine: { alignSelf: 'flex-end', backgroundColor: C.primary, borderBottomRightRadius: 6 },
  theirs: { alignSelf: 'flex-start', backgroundColor: C.card, borderBottomLeftRadius: 6 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  input: { flex: 1, minHeight: 48, maxHeight: 120, borderRadius: 18, backgroundColor: C.card, paddingHorizontal: 16, paddingTop: 13, paddingBottom: 13, fontSize: 16, color: C.ink, fontFamily: FONT, borderWidth: 1.5, borderColor: C.line },
});
