import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { CATEGORIES } from '@taptym/shared';
import { CatalogBlock } from '@/components/catalog';
import { Header, Screen, Txt } from '@/components/ui';
import { useT } from '@/i18n';
import { useApp } from '@/lib/store';
import { C, R } from '@/lib/theme';

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lang = useApp((s) => s.lang);
  const t = useT();
  const cat = CATEGORIES.find((c) => c.id === id);
  const name = cat ? (cat.name[lang] ?? cat.name.ru) : '';
  return (
    <Screen header={<Header title={name} />}>
      {cat ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: cat.color, borderRadius: R.xxl, padding: 18, marginBottom: 16 }}>
          <Text style={{ fontSize: 44 }}>{cat.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Txt v="h1">{name}</Txt>
            <Txt v="small" style={{ color: C.ink, opacity: 0.7 }}>
              {t('compare_prices')}
            </Txt>
          </View>
        </View>
      ) : null}
      <CatalogBlock
        base={{ category: id }}
        header={(m) =>
          m ? (
            <Txt v="small" style={{ marginTop: 12 }}>
              {t('found_n', { n: m.total })}
            </Txt>
          ) : null
        }
      />
    </Screen>
  );
}
