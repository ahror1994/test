import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { checkServer, DEFAULT_API_URL, normalizeApiUrl, SERVER_CONFIGURABLE, type HealthResult } from '@/lib/api';
import { useStore } from '@/lib/store';
import { openServerSheet, toast, useOverlay } from '@/lib/overlay';
import { C, R } from '@/lib/theme';
import { useT } from '@/lib/useT';
import type { TKey } from '../i18n';
import { Sheet } from './Sheet';
import { Button, Field, Txt } from './ui';

const REASON: Record<Exclude<HealthResult, { ok: true }>['reason'], TKey> = {
  invalid: 'server_bad_invalid',
  timeout: 'server_bad_timeout',
  unreachable: 'server_bad_unreachable',
  not_taptym: 'server_bad_not_taptym',
  http: 'server_bad_http',
};

const bare = (u: string) => u.replace(/^https?:\/\//, '');

/** Where the native app sends every request: for now, the owner's computer on the Wi-Fi. */
export function ServerSheet() {
  const key = useOverlay((s) => s.serverSheetKey);
  if (!SERVER_CONFIGURABLE) return null;
  return <ServerSheetBody key={key} />;
}

function ServerSheetBody() {
  const t = useT();
  const open = useOverlay((s) => s.serverSheet);
  const current = useStore((s) => s.apiUrl);
  const [value, setValue] = useState(current);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<HealthResult | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => useOverlay.setState({ serverSheet: false });
  const normalized = normalizeApiUrl(value);

  const check = async () => {
    setChecking(true);
    setResult(null);
    setResult(await checkServer(value));
    setChecking(false);
  };

  const save = async () => {
    if (!normalized) return setResult({ ok: false, reason: 'invalid' });
    setBusy(true);
    try {
      await useStore.getState().setApiUrl(normalized);
      toast(t('server_saved'));
      close();
    } finally {
      setBusy(false);
    }
  };

  const bad = result && !result.ok ? result : null;
  return (
    <Sheet
      open={open}
      onClose={close}
      title={t('server_title')}
      subtitle={t('server_sub')}
      width={480}
      footer={
        <>
          <Button title={t('save')} icon="checkmark" onPress={save} loading={busy} disabled={!value.trim()} testID="server-save" />
          {normalized !== DEFAULT_API_URL ? <Button title={`${t('server_default')}: ${bare(DEFAULT_API_URL)}`} kind="ghost" size="md" onPress={() => setValue(DEFAULT_API_URL)} /> : null}
        </>
      }
    >
      <Field
        label={t('server_url')}
        value={value}
        onChangeText={(v) => {
          setValue(v);
          setResult(null);
        }}
        placeholder="192.168.0.4:3000"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="done"
        onSubmitEditing={check}
        hint={normalized && normalized !== value.trim() ? `→ ${normalized}` : undefined}
        testID="server-url"
      />
      <Txt v="cap">{t('server_hint')}</Txt>
      <Button title={t('server_check')} icon="pulse-outline" kind="secondary" size="md" full={false} onPress={check} loading={checking} disabled={!value.trim()} testID="server-check" />
      {result ? (
        <View style={[s.result, { backgroundColor: result.ok ? C.successSoft : C.dangerSoft }]} testID="server-result">
          <Txt v="bodyB">{result.ok ? '✅' : '❌'}</Txt>
          <Txt v="bodyB" color={result.ok ? '#067647' : C.danger} style={{ flex: 1 }}>
            {result.ok ? t('server_ok') : t(REASON[bad!.reason], { code: bad!.status ?? '' })}
          </Txt>
        </View>
      ) : null}
    </Sheet>
  );
}

/** «Сервер: 192.168.0.4:3000» row for the login screen (hidden on web). */
export function ServerRow() {
  const t = useT();
  const url = useStore((s) => s.apiUrl);
  if (!SERVER_CONFIGURABLE) return null;
  return (
    <Pressable onPress={openServerSheet} accessibilityRole="button" style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]} testID="server-row">
      <Ionicons name="server-outline" size={16} color={C.muted} />
      <Txt v="cap" numberOfLines={1} style={{ flexShrink: 1 }}>
        {t('server')}: <Txt v="capB">{bare(url)}</Txt>
      </Txt>
      <Ionicons name="create-outline" size={16} color={C.primary} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  result: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: R.md, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, paddingHorizontal: 12 },
});
