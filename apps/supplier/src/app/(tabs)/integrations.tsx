import { useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Screen } from '@/components/Screen';
import { Button, Card, Field, IconBtn, Notice, Pill, Row, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { errorText, useT } from '@/lib/useT';
import { confirm, toast } from '@/lib/overlay';
import { useLayout } from '@/lib/layout';

export default function Integrations() {
  const t = useT();
  const { wide } = useLayout();
  const me = useStore((s) => s.me);
  const apiUrl = useStore((s) => s.apiUrl);
  const [ms, setMs] = useState('');
  const [onec, setOnec] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const token = me?.integrations.apiToken ?? '';
  const base = apiUrl || (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://api.taptym.kg');

  const post = async (key: string, body: object, msg: string) => {
    setBusy(key);
    try {
      await api('/api/s/integrations', { body });
      await useStore.getState().loadMe();
      toast(msg);
    } catch (e) {
      toast(errorText(t, e), 'error');
    } finally {
      setBusy(null);
    }
  };
  const sync = async () => {
    setBusy('sync');
    try {
      const r = await api<{ fetched: number; updated: number }>('/api/s/integrations/sync', { method: 'POST' });
      toast(t('sync_done', { f: r.fetched, u: r.updated }));
    } catch (e) {
      toast(errorText(t, e), 'error');
    } finally {
      setBusy(null);
    }
  };
  const copy = async (s: string) => {
    await Clipboard.setStringAsync(s);
    toast(t('copied'));
  };

  const curlGet = `curl -H "X-Api-Token: ${token || 'TOKEN'}" \\\n  ${base}/api/ext/v1/offers`;
  const curlPut = `curl -X PUT -H "X-Api-Token: ${token || 'TOKEN'}" \\\n  -H "Content-Type: application/json" \\\n  -d '[{"sku":"A-100","price":120,"stock":25},{"barcode":"4601234567890","stock":0}]' \\\n  ${base}/api/ext/v1/stock`;

  const moysklad = (
    <Card style={{ gap: 12 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={10}>
          <Text style={{ fontSize: 26 }}>🟦</Text>
          <Txt v="h3">МойСклад</Txt>
        </Row>
        <Pill tone={me?.integrations.moysklad ? 'success' : 'neutral'} label={me?.integrations.moysklad ? t('connected') : t('not_connected')} />
      </Row>
      <Txt v="cap">{t('ms_hint')}</Txt>
      <Field label={t('ms_token')} value={ms} onChangeText={setMs} placeholder={me?.integrations.moysklad ? '••••••••' : 'a1b2c3…'} autoCapitalize="none" secureTextEntry />
      <Row gap={10} wrap>
        <Button title={t('save')} icon="save-outline" size="md" full={false} disabled={!ms.trim()} loading={busy === 'ms'} onPress={() => post('ms', { moyskladToken: ms.trim() }, t('saved')).then(() => setMs(''))} />
        <Button title={t('sync_now')} icon="sync-outline" kind="secondary" size="md" full={false} loading={busy === 'sync'} disabled={!me?.integrations.moysklad} onPress={sync} testID="ms-sync" />
        {me?.integrations.moysklad ? <Button title={t('disconnect')} kind="ghost" size="md" full={false} onPress={() => post('ms-off', { moyskladToken: '' }, t('disconnected'))} /> : null}
      </Row>
    </Card>
  );

  const onecCard = (
    <Card style={{ gap: 12 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={10}>
          <Text style={{ fontSize: 26 }}>🟨</Text>
          <Txt v="h3">1С</Txt>
        </Row>
        <Pill tone={me?.integrations.onec ? 'success' : 'neutral'} label={me?.integrations.onec ? t('connected') : t('not_connected')} />
      </Row>
      <Txt v="cap">{t('onec_hint')}</Txt>
      <Field label={t('onec_url')} value={onec} onChangeText={setOnec} placeholder="https://1c.myshop.kg/odata" autoCapitalize="none" keyboardType="url" />
      <Button title={t('save')} icon="save-outline" size="md" full={false} disabled={!onec.trim()} loading={busy === '1c'} onPress={() => post('1c', { onecUrl: onec.trim() }, t('saved')).then(() => setOnec(''))} />
    </Card>
  );

  const apiCard = (
    <Card style={{ gap: 12 }}>
      <Row gap={10}>
        <Text style={{ fontSize: 26 }}>🔑</Text>
        <Txt v="h3">{t('api_title')}</Txt>
      </Row>
      <Txt v="cap">{t('api_hint')}</Txt>
      {token ? (
        <>
          <Row gap={8} style={{ backgroundColor: C.bg, borderRadius: 14, padding: 10 }}>
            <Text selectable style={{ flex: 1, fontFamily: Platform.select({ web: 'ui-monospace, monospace', default: 'monospace' }), fontSize: 14, color: C.ink }} numberOfLines={1} testID="api-token">
              {show ? token : token.slice(0, 5) + '••••••••••••' + token.slice(-4)}
            </Text>
            <IconBtn icon={show ? 'eye-off-outline' : 'eye-outline'} label={t('show')} size={36} onPress={() => setShow(!show)} />
            <IconBtn icon="copy-outline" label={t('copy')} size={36} onPress={() => copy(token)} />
          </Row>
          <Button
            title={t('regenerate')}
            icon="refresh"
            kind="ghost"
            size="md"
            full={false}
            loading={busy === 'regen'}
            onPress={async () => {
              if (await confirm({ title: t('regenerate_q'), message: t('regenerate_msg'), confirmText: t('regenerate'), danger: true })) void post('regen', { regenerateToken: true }, t('token_new'));
            }}
          />
        </>
      ) : (
        <Notice text={t('api_owner_only')} />
      )}
      <Txt v="capB">{t('api_get')}</Txt>
      <Code text={curlGet} onCopy={() => copy(curlGet)} />
      <Txt v="capB">{t('api_put')}</Txt>
      <Code text={curlPut} onCopy={() => copy(curlPut)} />
      <Txt v="cap">{t('api_put_hint')}</Txt>
    </Card>
  );

  return (
    <Screen back="/more" detail title={t('m_integrations')} subtitle={t('integrations_sub')}>
      {wide ? (
        <Row gap={16} style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 16 }}>
            {moysklad}
            {onecCard}
          </View>
          <View style={{ flex: 1.3, gap: 16 }}>{apiCard}</View>
        </Row>
      ) : (
        <>
          {moysklad}
          {onecCard}
          {apiCard}
        </>
      )}
    </Screen>
  );
}

function Code({ text, onCopy }: { text: string; onCopy: () => void }) {
  return (
    <View style={{ backgroundColor: '#0F1222', borderRadius: 16, padding: 14, gap: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text selectable style={{ color: '#D6D9FF', fontFamily: Platform.select({ web: 'ui-monospace, monospace', default: 'monospace' }), fontSize: 12.5, lineHeight: 19 }}>
          {text}
        </Text>
      </ScrollView>
      <View style={{ alignSelf: 'flex-end' }}>
        <IconBtn icon="copy-outline" label="copy" size={34} bg="rgba(255,255,255,0.12)" color="#fff" onPress={onCopy} />
      </View>
    </View>
  );
}
