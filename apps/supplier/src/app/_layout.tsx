import { useEffect } from 'react';
import { Platform } from 'react-native';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { OverlayHost } from '@/components/Overlay';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

void SplashScreen.preventAutoHideAsync().catch(() => {});

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `html,body{background:${C.bg};-webkit-tap-highlight-color:transparent}
input,textarea{font-family:inherit}
*::-webkit-scrollbar{width:10px;height:10px}*::-webkit-scrollbar-thumb{background:#D5D8E3;border-radius:8px;border:2px solid ${C.bg}}`;
  document.head.appendChild(style);
}

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: C.bg, primary: C.primary, card: C.card, text: C.ink, border: C.line } };

export default function RootLayout() {
  const hydrate = useStore((s) => s.hydrate);
  useEffect(() => {
    void hydrate().finally(() => void SplashScreen.hideAsync().catch(() => {}));
  }, [hydrate]);
  return (
    <ThemeProvider value={theme}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
      </Stack>
      <OverlayHost />
    </ThemeProvider>
  );
}

