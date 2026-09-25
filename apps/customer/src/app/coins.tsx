import { Text, View } from 'react-native';
import { formatDate } from '@taptym/shared';
import { AuthGate } from '@/components/auth-gate';
import { Card, Divider, Empty, Header, price, Row, Screen, Section, Skeleton, Txt } from '@/components/ui';
import { useT, type TKey } from '@/i18n';
import { useQuery } from '@/lib/api';
import { C, gradient, R } from '@/lib/theme';

type Coins = {
  balance: number;
  history: { id: number; amount: number; reason: string; orderId: number | null; createdAt: string }[];
  rules: { referralBonusCoins: number; coinsMaxPercent: number };
};

export default function CoinsScreen() {
  const t = useT();
  return (
    <AuthGate title={t('coins')}>
      <CoinsInner />
    </AuthGate>
  );
}

function CoinsInner() {
  const t = useT();
  const q = useQuery<Coins>('/coins', { auth: true });
  const d = q.data;
  const rules = [
    ['🛒', t('coins_rule1')],
    ['💱', t('coins_rule2')],
    ['✂️', t('coins_rule3')],
    ['🤝', t('coins_rule4', { n: d?.rules.referralBonusCoins ?? 100 })],
  ];
  return (
    <Screen header={<Header title={t('coins')} />} refreshing={q.refreshing} onRefresh={q.refresh}>
      <View style={[{ borderRadius: R.xxl, padding: 22, alignItems: 'center' }, gradient('linear-gradient(135deg, #FFD84D 0%, #FFB300 100%)', C.accent)]}>
        <Text style={{ fontSize: 56 }}>🪙</Text>
        {d ? <Txt v="display">{t('coins_balance', { n: d.balance })}</Txt> : <Skeleton h={36} w={160} />}
        <Txt v="bodyBold" color={C.accentInk} style={{ marginTop: 4 }}>
          {t('coins_eq', { x: price(d?.balance ?? 0) })}
        </Txt>
      </View>
      <Section title={t('how_it_works')}>
        <Card pad={6} style={{ borderRadius: R.xxl }}>
          {rules.map(([e, text], i) => (
            <View key={i}>
              {i > 0 ? <Divider style={{ marginLeft: 62 }} /> : null}
              <Row gap={14} style={{ padding: 12 }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 20 }}>{e}</Text>
                </View>
                <Txt v="bodyBold" style={{ flex: 1 }}>
                  {text}
                </Txt>
              </Row>
            </View>
          ))}
        </Card>
      </Section>
      <Section title={t('coins_history')}>
        {!d ? (
          <Skeleton h={160} r={R.xxl} />
        ) : d.history.length === 0 ? (
          <Empty emoji="🪙" title={t('coins_balance', { n: 0 })} />
        ) : (
          <Card pad={4} style={{ borderRadius: R.xxl }}>
            {d.history.map((h, i) => (
              <View key={h.id}>
                {i > 0 ? <Divider style={{ marginHorizontal: 12 }} /> : null}
                <Row style={{ padding: 12, justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Txt v="bodyBold">{t(`cr_${h.reason}` as TKey)}</Txt>
                    <Txt v="small">{formatDate(h.createdAt)}</Txt>
                  </View>
                  <Txt v="h3" color={h.amount >= 0 ? C.successInk : C.ink}>
                    {h.amount >= 0 ? `+${h.amount}` : `−${Math.abs(h.amount)}`}
                  </Txt>
                </Row>
              </View>
            ))}
          </Card>
        )}
      </Section>
    </Screen>
  );
}
