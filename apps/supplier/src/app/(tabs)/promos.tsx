import { useState } from 'react';
import { View } from 'react-native';
import { BRAND, formatDate, formatPrice, type PromoCode, type PromoType } from '@taptym/shared';
import { Screen } from '@/components/Screen';
import { LoadError } from '@/components/LoadError';
import { Sheet } from '@/components/Sheet';
import { Button, Card, Chip, digits, Divider, Empty, Field, Notice, Pill, Row, SkeletonList, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { C } from '@/lib/theme';
import { errorText, useT } from '@/lib/useT';
import { toast } from '@/lib/overlay';
import type { TKey } from '../../i18n';

const TONE = { active: 'success', pending: 'warning', rejected: 'danger', disabled: 'neutral' } as const;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function Promos() {
  const t = useT();
  const { data, error, loading, refreshing, refresh, reload } = useApi<PromoCode[]>('/api/s/promos');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const blank = () => ({ code: '', type: 'percent' as PromoType, value: '10', minTotal: '500', maxUses: '100', startsAt: iso(new Date()), endsAt: iso(new Date(Date.now() + 30 * 86400000)), description: '' });
  const [f, setF] = useState(blank);

  const value = (p: PromoCode) => (p.type === 'percent' ? `−${p.value}%` : p.type === 'fixed' ? `−${formatPrice(p.value)}` : t('free_delivery'));

  const submit = async () => {
    setBusy(true);
    try {
      await api('/api/s/promos', {
        body: {
          code: f.code,
          type: f.type,
          value: Number(f.value) || 0,
          minTotal: Number(f.minTotal) || 0,
          maxUses: Number(f.maxUses) || 100,
          startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null,
          endsAt: f.endsAt ? new Date(f.endsAt + 'T23:59:59').toISOString() : null,
          description: f.description,
        },
      });
      toast(t('promo_sent'));
      setOpen(false);
      setF(blank());
      void reload();
    } catch (e) {
      toast(errorText(t, e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      back="/more"
      detail
      title={t('m_promos')}
      subtitle={t('promos_sub')}
      refreshing={refreshing}
      onRefresh={refresh}
      footer={<Button title={t('promo_new')} icon="add-circle-outline" onPress={() => setOpen(true)} testID="promo-new" />}
    >
      <Notice icon="shield-checkmark-outline" text={t('promo_approval')} />
      <LoadError error={error} onRetry={reload} compact={!!data} />
      {!data && error ? null : loading ? (
        <SkeletonList n={3} />
      ) : (
        <Card pad={8}>
          {data?.length === 0 ? <Empty emoji="🏷️" title={t('no_promos')} text={t('no_promos_sub')} /> : null}
          {(data ?? []).map((p, i) => (
            <View key={p.id}>
              {i > 0 ? <Divider style={{ marginHorizontal: 12 }} /> : null}
              <View style={{ padding: 12, gap: 6 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row gap={10}>
                    <View style={{ backgroundColor: C.primarySoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Txt v="bodyB" color={C.primary} style={{ letterSpacing: 1 }}>
                        {p.code}
                      </Txt>
                    </View>
                    <Txt v="bodyB">{value(p)}</Txt>
                  </Row>
                  <Pill tone={TONE[p.status]} label={t(`pr_${p.status}` as TKey)} />
                </Row>
                <Txt v="cap">
                  {p.minTotal ? t('from_sum', { p: formatPrice(p.minTotal) }) + ' · ' : ''}
                  {t('used_of', { n: p.used, m: p.maxUses })}
                  {p.endsAt ? ' · ' + t('until', { d: formatDate(p.endsAt) }) : ''}
                </Txt>
                {p.description ? <Txt v="cap">{p.description}</Txt> : null}
              </View>
            </View>
          ))}
        </Card>
      )}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('promo_new')}
        subtitle={t('promo_approval_short')}
        footer={<Button title={t('send_to_approval')} icon="paper-plane" onPress={submit} loading={busy} disabled={f.code.replace(/[^A-Za-z0-9]/g, '').length < 4} testID="promo-submit" />}
      >
        <Field label={t('promo_code')} hint={t('promo_code_hint')} value={f.code} onChangeText={(x) => setF({ ...f, code: x.toUpperCase().replace(/[^A-Z0-9]/g, '') })} autoCapitalize="characters" placeholder="SCHOOL10" testID="promo-code" />
        <View style={{ gap: 8 }}>
          <Txt v="capB">{t('promo_type')}</Txt>
          <Row gap={8} wrap>
            <Chip label={t('pt_percent')} icon="trending-down" active={f.type === 'percent'} onPress={() => setF({ ...f, type: 'percent' })} />
            <Chip label={t('pt_fixed')} icon="cash-outline" active={f.type === 'fixed'} onPress={() => setF({ ...f, type: 'fixed' })} />
            <Chip label={t('free_delivery')} icon="bicycle-outline" active={f.type === 'free_delivery'} onPress={() => setF({ ...f, type: 'free_delivery' })} />
          </Row>
        </View>
        <Row gap={10}>
          {f.type !== 'free_delivery' ? (
            <Field style={{ flex: 1 }} label={t('promo_value')} value={f.value} onChangeText={(x) => setF({ ...f, value: digits(x) })} keyboardType="number-pad" suffix={f.type === 'percent' ? '%' : BRAND.currency} />
          ) : null}
          <Field style={{ flex: 1 }} label={t('min_total')} value={f.minTotal} onChangeText={(x) => setF({ ...f, minTotal: digits(x) })} keyboardType="number-pad" suffix={BRAND.currency} />
        </Row>
        <Field label={t('max_uses')} value={f.maxUses} onChangeText={(x) => setF({ ...f, maxUses: digits(x) })} keyboardType="number-pad" />
        <Row gap={10}>
          <Field style={{ flex: 1 }} label={t('date_from')} value={f.startsAt} onChangeText={(x) => setF({ ...f, startsAt: x })} placeholder="2026-09-01" />
          <Field style={{ flex: 1 }} label={t('date_to')} value={f.endsAt} onChangeText={(x) => setF({ ...f, endsAt: x })} placeholder="2026-09-30" />
        </Row>
        <Row gap={8} wrap>
          {[7, 14, 30].map((n) => (
            <Chip key={n} label={t('n_days', { n })} onPress={() => setF({ ...f, startsAt: iso(new Date()), endsAt: iso(new Date(Date.now() + n * 86400000)) })} />
          ))}
        </Row>
        <Field label={t('promo_desc')} value={f.description} onChangeText={(x) => setF({ ...f, description: x })} placeholder={t('promo_desc_ph')} multiline />
      </Sheet>
    </Screen>
  );
}
