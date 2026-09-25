import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { SupplierProduct } from '@taptym/shared';
import { Screen } from '@/components/Screen';
import { LoadError } from '@/components/LoadError';
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
  // Re-init the form only when switching to another product (not on every refetch).
  const pid = p?.offerId ?? null;
  const [formFor, setFormFor] = useState<number | null>(null);
  if (pid !== formFor) {
    setFormFor(pid);
    setV(p ? fromProduct(p) : null);
  }

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
      <LoadError error={error} onRetry={reload} compact={!!data} />
      {!data ? (error ? null : <SkeletonList n={3} h={160} />) : !p ? <ErrorBox text={t('err_not_found')} /> : v ? <ProductForm key={p.offerId} value={v} onChange={setV} mode="edit" /> : null}
    </Screen>
  );
}
