import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useT, type TFn } from '@/i18n';
import { refreshMe } from '@/lib/actions';
import { haptic } from '@/lib/haptics';
import {
  CHECK_TIMEOUT_S,
  checkServer,
  closeServerSheet,
  DEFAULT_SERVER_URL,
  normalizeServerUrl,
  openServerSheet,
  saveServerUrl,
  SERVER_EDITABLE,
  useServer,
  type ServerCheck,
} from '@/lib/server';
import { toast } from '@/lib/store';
import { C, R } from '@/lib/theme';
import { Button, Field, Row, Sheet, Txt } from './ui';

function failText(t: TFn, r: Extract<ServerCheck, { ok: false }>) {
  if (r.reason === 'bad_url') return t('server_bad_url');
  if (r.reason === 'timeout') return t('server_fail_timeout', { n: CHECK_TIMEOUT_S });
  if (r.reason === 'status') return t('server_fail_status', { code: r.status ?? 0 });
  if (r.reason === 'foreign') return t('server_fail_foreign');
  return t('server_fail_network');
}

/** Single app-wide sheet (native only), opened from login, profile and the offline state. */
export function ServerSheetHost() {
  const visible = useServer((s) => s.sheet);
  const opened = useServer((s) => s.opened);
  if (!SERVER_EDITABLE) return null;
  return <ServerSheet key={opened} visible={visible} />;
}

function ServerSheet({ visible }: { visible: boolean }) {
  const t = useT();
  const [text, setText] = useState(() => useServer.getState().url);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ServerCheck | null>(null);

  const check = async () => {
    const url = normalizeServerUrl(text);
    if (!url) {
      haptic.error();
      return setResult({ ok: false, reason: 'bad_url' });
    }
    setText(url);
    setResult(null);
    setChecking(true);
    const r = await checkServer(url);
    setChecking(false);
    setResult(r);
    if (r.ok) haptic.success();
    else haptic.error();
  };

  const save = async () => {
    const url = normalizeServerUrl(text);
    if (!url) {
      haptic.error();
      return setResult({ ok: false, reason: 'bad_url' });
    }
    const changed = url !== useServer.getState().url;
    await saveServerUrl(url);
    haptic.success();
    closeServerSheet();
    toast(t('server_saved'), 'success');
    if (changed) refreshMe();
  };

  return (
    <Sheet
      visible={visible}
      onClose={closeServerSheet}
      title={t('server_title')}
      footer={
        <Row gap={10}>
          <Button title={t('server_check')} v="secondary" icon="pulse" onPress={check} loading={checking} style={{ flex: 1 }} />
          <Button title={t('save')} icon="checkmark" onPress={save} style={{ flex: 1 }} />
        </Row>
      }
    >
      <Txt v="body" color={C.muted} style={{ marginBottom: 14 }}>
        {t('server_hint')}
      </Txt>
      <Field
        label={t('server_address')}
        value={text}
        onChangeText={(v) => {
          setText(v);
          setResult(null);
        }}
        icon="server-outline"
        placeholder="192.168.0.4:3000"
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        returnKeyType="done"
        onSubmitEditing={check}
        accessibilityLabel={t('server_address')}
      />
      {result ? (
        <View style={[s.result, result.ok ? s.ok : s.fail]}>
          <Text style={{ fontSize: 18 }}>{result.ok ? '✅' : '❌'}</Text>
          <Txt v="bodyBold" color={result.ok ? C.successInk : C.danger} style={{ flex: 1 }}>
            {result.ok ? t('server_ok') : failText(t, result)}
          </Txt>
        </View>
      ) : null}
      {DEFAULT_SERVER_URL && normalizeServerUrl(text) !== DEFAULT_SERVER_URL ? (
        <Pressable
          onPress={() => {
            haptic.tap();
            setText(DEFAULT_SERVER_URL);
            setResult(null);
          }}
          style={s.reset}
        >
          <Ionicons name="refresh" size={16} color={C.primary} />
          <Txt v="bodyBold" color={C.primary} style={{ flexShrink: 1 }}>
            {t('server_reset', { url: DEFAULT_SERVER_URL })}
          </Txt>
        </Pressable>
      ) : null}
    </Sheet>
  );
}

/** Compact «Сервер: url» row; renders nothing on web. */
export function ServerRow({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useT();
  const url = useServer((s) => s.url);
  if (!SERVER_EDITABLE) return null;
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        openServerSheet();
      }}
      accessibilityRole="button"
      accessibilityLabel={t('server_title')}
      style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }, style]}
    >
      <Ionicons name="server-outline" size={16} color={C.muted} />
      <Text style={s.rowText} numberOfLines={1}>
        {t('server_row', { url: url || t('server_not_set') })}
      </Text>
      <Ionicons name="create-outline" size={16} color={C.primary} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  result: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, borderRadius: R.lg, paddingHorizontal: 14, paddingVertical: 12 },
  ok: { backgroundColor: C.successSoft },
  fail: { backgroundColor: C.dangerSoft },
  reset: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, minHeight: 40, alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40, paddingHorizontal: 8, alignSelf: 'center', maxWidth: '100%' },
  rowText: { fontSize: 13, fontWeight: '600', color: C.muted, flexShrink: 1 },
});
