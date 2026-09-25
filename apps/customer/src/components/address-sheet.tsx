import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import type { Address } from '@taptym/shared';
import { errorText, useT } from '@/i18n';
import { refreshMe } from '@/lib/actions';
import { api, useQuery } from '@/lib/api';
import { toast, useApp } from '@/lib/store';
import { C, R } from '@/lib/theme';
import { Button, Chip, Field, Row, Sheet, Txt } from './ui';

type Preset = { id: string; label: string; line: string; lat: number; lng: number };

/** Add an address from GPS or a preset Osh district. */
export function AddressSheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved?: (a: Address) => void }) {
  const t = useT();
  const presets = useQuery<Preset[]>(visible ? '/locations' : null);
  const [label, setLabel] = useState('');
  const [line, setLine] = useState('');
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setLabel('');
      setLine('');
      setPos(null);
    }
  }, [visible]);

  const locate = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') throw new Error('denied');
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = p.coords.latitude;
      const lng = p.coords.longitude;
      setPos({ lat, lng });
      let text = '';
      if (Platform.OS !== 'web') {
        const [g] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }).catch(() => []);
        if (g) text = [g.city, g.street, g.streetNumber].filter(Boolean).join(', ');
      }
      setLine(text || `Ош, ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      if (!label) setLabel(t('my_location'));
      toast(t('location_found'), 'success');
    } catch {
      toast(t('location_denied'), 'error');
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    if (!pos || !line.trim()) return;
    setSaving(true);
    try {
      const a = await api<Address>('/me/addresses', { body: { label: label.trim() || t('address'), line: line.trim(), lat: pos.lat, lng: pos.lng } });
      await refreshMe();
      useApp.getState().setAddressId(a.id);
      toast(t('address_added'), 'success');
      onSaved?.(a);
      onClose();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('add_address')}
      footer={<Button title={t('save')} icon="checkmark" onPress={save} loading={saving} disabled={!pos || !line.trim()} />}
    >
      <Pressable onPress={locate} disabled={locating} style={({ pressed }) => [s.gps, pressed && { opacity: 0.85 }]}>
        <View style={s.gpsIcon}>{locating ? <ActivityIndicator color={C.white} /> : <Ionicons name="navigate" size={22} color={C.white} />}</View>
        <Txt v="h3" color={C.primary} style={{ flex: 1 }}>
          {locating ? t('locating') : t('my_location')}
        </Txt>
      </Pressable>
      <Txt v="bodyBold" style={{ marginTop: 18, marginBottom: 10 }}>
        {t('choose_district')}
      </Txt>
      <Row wrap gap={8}>
        {(presets.data ?? []).map((p) => (
          <Chip
            key={p.id}
            label={p.label}
            icon="location-outline"
            selected={pos?.lat === p.lat && pos?.lng === p.lng}
            onPress={() => {
              setPos({ lat: p.lat, lng: p.lng });
              setLine(p.line);
              if (!label) setLabel(p.label);
            }}
          />
        ))}
      </Row>
      <View style={{ gap: 12, marginTop: 18 }}>
        <Field label={t('address_line')} value={line} onChangeText={setLine} icon="home-outline" placeholder="Ош, ул. Ленина, 205, кв. 4" />
        <Field label={t('address_label')} value={label} onChangeText={setLabel} icon="bookmark-outline" placeholder="Дом" />
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  gps: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.primarySoft, borderRadius: R.xl, padding: 12, marginTop: 8 },
  gpsIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
});
