import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import type { CheckoutQuote } from '@taptym/shared';
import { C, R } from '@/lib/theme';
import { useT } from '@/i18n';
import { Card, Divider, price, Row, Txt } from './ui';

export function SummaryCard({ q }: { q: CheckoutQuote }) {
  const t = useT();
  const count = q.groups.reduce((a, g) => a + g.lines.reduce((b, l) => b + l.qty, 0), 0);
  const line = (label: string, value: string, color?: string) => (
    <Row style={{ justifyContent: 'space-between', minHeight: 28 }}>
      <Txt v="body" color={C.muted}>
        {label}
      </Txt>
      <Txt v="bodyBold" color={color}>
        {value}
      </Txt>
    </Row>
  );
  return (
    <Card pad={18} style={{ borderRadius: R.xxl }}>
      <Txt v="h2" style={{ marginBottom: 10 }}>
        {t('summary')}
      </Txt>
      {line(t('items_sum', { n: count }), price(q.itemsTotal))}
      {line(t('delivery'), q.deliveryTotal === 0 ? t('free') : price(q.deliveryTotal), q.deliveryTotal === 0 ? C.successInk : undefined)}
      {q.promoDiscount > 0 ? line(t('promo_code'), `−${price(q.promoDiscount)}`, C.successInk) : null}
      {q.coinsUsed > 0 ? line(t('coins_used'), `−${price(q.coinsUsed)}`, C.successInk) : null}
      <Divider style={{ marginVertical: 10 }} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="h3">{t('total')}</Txt>
        <Txt v="h1">{price(q.total)}</Txt>
      </Row>
      {q.savingsVsMax > 0 ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 12, backgroundColor: C.successSoft, borderRadius: R.md, padding: 12 }}>
          <Ionicons name="trending-down" size={20} color={C.successInk} />
          <Txt v="body" color={C.successInk} style={{ flex: 1, fontWeight: '700' }}>
            {t('you_save', { x: price(q.savingsVsMax) })}
          </Txt>
        </View>
      ) : null}
      {q.coinsToEarn > 0 ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8, backgroundColor: C.accentSoft, borderRadius: R.md, padding: 12 }}>
          <Txt v="body">🪙</Txt>
          <Txt v="body" color={C.accentInk} style={{ flex: 1, fontWeight: '700' }}>
            {t('coins_to_earn', { n: q.coinsToEarn })}
          </Txt>
        </View>
      ) : null}
    </Card>
  );
}
