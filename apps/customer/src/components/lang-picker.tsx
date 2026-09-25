import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LANGS } from '@taptym/shared';
import { setLanguage } from '@/lib/actions';
import { haptic } from '@/lib/haptics';
import { useApp } from '@/lib/store';
import { C, R } from '@/lib/theme';

export function LangPicker({ compact }: { compact?: boolean }) {
  const lang = useApp((s) => s.lang);
  return (
    <View style={s.wrap}>
      {LANGS.map((l) => {
        const on = l.code === lang;
        return (
          <Pressable
            key={l.code}
            onPress={() => {
              haptic.select();
              setLanguage(l.code);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={({ pressed }) => [s.item, compact && { flexBasis: '40%', minHeight: 46 }, on && s.on, pressed && { opacity: 0.8 }]}
          >
            <Text style={{ fontSize: compact ? 16 : 20 }}>{l.flag}</Text>
            <Text style={[s.text, on && { color: C.primary }]} numberOfLines={1}>
              {l.native}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item: { flexGrow: 1, flexBasis: 120, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, borderRadius: R.lg, backgroundColor: C.white, borderWidth: 2, borderColor: C.line, paddingHorizontal: 10 },
  on: { borderColor: C.primary, backgroundColor: C.primarySoft },
  text: { fontSize: 14, fontWeight: '700', color: C.ink },
});
