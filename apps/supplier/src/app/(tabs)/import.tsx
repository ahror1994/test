import { useCallback, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { formatPrice } from '@taptym/shared';
import { Screen } from '@/components/Screen';
import { Button, Card, Divider, Field, Grid, Notice, Pill, Row, Stepper, Txt } from '@/components/ui';
import { downloadUrl, uploadFile, api, type PickedFile } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { C } from '@/lib/theme';
import { errorText, useT } from '@/lib/useT';
import { confirm, toast } from '@/lib/overlay';
import { useLayout } from '@/lib/layout';

type Row_ = { title: string; barcode: string | null; category: string; price: number; stock: number; action: 'create' | 'attach' | 'update' };
type Resp = { preview: boolean; total: number; create: number; attach: number; update: number; rows: Row_[] };

const MIME = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv', 'text/comma-separated-values'];

export default function Import() {
  const t = useT();
  const { wide } = useLayout();
  const [file, setFile] = useState<PickedFile | null>(null);
  const [preview, setPreview] = useState<Resp | null>(null);
  const [result, setResult] = useState<Resp | null>(null);
  const [busy, setBusy] = useState(false);
  const [hours, setHours] = useState(2);
  const [note, setNote] = useState('');
  const svc = useApi<{ catalog: { type: string; price: number }[] }>('/api/s/services');
  const rate = svc.data?.catalog.find((x) => x.type === 'catalog_upload')?.price ?? 300;

  useFocusEffect(
    useCallback(
      () => () => {
        setFile(null);
        setPreview(null);
        setResult(null);
      },
      [],
    ),
  );

  const template = () => {
    const url = downloadUrl('/api/s/products/template.csv');
    if (Platform.OS === 'web') window.open(url, '_blank');
    else void Linking.openURL(url);
  };

  const pick = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: Platform.OS === 'web' ? ['.xlsx', '.xls', '.csv', ...MIME] : MIME, copyToCacheDirectory: true });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    const f: PickedFile = { uri: a.uri, name: a.name, mimeType: a.mimeType, file: a.file ?? null };
    setFile(f);
    setResult(null);
    setBusy(true);
    try {
      setPreview(await uploadFile('/api/s/products/import?preview=1', f));
    } catch (e) {
      setPreview(null);
      toast(errorText(t, e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await uploadFile('/api/s/products/import', file);
      setResult(r);
      setPreview(null);
      toast(t('import_done', { n: r.total }));
    } catch (e) {
      toast(errorText(t, e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const buyUpload = async () => {
    const ok = await confirm({ title: t('cu_confirm', { h: hours }), message: t('cu_confirm_msg', { p: formatPrice(hours * rate) }), confirmText: t('order_service') });
    if (!ok) return;
    try {
      await api('/api/s/services', { body: { type: 'catalog_upload', hours, note } });
      toast(t('cu_ordered'));
      setNote('');
    } catch (e) {
      toast(errorText(t, e), 'error');
    }
  };

  const cols: [string, string, boolean][] = [
    ['Название', t('col_title'), true],
    ['Цена', t('col_price'), true],
    ['Остаток', t('col_stock'), false],
    ['Штрихкод', t('col_barcode'), false],
    ['Категория', t('col_category'), false],
    ['Бренд', t('col_brand'), false],
    ['Старая цена', t('col_old'), false],
    ['Опт цена / Опт от', t('col_wholesale'), false],
    ['Описание', t('col_desc'), false],
  ];
  const actTone = { create: 'primary', attach: 'info', update: 'success' } as const;
  const actLabel = { create: t('imp_create'), attach: t('imp_attach'), update: t('imp_update') };

  const steps = (
    <Card style={{ gap: 14 }}>
      <Txt v="h3">{t('imp_how')}</Txt>
      {[t('imp_s1'), t('imp_s2'), t('imp_s3')].map((x, i) => (
        <Row key={i} gap={12} style={{ alignItems: 'flex-start' }}>
          <View style={s.num}>
            <Txt v="bodyB" color={C.primary}>
              {i + 1}
            </Txt>
          </View>
          <Txt style={{ flex: 1, paddingTop: 4 }}>{x}</Txt>
        </Row>
      ))}
      <Row gap={10} wrap>
        <Button title={t('imp_template')} icon="download-outline" kind="secondary" onPress={template} full={false} testID="imp-template" />
        <Button title={file ? t('imp_pick_other') : t('imp_pick')} icon="folder-open-outline" onPress={pick} loading={busy && !preview} full={false} testID="imp-pick" />
      </Row>
      {file ? (
        <Row gap={8}>
          <Ionicons name="document-text" size={18} color={C.success} />
          <Txt v="bodyB" numberOfLines={1} style={{ flex: 1 }}>
            {file.name}
          </Txt>
        </Row>
      ) : null}
    </Card>
  );

  const columns = (
    <Card style={{ gap: 8 }}>
      <Txt v="h3">{t('imp_columns')}</Txt>
      <Txt v="cap">{t('imp_columns_hint')}</Txt>
      {cols.map(([name, desc, req]) => (
        <Row key={name} gap={10} style={{ paddingVertical: 6, alignItems: 'flex-start' }}>
          <View style={{ width: 140 }}>
            <Txt v="bodyB">
              {name}
              {req ? <Txt color={C.danger}> *</Txt> : null}
            </Txt>
          </View>
          <Txt v="cap" style={{ flex: 1 }}>
            {desc}
          </Txt>
        </Row>
      ))}
    </Card>
  );

  const shown = preview ?? result;
  const summary = shown ? (
    <Card style={{ gap: 14 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="h3">{result ? t('imp_result') : t('imp_preview')}</Txt>
        {result ? <Pill tone="success" icon="checkmark" label={t('imp_applied')} /> : <Pill tone="warning" label={t('imp_not_yet')} />}
      </Row>
      <Grid cols={wide ? 4 : 2} gap={10}>
        {[
          [t('imp_total'), shown.total, C.ink],
          [t('imp_create'), shown.create, C.primary],
          [t('imp_attach'), shown.attach, C.info],
          [t('imp_update'), shown.update, C.success],
        ].map(([l, n, c]) => (
          <View key={String(l)} style={s.count}>
            <Txt v="money" color={String(c)}>
              {String(n)}
            </Txt>
            <Txt v="cap">{String(l)}</Txt>
          </View>
        ))}
      </Grid>
      <Txt v="cap">{t('imp_attach_hint')}</Txt>
      <View>
        {shown.rows.slice(0, 10).map((r, i) => (
          <View key={i}>
            {i > 0 ? <Divider /> : null}
            <Row gap={10} style={{ paddingVertical: 10 }}>
              <View style={{ flex: 1 }}>
                <Txt v="bodyB" numberOfLines={1}>
                  {r.title}
                </Txt>
                <Txt v="cap">
                  {formatPrice(r.price)} · {t('stock')}: {r.stock}
                  {r.barcode ? ` · ${r.barcode}` : ''}
                </Txt>
              </View>
              <Pill tone={actTone[r.action]} label={actLabel[r.action]} />
            </Row>
          </View>
        ))}
      </View>
      {preview ? <Button title={t('imp_apply', { n: preview.total })} icon="cloud-upload-outline" onPress={apply} loading={busy} disabled={!preview.total} testID="imp-apply" /> : null}
      {result ? <Button title={t('imp_go_products')} icon="cube-outline" kind="secondary" onPress={() => router.navigate('/products')} /> : null}
    </Card>
  ) : null;

  const service = (
    <Card style={{ gap: 12 }} tint={C.primaryTint}>
      <Row gap={12}>
        <Txt style={{ fontSize: 34 }}>🧑‍💻</Txt>
        <View style={{ flex: 1 }}>
          <Txt v="h3">{t('cu_title')}</Txt>
          <Txt v="cap">{t('cu_sub', { p: formatPrice(rate) })}</Txt>
        </View>
      </Row>
      <Stepper label={t('cu_hours')} value={hours} onChange={(n) => setHours(Math.max(1, n))} min={1} />
      <Field label={t('cu_note')} value={note} onChangeText={setNote} placeholder={t('cu_note_ph')} />
      <Button title={t('cu_buy', { p: formatPrice(hours * rate) })} icon="hand-right-outline" kind="dark" onPress={buyUpload} testID="cu-buy" />
    </Card>
  );

  return (
    <Screen back="/products" detail title={t('imp_title')} subtitle={t('imp_sub')}>
      <Notice tone="primary" icon="bulb-outline" text={t('imp_tip')} />
      {wide ? (
        <Row gap={16} style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1.2, gap: 16 }}>
            {steps}
            {summary}
          </View>
          <View style={{ flex: 1, gap: 16 }}>
            {columns}
            {service}
          </View>
        </Row>
      ) : (
        <>
          {steps}
          {summary}
          {columns}
          {service}
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  num: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  count: { backgroundColor: C.bg, borderRadius: 18, padding: 14, gap: 2 },
});
