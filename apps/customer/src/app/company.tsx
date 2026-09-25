import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { CustomerProfile } from '@taptym/shared';
import { AuthGate } from '@/components/auth-gate';
import { BottomBar, Button, Card, Field, Header, Row, Screen, Toggle, Txt } from '@/components/ui';
import { errorText, useT } from '@/i18n';
import { api } from '@/lib/api';
import { toast, useApp } from '@/lib/store';
import { C, R } from '@/lib/theme';

export default function CompanyScreen() {
  const t = useT();
  return (
    <AuthGate title={t('company')}>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const t = useT();
  const profile = useApp((s) => s.profile);
  const [on, setOn] = useState(!!profile?.isCompany);
  const [name, setName] = useState(profile?.companyName ?? '');
  const [inn, setInn] = useState(profile?.companyInn ?? '');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setOn(!!profile?.isCompany);
  }, [profile?.isCompany]);
  const save = async () => {
    setBusy(true);
    try {
      const p = await api<CustomerProfile>('/me', { method: 'PATCH', body: { isCompany: on, companyName: name.trim() || null, companyInn: inn.trim() || null } });
      useApp.getState().setProfile(p);
      toast(t('saved'), 'success');
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen
      header={<Header title={t('company')} />}
      footer={
        <BottomBar>
          <Button title={t('save')} icon="checkmark" onPress={save} loading={busy} disabled={on && !name.trim()} style={{ flex: 1 }} />
        </BottomBar>
      }
    >
      <View style={{ maxWidth: 640, width: '100%', alignSelf: 'center', gap: 14 }}>
        <Card pad={16} style={{ borderRadius: R.xxl }}>
          <Pressable onPress={() => setOn(!on)}>
            <Row gap={12}>
              <View style={{ flex: 1 }}>
                <Txt v="h3">{t('company')}</Txt>
                <Txt v="small">{t('company_sub')}</Txt>
              </View>
              <Toggle value={on} onChange={setOn} />
            </Row>
          </Pressable>
        </Card>
        {on ? (
          <>
            <Field label={t('company_name')} value={name} onChangeText={setName} icon="business-outline" placeholder="ОсОО «Билим»" />
            <Field label={t('company_inn')} value={inn} onChangeText={(v) => setInn(v.replace(/\D/g, '').slice(0, 14))} icon="document-text-outline" keyboardType="number-pad" placeholder="01234567890123" />
            <Txt v="small" color={C.muted}>
              {t('pm_invoice')} · {t('pm_invoice_sub')}
            </Txt>
          </>
        ) : null}
      </View>
    </Screen>
  );
}
