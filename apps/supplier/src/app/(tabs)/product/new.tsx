import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { emptyProduct, ProductForm, toBody } from '@/components/ProductForm';
import { Button } from '@/components/ui';
import { api } from '@/lib/api';
import { errorText, useT } from '@/lib/useT';
import { toast } from '@/lib/overlay';
import { useLayout } from '@/lib/layout';

export default function NewProduct() {
  const t = useT();
  const { wide } = useLayout();
  const [v, setV] = useState(emptyProduct);
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);
  // Tabs keep screens mounted: start with a clean form every time the screen is opened.
  useFocusEffect(
    useCallback(
      () => () => {
        setV(emptyProduct());
        setFormKey((k) => k + 1);
      },
      [],
    ),
  );

  const ok = Number(v.price) > 0 && (v.productId || v.title.trim().length >= 2);
  const save = async (again: boolean) => {
    if (!Number(v.price)) return toast(t('err_price_required'), 'error');
    if (!v.productId && v.title.trim().length < 2) return toast(t('err_title_required'), 'error');
    setBusy(true);
    try {
      const body = toBody(v);
      const p = await api<{ offerId: number; images: string[] }>('/api/s/products', { body });
      if (v.productId && v.images.length && !p.images.length) await api(`/api/s/products/${p.offerId}`, { method: 'PATCH', body: { images: v.images } }).catch(() => {});
      toast(t('product_added'));
      setV(emptyProduct());
      setFormKey((k) => k + 1);
      if (!again) router.navigate('/products');
    } catch (e) {
      toast(errorText(t, e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      back="/products"
      detail
      title={t('new_product')}
      subtitle={t('new_product_sub')}
      footer={
        <View style={{ flexDirection: wide ? 'row-reverse' : 'column', gap: 10 }}>
          <Button title={t('save')} icon="checkmark" onPress={() => save(false)} loading={busy} disabled={!ok} style={wide ? { flex: 1 } : undefined} testID="pf-save" />
          <Button title={t('save_and_more')} kind="secondary" size={wide ? 'lg' : 'md'} full={!wide} onPress={() => save(true)} disabled={!ok || busy} />
        </View>
      }
    >
      <ProductForm key={formKey} value={v} onChange={setV} mode="new" />
    </Screen>
  );
}
