import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '@/lib/theme';
import { useLayout } from '@/lib/layout';
import { IconBtn, Txt } from './ui';

/** Bottom sheet on phones, centered dialog on wide screens. */
export function Sheet({ open, onClose, title, subtitle, children, footer, width = 520 }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; width?: number }) {
  const { wide, height } = useLayout();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType={wide ? 'fade' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.backdrop, wide && { justifyContent: 'center', alignItems: 'center' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="close" />
        <View style={[s.sheet, wide ? { width, borderRadius: 28, maxHeight: height * 0.88 } : { maxHeight: height * 0.92, paddingBottom: insets.bottom }]}>
          {!wide ? <View style={s.grabber} /> : null}
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Txt v="h2">{title}</Txt>
              {subtitle ? <Txt v="cap">{subtitle}</Txt> : null}
            </View>
            <IconBtn icon="close" label="close" onPress={onClose} bg={C.bg} size={40} />
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 10 }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,18,34,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', width: '100%' },
  grabber: { width: 44, height: 5, borderRadius: 3, backgroundColor: C.line, alignSelf: 'center', marginTop: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
});
