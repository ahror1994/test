import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, ErrorState, Header, Row, Screen, Skeleton, Txt } from '@/components/ui';
import { useT } from '@/i18n';
import { addSchoolList } from '@/lib/actions';
import { useQuery } from '@/lib/api';
import { toast } from '@/lib/store';
import { C, R } from '@/lib/theme';

type List = { id: string; title: string; emoji: string; items: { query: string; qty: number }[] };

export default function SchoolScreen() {
  const t = useT();
  const q = useQuery<List[]>('/school-lists');
  const [busy, setBusy] = useState<string | null>(null);
  const add = async (id: string) => {
    setBusy(id);
    const r = await addSchoolList(id);
    setBusy(null);
    if (r?.missing.length) toast(t('missing_items', { list: r.missing.join(', ') }));
    if (r) router.navigate('/cart');
  };
  return (
    <Screen header={<Header title={t('school_title')} />} refreshing={q.refreshing} onRefresh={q.refresh}>
      <Txt v="h1">🎒 {t('back_to_school')}</Txt>
      <Txt v="body" color={C.muted} style={{ marginTop: 4, marginBottom: 16 }}>
        {t('school_sub')}
      </Txt>
      {q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.refresh} />
      ) : !q.data ? (
        <Skeleton h={300} r={R.xxl} />
      ) : (
        <View style={{ gap: 14 }}>
          {q.data.map((l) => (
            <Card key={l.id} pad={18} style={{ borderRadius: R.xxl }}>
              <Row gap={12}>
                <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 30 }}>{l.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Txt v="h3">{l.title}</Txt>
                  <Txt v="small">{t('items_count', { n: l.items.length })}</Txt>
                </View>
              </Row>
              <View style={{ marginTop: 12, gap: 6 }}>
                {l.items.map((it) => (
                  <Row key={it.query} style={{ justifyContent: 'space-between' }}>
                    <Txt v="body" style={{ flex: 1 }}>
                      • {it.query}
                    </Txt>
                    <Txt v="bodyBold" color={C.muted}>
                      × {it.qty}
                    </Txt>
                  </Row>
                ))}
              </View>
              <Button title={t('add_all_cheapest')} icon="flash" onPress={() => add(l.id)} loading={busy === l.id} disabled={!!busy && busy !== l.id} style={{ marginTop: 14 }} />
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
