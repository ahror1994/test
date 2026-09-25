import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND, formatDateTime, formatPrice, type LedgerEntry, type LedgerType, type PayoutBreakdown, type PayoutStatus } from '@taptym/shared';
import { Screen } from '@/components/Screen';
import { LoadError } from '@/components/LoadError';
import { Sheet } from '@/components/Sheet';
import { Button, Card, Chip, digits, Divider, Empty, Field, IconName, Money, Notice, Pill, Row, Section, Skeleton, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useCan } from '@/lib/store';
import { C, shadow } from '@/lib/theme';
import { errorText, useT } from '@/lib/useT';
import { useLayout } from '@/lib/layout';
import { toast } from '@/lib/overlay';
import type { TKey } from '../../i18n';

type Payout = { id: number; amount: number; method: 'mbank' | 'bank_account' | 'cash'; details: string; status: PayoutStatus; comment: string; createdAt: string; processedAt: string | null };
type Resp = { breakdown: PayoutBreakdown; ledger: LedgerEntry[]; payouts: Payout[]; services: { name: string; amount: number }[]; payoutDetails: string; commissionPercent: number };

const BD: { k: keyof PayoutBreakdown; label: TKey; hint: TKey; icon: IconName }[] = [
  { k: 'sales', label: 'bd_sales', hint: 'bd_sales_h', icon: 'bag-check-outline' },
  { k: 'commission', label: 'bd_commission', hint: 'bd_commission_h', icon: 'pie-chart-outline' },
  { k: 'promotions', label: 'bd_promotions', hint: 'bd_promotions_h', icon: 'megaphone-outline' },
  { k: 'services', label: 'bd_services', hint: 'bd_services_h', icon: 'construct-outline' },
  { k: 'promoDiscounts', label: 'bd_promo', hint: 'bd_promo_h', icon: 'pricetag-outline' },
  { k: 'cashCollected', label: 'bd_cash', hint: 'bd_cash_h', icon: 'cash-outline' },
  { k: 'refunds', label: 'bd_refunds', hint: 'bd_refunds_h', icon: 'return-down-back-outline' },
  { k: 'adjustments', label: 'bd_adjust', hint: 'bd_adjust_h', icon: 'options-outline' },
  { k: 'paidOut', label: 'bd_paid', hint: 'bd_paid_h', icon: 'checkmark-done-outline' },
];

const LEDGER_ICON: Record<LedgerType, IconName> = {
  sale: 'bag-check-outline',
  commission: 'pie-chart-outline',
  promotion: 'megaphone-outline',
  service: 'construct-outline',
  payout: 'arrow-up-circle-outline',
  cash_collected: 'cash-outline',
  promo_discount: 'pricetag-outline',
  refund: 'return-down-back-outline',
  adjustment: 'options-outline',
};

const PAYOUT_TONE = { requested: 'warning', confirmed: 'info', paid: 'success', rejected: 'danger' } as const;

export default function Finance() {
  const t = useT();
  const can = useCan();
  const { wide } = useLayout();
  const { data, error, loading, refreshing, refresh, reload } = useApi<Resp>('/api/s/finance');
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<Payout['method']>('mbank');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState(false);

  const pending = data?.payouts.filter((p) => p.status === 'requested' || p.status === 'confirmed').reduce((a, p) => a + p.amount, 0) ?? 0;
  const free = Math.max(0, (data?.breakdown.available ?? 0) - pending);

  const openSheet = () => {
    setAmount(String(free));
    setDetails(data?.payoutDetails ?? '');
    setOpen(true);
  };
  const submit = async () => {
    setBusy(true);
    try {
      await api('/api/s/payouts', { body: { amount: Number(amount), method, details } });
      toast(t('payout_requested'));
      setOpen(false);
      void reload();
    } catch (e) {
      toast(errorText(t, e), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading || !data)
    return (
      <Screen title={t('tab_finance')}>
        <LoadError error={error} onRetry={reload} />
        {loading && !error ? (
          <View style={{ gap: 12 }}>
            <Skeleton h={180} r={28} />
            <Skeleton h={320} r={24} />
          </View>
        ) : null}
      </Screen>
    );

  const b = data.breakdown;
  const balance = (
    <View style={s.balance}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ gap: 4, flex: 1 }}>
          <Txt v="capB" color="rgba(255,255,255,0.75)">
            {t('available')}
          </Txt>
          <Money value={b.available} v="moneyL" color="#fff" />
          {pending ? (
            <Txt v="cap" color="rgba(255,255,255,0.8)">
              {t('in_payout_requests', { p: formatPrice(pending) })}
            </Txt>
          ) : null}
        </View>
        <View style={s.walletIcon}>
          <Ionicons name="wallet" size={26} color={C.ink} />
        </View>
      </Row>
      {can('finance') ? (
        <Button title={t('request_payout')} icon="flash" kind="light" onPress={openSheet} disabled={free <= 0} testID="request-payout" />
      ) : (
        <Txt v="cap" color="rgba(255,255,255,0.8)">
          {t('payout_owner_only')}
        </Txt>
      )}
      <Txt v="cap" color="rgba(255,255,255,0.75)">
        {t('instant_payouts')}
      </Txt>
    </View>
  );

  const breakdown = (
    <Section title={t('how_calculated')} icon="calculator-outline">
      <Card pad={8}>
        {BD.filter((x) => x.k === 'sales' || b[x.k] !== 0).map((x, i) => (
          <View key={x.k}>
            {i > 0 ? <Divider style={{ marginHorizontal: 12 }} /> : null}
            <Row gap={12} style={{ padding: 12, alignItems: 'flex-start' }}>
              <View style={s.tile}>
                <Ionicons name={x.icon} size={19} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="bodyB">{t(x.label)}</Txt>
                <Txt v="cap">{t(x.hint, { x: data.commissionPercent })}</Txt>
              </View>
              <Txt v="bodyB" color={b[x.k] > 0 ? C.success : b[x.k] < 0 ? C.ink : C.muted}>
                {b[x.k] > 0 ? '+' : ''}
                {formatPrice(b[x.k])}
              </Txt>
            </Row>
          </View>
        ))}
        <Divider style={{ marginHorizontal: 12 }} />
        <Row style={{ padding: 14, justifyContent: 'space-between' }}>
          <Txt v="h3">{t('available')}</Txt>
          <Txt v="money" color={C.primary}>
            {formatPrice(b.available)}
          </Txt>
        </Row>
      </Card>
    </Section>
  );

  const services = data.services.length ? (
    <Section title={t('paid_services')} icon="sparkles-outline">
      <Card pad={8}>
        {data.services.map((x, i) => (
          <Row key={i} style={{ padding: 12, justifyContent: 'space-between' }}>
            <Txt style={{ flex: 1 }}>{x.name}</Txt>
            <Txt v="bodyB">{x.amount ? formatPrice(x.amount) : t('free')}</Txt>
          </Row>
        ))}
      </Card>
    </Section>
  ) : null;

  const payouts = (
    <Section title={t('payouts_history')} icon="time-outline">
      <Card pad={8}>
        {data.payouts.length === 0 ? <Empty emoji="💸" title={t('no_payouts')} /> : null}
        {data.payouts.map((p, i) => (
          <View key={p.id}>
            {i > 0 ? <Divider style={{ marginHorizontal: 12 }} /> : null}
            <View style={{ padding: 12, gap: 6 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt v="h3">{formatPrice(p.amount)}</Txt>
                <Pill tone={PAYOUT_TONE[p.status]} label={t(`ps_${p.status}` as TKey)} />
              </Row>
              <Txt v="cap">
                {t(`pay_${p.method}` as TKey)} · {p.details} · {formatDateTime(p.createdAt)}
              </Txt>
              {p.comment ? <Txt v="cap">💬 {p.comment}</Txt> : null}
            </View>
          </View>
        ))}
      </Card>
    </Section>
  );

  const ledger = (
    <Section title={t('ledger')} icon="list-outline" action={data.ledger.length > 12 ? (all ? t('collapse') : t('show_all')) : undefined} onAction={() => setAll(!all)}>
      <Card pad={8}>
        {data.ledger.length === 0 ? <Empty emoji="🧾" title={t('no_ledger')} /> : null}
        {data.ledger.slice(0, all ? 200 : 12).map((l, i) => (
          <View key={l.id}>
            {i > 0 ? <Divider style={{ marginHorizontal: 12 }} /> : null}
            <Row gap={12} style={{ padding: 10 }}>
              <View style={[s.tile, { backgroundColor: l.amount >= 0 ? C.successSoft : C.bg }]}>
                <Ionicons name={LEDGER_ICON[l.type]} size={18} color={l.amount >= 0 ? C.success : C.ink2} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="bodyB" numberOfLines={2}>
                  {l.note}
                </Txt>
                <Txt v="cap">{formatDateTime(l.createdAt)}</Txt>
              </View>
              <Txt v="bodyB" color={l.amount >= 0 ? C.success : C.ink}>
                {l.amount > 0 ? '+' : ''}
                {formatPrice(l.amount)}
              </Txt>
            </Row>
          </View>
        ))}
      </Card>
    </Section>
  );

  return (
    <Screen title={t('tab_finance')} subtitle={t('finance_sub')} refreshing={refreshing} onRefresh={refresh}>
      <LoadError error={error} onRetry={reload} compact />
      {wide ? (
        <Row gap={16} style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 16 }}>
            {balance}
            {breakdown}
            {services}
          </View>
          <View style={{ flex: 1, gap: 16 }}>
            {payouts}
            {ledger}
          </View>
        </Row>
      ) : (
        <>
          {balance}
          {breakdown}
          {services}
          {payouts}
          {ledger}
        </>
      )}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('request_payout')}
        subtitle={t('available_x', { p: formatPrice(free) })}
        footer={<Button title={t('send_request')} icon="paper-plane" onPress={submit} loading={busy} disabled={!(Number(amount) > 0) || Number(amount) > free || !details.trim()} testID="payout-submit" />}
      >
        <Field big label={t('amount')} value={amount} onChangeText={(x) => setAmount(digits(x))} keyboardType="number-pad" suffix={BRAND.currency} error={Number(amount) > free ? t('err_insufficient') : undefined} testID="payout-amount" />
        <View style={{ gap: 8 }}>
          <Txt v="capB">{t('payout_method')}</Txt>
          <Row gap={8} wrap>
            <Chip label="MBank" icon="phone-portrait-outline" active={method === 'mbank'} onPress={() => setMethod('mbank')} />
            <Chip label={t('pay_bank_account')} icon="business-outline" active={method === 'bank_account'} onPress={() => setMethod('bank_account')} />
            <Chip label={t('pay_cash')} icon="cash-outline" active={method === 'cash'} onPress={() => setMethod('cash')} />
          </Row>
        </View>
        <Field label={t('payout_details')} value={details} onChangeText={setDetails} placeholder={method === 'mbank' ? 'MBank +996 555 000 001' : method === 'bank_account' ? t('bank_ph') : t('cash_ph')} />
        <Notice icon="call-outline" tone="warning" text={t('payout_call_note')} />
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  balance: { backgroundColor: C.primary, borderRadius: 28, padding: 22, gap: 16, ...shadow.primary },
  walletIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  tile: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
