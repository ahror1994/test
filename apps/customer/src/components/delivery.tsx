import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import type { QuoteGroup } from '@taptym/shared';
import { haptic } from '@/lib/haptics';
import { DELIVERY_ICON } from '@/lib/quote';
import { C, R } from '@/lib/theme';
import { useT, type TKey } from '@/i18n';
import { price, Txt } from './ui';

export function DeliveryPicker({ g, onPick }: { g: QuoteGroup; onPick: (m: QuoteGroup['deliveryMethod']) => void }) {
  const t = useT();
  return (
    <View style={s.wrap}>
      {g.deliveryOptions.map((o) => {
        const on = g.deliveryMethod === o.method;
        const eta = o.etaText === 'today' ? t('eta_today') : o.etaText === 'tomorrow' ? t('eta_tomorrow') : t('eta_pickup');
        return (
          <Pressable
            key={o.method}
            disabled={!o.available}
            onPress={() => {
              haptic.select();
              onPick(o.method);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled: !o.available }}
            style={({ pressed }) => [s.opt, on && s.optOn, !o.available && { opacity: 0.45 }, pressed && { opacity: 0.8 }]}
          >
            <View style={[s.icon, on && { backgroundColor: C.primary }]}>
              <Ionicons name={DELIVERY_ICON[o.method]} size={18} color={on ? C.white : C.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt v="bodyBold" lines={1} style={{ fontSize: 14 }}>
                {t(`dm_${o.method}` as TKey)}
              </Txt>
              <Txt v="small" lines={1} style={{ fontSize: 12 }}>
                {o.available ? eta : t('unavailable')}
              </Txt>
            </View>
            {o.available ? (
              <Txt v="bodyBold" color={o.fee === 0 ? C.successInk : C.ink} style={{ fontSize: 14 }}>
                {o.fee === 0 ? t('free') : price(o.fee)}
              </Txt>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt: { flexGrow: 1, flexBasis: 220, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: R.lg, borderWidth: 2, borderColor: C.line, backgroundColor: C.white, minHeight: 60 },
  optOn: { borderColor: C.primary, backgroundColor: '#FAF9FF' },
  icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
