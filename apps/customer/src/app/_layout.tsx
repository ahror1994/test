import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ServerSheetHost } from '@/components/server-sheet';
import { Empty, ToastHost } from '@/components/ui';
import { useT } from '@/i18n';
import { refreshMe } from '@/lib/actions';
import { useServer } from '@/lib/server';
import { useApp } from '@/lib/store';
import { C } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const t = useT();
  return (
    <View style={{ flex: 1, justifyContent: 'center', backgroundColor: C.bg }}>
      <Empty emoji="😕" title={t('error_title')} action={t('retry')} icon="refresh" onAction={retry} />
    </View>
  );
}

export default function RootLayout() {
  const storeReady = useApp((s) => s.hydrated);
  const serverReady = useServer((s) => s.ready);
  const hydrated = storeReady && serverReady;
  const lang = useApp((s) => s.lang);

  useEffect(() => {
    if (!hydrated) return;
    SplashScreen.hideAsync().catch(() => {});
    refreshMe();
  }, [hydrated]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = lang;
  }, [lang]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="success/[id]" options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack>
      <ToastHost />
      <ServerSheetHost />
    </GestureHandlerRootView>
  );
}
