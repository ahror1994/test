import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, MAX_W } from '@/lib/theme';
import { useLayout } from '@/lib/layout';
import { goBack } from '@/lib/nav';
import { IconBtn, Txt } from './ui';
import { useT } from '@/lib/useT';

type Props = {
  title?: string;
  subtitle?: string;
  back?: string; // fallback route when there is no history
  right?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
  scroll?: boolean;
  /** Hidden (detail) routes have no bottom tab bar on phones, so they need the bottom inset. */
  detail?: boolean;
  maxWidth?: number;
  header?: ReactNode;
};

export function Screen({ title, subtitle, back, right, children, refreshing, onRefresh, footer, scroll = true, detail, maxWidth = MAX_W, header }: Props) {
  const insets = useSafeAreaInsets();
  const { wide } = useLayout();
  const t = useT();
  const padX = wide ? 32 : 16;
  const bottomInset = detail && !wide ? insets.bottom : 0;

  const head = (
    <View style={[s.head, { paddingHorizontal: padX, paddingTop: (wide ? 28 : 10) + (wide ? 0 : insets.top) }]}>
      <View style={[s.inner, { maxWidth, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
        {back ? <IconBtn icon="arrow-back" label={t('back')} onPress={() => goBack(back)} /> : null}
        <View style={{ flex: 1 }}>
          {title ? (
            <Txt v={wide ? 'h1' : back ? 'h2' : 'h1'} numberOfLines={2}>
              {title}
            </Txt>
          ) : null}
          {subtitle ? (
            <Txt v="cap" numberOfLines={2}>
              {subtitle}
            </Txt>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );

  const body = (
    <View style={[s.inner, { maxWidth, gap: 16 }, !scroll && { flex: 1 }]}>
      {header}
      {children}
    </View>
  );

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {title || back || right ? head : <View style={{ height: wide ? 0 : insets.top }} />}
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: padX, paddingTop: 14, paddingBottom: 40 + bottomInset }}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} /> : undefined}
        >
          {body}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: padX, paddingTop: 14 }}>{body}</View>
      )}
      {footer ? (
        <View style={[s.footer, { paddingHorizontal: padX, paddingBottom: 12 + bottomInset }]}>
          <View style={[s.inner, { maxWidth }]}>{footer}</View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  head: { backgroundColor: C.bg, paddingBottom: 6 },
  inner: { width: '100%', alignSelf: 'center' },
  footer: { paddingTop: 12, backgroundColor: 'rgba(244,245,249,0.96)', borderTopWidth: 1, borderTopColor: C.line },
});
