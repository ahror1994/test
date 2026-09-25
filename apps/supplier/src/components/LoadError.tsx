import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ApiError, SERVER_CONFIGURABLE } from '@/lib/api';
import { useStore } from '@/lib/store';
import { openServerSheet } from '@/lib/overlay';
import { C, R } from '@/lib/theme';
import { errorText, useT } from '@/lib/useT';
import { Button, Card, Row, Txt } from './ui';

/**
 * Replaces the content of a screen whose data could not be loaded. `compact` is a one-line
 * banner for when older data is still on screen and only the refresh failed.
 */
export function LoadError({ error, onRetry, compact }: { error: ApiError | null; onRetry: () => unknown; compact?: boolean }) {
  const t = useT();
  const url = useStore((s) => s.apiUrl);
  const [busy, setBusy] = useState(false);

  const retry = async () => {
    setBusy(true);
    try {
      const st = useStore.getState();
      // Permissions (tabs) come from /me, which also failed if the app started offline.
      await Promise.all([onRetry(), st.token && !st.me ? st.loadMe() : null]);
    } finally {
      setBusy(false);
    }
  };

  // A new server address was just saved in the sheet: try it right away.
  const lastUrl = useRef(url);
  useEffect(() => {
    if (lastUrl.current === url) return;
    lastUrl.current = url;
    if (error) void onRetry();
  }, [url, error, onRetry]);

  if (!error) return null;
  const offline = error.code === 'network';

  if (compact)
    return (
      <Pressable onPress={retry} style={({ pressed }) => [s.banner, pressed && { opacity: 0.8 }]} accessibilityRole="button" testID="offline-banner">
        <Ionicons name={offline ? 'cloud-offline-outline' : 'alert-circle-outline'} size={18} color={C.danger} />
        <Txt v="capB" color={C.danger} style={{ flex: 1 }} numberOfLines={2}>
          {offline ? t('offline_stale') : errorText(t, error)}
        </Txt>
        <Ionicons name="refresh" size={18} color={C.danger} />
      </Pressable>
    );

  return (
    <Card style={s.card}>
      <View style={s.icon}>
        <Ionicons name={offline ? 'cloud-offline-outline' : 'alert-circle-outline'} size={34} color={C.danger} />
      </View>
      <Txt v="h3" center>
        {offline ? t('offline_title') : errorText(t, error)}
      </Txt>
      {offline ? (
        <Txt v="cap" center style={{ maxWidth: 380 }}>
          {t(Platform.OS === 'web' ? 'offline_hint_web' : 'offline_hint')}
        </Txt>
      ) : null}
      <Row gap={10} wrap style={{ justifyContent: 'center', marginTop: 6 }}>
        {error.status === 403 ? (
          <Button title={t('tab_home')} icon="home-outline" size="md" full={false} onPress={() => router.replace('/')} />
        ) : (
          <Button title={t('retry')} icon="refresh" size="md" full={false} onPress={retry} loading={busy} testID="retry" />
        )}
        {offline && SERVER_CONFIGURABLE ? <Button title={t('server_setup')} icon="server-outline" kind="ghost" size="md" full={false} onPress={openServerSheet} testID="offline-server" /> : null}
      </Row>
      {offline && SERVER_CONFIGURABLE ? (
        <Txt v="cap" center>
          {t('server')}: {url.replace(/^https?:\/\//, '')}
        </Txt>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  card: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  icon: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.dangerSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.dangerSoft, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 10 },
});
