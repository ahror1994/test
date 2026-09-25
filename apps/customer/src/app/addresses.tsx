import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AddressSheet } from '@/components/address-sheet';
import { AuthGate } from '@/components/auth-gate';
import { Button, Empty, Header, Row, Screen, Txt } from '@/components/ui';
import { errorText, useT } from '@/i18n';
import { refreshMe } from '@/lib/actions';
import { api } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { toast, useApp } from '@/lib/store';
import { C, R, shadow } from '@/lib/theme';

export default function AddressesScreen() {
  const t = useT();
  return (
    <AuthGate title={t('addresses')}>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const t = useT();
  const profile = useApp((s) => s.profile);
  const addressId = useApp((s) => s.addressId);
  const [sheet, setSheet] = useState(false);
  const list = profile?.addresses ?? [];
  const remove = async (id: number) => {
    try {
      await api(`/me/addresses/${id}`, { method: 'DELETE' });
      if (useApp.getState().addressId === id) useApp.getState().setAddressId(null);
      await refreshMe();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  };
  return (
    <Screen header={<Header title={t('addresses')} />} footer={<View style={{ padding: 16, maxWidth: 1100, width: '100%', alignSelf: 'center' }}><Button title={t('add_address')} icon="add" onPress={() => setSheet(true)} /></View>}>
      {list.length === 0 ? (
        <Empty emoji="📍" title={t('no_addresses')} />
      ) : (
        <View style={{ gap: 10 }}>
          {list.map((a) => {
            const on = a.id === addressId;
            return (
              <Pressable
                key={a.id}
                onPress={() => {
                  haptic.select();
                  useApp.getState().setAddressId(a.id);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: R.xl, padding: 14, borderWidth: 2, borderColor: on ? C.primary : 'transparent', ...shadow.sm }}
              >
                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={24} color={on ? C.primary : C.faint} />
                <View style={{ flex: 1 }}>
                  <Txt v="bodyBold">{a.label}</Txt>
                  <Txt v="small">{a.line}</Txt>
                </View>
                <Pressable onPress={() => remove(a.id)} hitSlop={8} style={{ alignItems: 'center', minWidth: 52, minHeight: 44, justifyContent: 'center' }} accessibilityLabel={t('delete')}>
                  <Ionicons name="trash-outline" size={20} color={C.danger} />
                  <Txt v="tiny" color={C.danger}>
                    {t('delete')}
                  </Txt>
                </Pressable>
              </Pressable>
            );
          })}
        </View>
      )}
      <Row style={{ height: 8 }}>{null}</Row>
      <AddressSheet visible={sheet} onClose={() => setSheet(false)} />
    </Screen>
  );
}
