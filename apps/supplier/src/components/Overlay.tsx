import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOverlay } from '@/lib/overlay';
import { C, FONT, shadow } from '@/lib/theme';
import { useT } from '@/lib/useT';
import { Sheet } from './Sheet';
import { Button, Txt } from './ui';

export function OverlayHost() {
  const toast = useOverlay((s) => s.toast);
  const req = useOverlay((s) => s.confirmReq);
  const insets = useSafeAreaInsets();
  const t = useT();
  const color = toast?.kind === 'error' ? C.danger : toast?.kind === 'info' ? C.ink : C.success;
  return (
    <>
      {toast ? (
        <View pointerEvents="none" style={[s.toastWrap, { top: insets.top + 12 }]}>
          <View style={[s.toast, shadow.lift]} testID="toast">
            <View style={[s.toastIcon, { backgroundColor: color }]}>
              <Ionicons name={toast.kind === 'error' ? 'alert' : toast.kind === 'info' ? 'information' : 'checkmark'} size={16} color="#fff" />
            </View>
            <Text style={s.toastText}>{toast.text}</Text>
          </View>
        </View>
      ) : null}
      <Sheet
        open={!!req}
        onClose={() => req?.resolve(false)}
        title={req?.title ?? ''}
        width={440}
        footer={
          <>
            <Button title={req?.confirmText ?? t('confirm')} kind={req?.danger ? 'danger' : 'primary'} onPress={() => req?.resolve(true)} testID="confirm-ok" />
            <Button title={req?.cancelText ?? t('cancel')} kind="ghost" onPress={() => req?.resolve(false)} />
          </>
        }
      >
        {req?.message ? <Txt>{req.message}</Txt> : null}
      </Sheet>
    </>
  );
}

const s = StyleSheet.create({
  toastWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 1000, paddingHorizontal: 16 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, maxWidth: 480 },
  toastIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  toastText: { fontSize: 15, fontWeight: '700', color: C.ink, fontFamily: FONT, flexShrink: 1 },
});

