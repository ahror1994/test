import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { SupplierProduct } from '@taptym/shared';
import { Screen } from '@/components/Screen';
import { fromProduct, ProductForm, toBody, type ProductFormValue } from '@/components/ProductForm';
import { Button, ErrorBox, SkeletonList } from '@/components/ui';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { errorText, useT } from '@/lib/useT';
import { confirm, toast } from '@/lib/overlay';
import { useLayout } from '@/lib/layout';

export default function EditProduct() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const { wide } = useLayout();
  const { data, error, reload } = useApi<{ items: SupplierProduct[] }>('/api/s/products');
  const p = data?.items.find((x) => String(x.offerId) === id);
  const [v, setV] = useState<ProductFormValue | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setV(p ? fromProduct(p) : null);
    // Re-init only when switching to another product.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.offerId]);

  const save = async () => {
    if (!v || !p) return;
    setBusy(true);
    try {
      // Video URL is not part of the offer payload, so only send it when the user typed one.
      const { productId: _ignored, videoUrl, ...body } = toBody(v);
      await api(`/api/s/products/${p.offerId}`, { method: 'PATCH', body: { ...body, ...(videoUrl ? { videoUrl } : {}), active: v.active } });
      toast(t('saved'));
      void reload();
      router.navigate('/products');
    } catch (e) {
      toast(errorText(t, e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!p) return;
    if (!(await confirm({ title: t('delete_product_q'), message: p.title, confirmText: t('delete'), danger: true }))) return;
    try {
      await api(`/api/s/products/${p.offerId}`, { method: 'DELETE' });
      toast(t('deleted'));
      router.navigate('/products');
    } catch (e) {
      toast(errorText(t, e), 'error');
    }
  };

  return (
    <Screen
      back="/products"
      detail
      title={p?.title ?? t('edit_product')}
      subtitle={t('edit_product')}
      footer={
        v ? (
          <View style={{ flexDirection: wide ? 'row-reverse' : 'column', gap: 10 }}>
            <Button title={t('save')} icon="checkmark" onPress={save} loading={busy} disabled={!Number(v.price)} style={wide ? { flex: 1 } : undefined} testID="pe-save" />
            <Button title={t('delete')} kind="danger" icon="trash-outline" size={wide ? 'lg' : 'md'} full={!wide} onPress={remove} />
          </View>
        ) : undefined
      }
    >
      {error ? <ErrorBox text={errorText(t, error)} onRetry={reload} retry={t('retry')} /> : null}
      {!data ? <SkeletonList n={3} h={160} /> : !p ? <ErrorBox text={t('err_not_found')} /> : v ? <ProductForm key={p.offerId} value={v} onChange={setV} mode="edit" /> : null}
    </Screen>
  );
}
