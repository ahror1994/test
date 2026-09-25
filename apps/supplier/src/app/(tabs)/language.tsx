import { View } from 'react-native';
import { LANGS } from '@taptym/shared';
import { Screen } from '@/components/Screen';
import { Card, Divider, ListRow } from '@/components/ui';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { tr, useT } from '@/lib/useT';
import { toast } from '@/lib/overlay';
import { Ionicons } from '@expo/vector-icons';

export default function Language() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  return (
    <Screen back="/more" detail title={t('m_language')} subtitle={t('language_sub')}>
      <Card pad={6}>
        {LANGS.map((l, i) => (
          <View key={l.code}>
            {i > 0 ? <Divider style={{ marginHorizontal: 14 }} /> : null}
            <ListRow
              emoji={l.flag}
              iconBg={C.bg}
              title={l.native}
              subtitle={l.label}
              chevron={false}
              right={lang === l.code ? <Ionicons name="checkmark-circle" size={24} color={C.primary} /> : null}
              onPress={() => {
                setLang(l.code);
                toast(tr(l.code, 'lang_set'));
              }}
            />
          </View>
        ))}
      </Card>
    </Screen>
  );
}
