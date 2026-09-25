import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BRAND } from '@taptym/shared';
import { Screen } from '@/components/Screen';
import { Button, Card, digits, Field, Row, SwitchRow, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { errorText, useT } from '@/lib/useT';
import { toast } from '@/lib/overlay';
import { useLayout } from '@/lib/layout';

const EMOJIS = ['🏪', '📚', '✏️', '🖊️', '📒', '🎒', '🖍️', '📐', '🎨', '🧮', '📦', '🛍️', '⭐', '🦉', '🌟', '🏫'];

export default function Settings() {
  const t = useT();
  const { wide } = useLayout();
  const me = useStore((s) => s.me);
  const [busy, setBusy] = useState(false);
  const init = () => ({
    name: me?.name ?? '',
    legalName: me?.legalName ?? '',
    inn: me?.inn ?? '',
    address: me?.address ?? '',
    workHours: me?.workHours ?? '',
    description: me?.description ?? '',
    logoEmoji: me?.logoEmoji ?? '🏪',
    ownDelivery: !!me?.ownDelivery,
    ownDeliveryFee: String(me?.ownDeliveryFee ?? 0),
    ownFreeFrom: String(me?.ownFreeFrom ?? 0),
    acceptsCash: !!me?.acceptsCash,
    payoutDetails: me?.payoutDetails ?? '',
  });
  const [f, setF] = useState(init);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setF(init()), [me?.id]);

  const save = async () => {
    if (!f.name.trim()) return toast(t('err_name_address'), 'error');
    setBusy(true);
    try {
      await api('/api/s/me', { method: 'PATCH', body: { ...f, ownDeliveryFee: Number(f.ownDeliveryFee) || 0, ownFreeFrom: Number(f.ownFreeFrom) || 0 } });
      await useStore.getState().loadMe();
      toast(t('saved'));
    } catch (e) {
      toast(errorText(t, e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const store = (
    <Card style={{ gap: 14 }}>
      <Txt v="h3">{t('st_store')}</Txt>
      <Txt v="capB">{t('logo')}</Txt>
      <Row gap={8} wrap>
        {EMOJIS.map((e) => (
          <Pressable key={e} onPress={() => setF({ ...f, logoEmoji: e })} style={{ width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: f.logoEmoji === e ? C.primarySoft : C.bg, borderWidth: 2, borderColor: f.logoEmoji === e ? C.primary : 'transparent' }} accessibilityLabel={e}>
            <Text style={{ fontSize: 24 }}>{e}</Text>
          </Pressable>
        ))}
      </Row>
      <Field label={t('store_name')} value={f.name} onChangeText={(x) => setF({ ...f, name: x })} testID="set-name" />
      <Field label={t('store_address')} value={f.address} onChangeText={(x) => setF({ ...f, address: x })} />
      <Field label={t('work_hours')} value={f.workHours} onChangeText={(x) => setF({ ...f, workHours: x })} placeholder="09:00–20:00" />
      <Field label={t('store_desc')} value={f.description} onChangeText={(x) => setF({ ...f, description: x })} multiline />
    </Card>
  );
  const legal = (
    <Card style={{ gap: 14 }}>
      <Txt v="h3">{t('st_legal')}</Txt>
      <Field label={t('legal_name')} value={f.legalName} onChangeText={(x) => setF({ ...f, legalName: x })} placeholder={t('legal_name_ph')} />
      <Field label={t('inn')} value={f.inn} onChangeText={(x) => setF({ ...f, inn: digits(x).slice(0, 14) })} keyboardType="number-pad" placeholder="01234567890123" />
      <Field label={t('payout_details')} value={f.payoutDetails} onChangeText={(x) => setF({ ...f, payoutDetails: x })} placeholder="MBank +996 555 000 001" />
    </Card>
  );
  const delivery = (
    <Card style={{ gap: 12 }}>
      <Txt v="h3">{t('st_delivery')}</Txt>
      <SwitchRow icon="bicycle-outline" label={t('own_delivery')} hint={t('own_delivery_hint')} value={f.ownDelivery} onChange={(v) => setF({ ...f, ownDelivery: v })} />
      {f.ownDelivery ? (
        <Row gap={10}>
          <Field style={{ flex: 1 }} label={t('delivery_fee')} value={f.ownDeliveryFee} onChangeText={(x) => setF({ ...f, ownDeliveryFee: digits(x) })} keyboardType="number-pad" suffix={BRAND.currency} />
          <Field style={{ flex: 1 }} label={t('free_from')} value={f.ownFreeFrom} onChangeText={(x) => setF({ ...f, ownFreeFrom: digits(x) })} keyboardType="number-pad" suffix={BRAND.currency} />
        </Row>
      ) : null}
      <SwitchRow icon="cash-outline" label={t('accept_cash')} hint={t('accept_cash_hint')} value={f.acceptsCash} onChange={(v) => setF({ ...f, acceptsCash: v })} />
    </Card>
  );
  return (
    <Screen back="/more" detail title={t('m_settings')} subtitle={t('settings_sub')} footer={<Button title={t('save')} icon="checkmark" onPress={save} loading={busy} testID="settings-save" />}>
      {wide ? (
        <Row gap={16} style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 16 }}>{store}</View>
          <View style={{ flex: 1, gap: 16 }}>
            {delivery}
            {legal}
          </View>
        </Row>
      ) : (
        <>
          {store}
          {delivery}
          {legal}
        </>
      )}
    </Screen>
  );
}
