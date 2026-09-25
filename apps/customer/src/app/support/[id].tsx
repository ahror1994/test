import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDateTime, type ChatMessage } from '@taptym/shared';
import { AuthGate } from '@/components/auth-gate';
import { Header, Skeleton, styles as ui, Txt } from '@/components/ui';
import { errorText, useT } from '@/i18n';
import { api, useQuery } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { toast } from '@/lib/store';
import { C, R, shadow } from '@/lib/theme';

type Data = { thread: { id: number; title: string; orderNumber: string | null; status: string }; messages: ChatMessage[] };

export default function ChatScreen() {
  const t = useT();
  return (
    <AuthGate title={t('support')}>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const insets = useSafeAreaInsets();
  const q = useQuery<Data>(`/support/threads/${id}/messages`, { auth: true, interval: 5000 });
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const count = q.data?.messages.length ?? 0;

  useEffect(() => {
    const h = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(h);
  }, [count]);

  const send = async () => {
    const v = text.trim();
    if (!v) return;
    setSending(true);
    try {
      await api(`/support/threads/${id}/messages`, { body: { text: v } });
      setText('');
      haptic.tap();
      await q.reload();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={q.data?.thread.title ?? t('support')} />
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={[ui.page, ui.pagePad, { paddingVertical: 12, gap: 8 }]}>
        {!q.data ? (
          <View style={{ gap: 10 }}>
            <Skeleton h={60} w="70%" r={R.xl} />
            <Skeleton h={60} w="60%" r={R.xl} style={{ alignSelf: 'flex-end' }} />
          </View>
        ) : (
          q.data.messages.map((m) => {
            const mine = m.sender === 'customer';
            const system = m.sender === 'system';
            if (system) {
              return (
                <View key={m.id} style={s.system}>
                  <Ionicons name="information-circle" size={16} color={C.muted} />
                  <Txt v="small" style={{ flexShrink: 1 }}>
                    {m.text}
                  </Txt>
                </View>
              );
            }
            return (
              <View key={m.id} style={[s.bubble, mine ? s.mine : s.theirs]}>
                {!mine ? (
                  <Text style={{ fontSize: 12, fontWeight: '800', color: C.primary, marginBottom: 2 }}>{m.senderName || 'Taptym'}</Text>
                ) : null}
                <Text style={{ fontSize: 15, lineHeight: 21, color: mine ? C.white : C.ink, fontWeight: '500' }}>{m.text}</Text>
                <Text style={{ fontSize: 11, marginTop: 4, color: mine ? 'rgba(255,255,255,0.7)' : C.faint, alignSelf: 'flex-end' }}>{formatDateTime(m.createdAt).slice(11)}</Text>
              </View>
            );
          })
        )}
      </ScrollView>
      <View style={[s.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <View style={[ui.page, { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 12 }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('message_placeholder')}
            placeholderTextColor={C.faint}
            multiline
            style={s.input}
            onKeyPress={(e) => {
              const ne = e.nativeEvent as { key: string; shiftKey?: boolean };
              if (Platform.OS === 'web' && ne.key === 'Enter' && !ne.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Pressable onPress={send} disabled={sending || !text.trim()} style={[s.send, (!text.trim() || sending) && { opacity: 0.5 }]} accessibilityLabel={t('send')}>
            {sending ? <ActivityIndicator color={C.white} /> : <Ionicons name="send" size={20} color={C.white} />}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  bubble: { maxWidth: '82%', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  mine: { alignSelf: 'flex-end', backgroundColor: C.primary, borderBottomRightRadius: 6 },
  theirs: { alignSelf: 'flex-start', backgroundColor: C.white, borderBottomLeftRadius: 6, ...shadow.sm },
  system: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', backgroundColor: C.surface, borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 6, maxWidth: '90%' },
  composer: { backgroundColor: C.white, paddingTop: 10, ...shadow.lg },
  input: { flex: 1, minHeight: 48, maxHeight: 120, borderRadius: 24, backgroundColor: C.surface, paddingHorizontal: 16, paddingTop: 13, paddingBottom: 13, fontSize: 16, color: C.ink, outlineStyle: 'none' } as object,
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
});
