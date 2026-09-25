import { router } from 'expo-router';
import type { ProductCard } from '@taptym/shared';
import { AuthGate } from '@/components/auth-gate';
import { GridSkeleton, ProductGrid } from '@/components/product';
import { Empty, ErrorState, Header, Screen } from '@/components/ui';
import { useT } from '@/i18n';
import { useQuery } from '@/lib/api';

export default function FavoritesScreen() {
  const t = useT();
  return (
    <AuthGate title={t('favorites')}>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const t = useT();
  const q = useQuery<ProductCard[]>('/favorites', { auth: true, refetchOnFocus: true });
  return (
    <Screen header={<Header title={t('favorites')} />} refreshing={q.refreshing} onRefresh={q.refresh}>
      {q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.refresh} />
      ) : !q.data ? (
        <GridSkeleton n={4} />
      ) : q.data.length === 0 ? (
        <Empty emoji="🤍" title={t('favorites')} sub={t('no_favorites')} action={t('to_shopping')} icon="search" onAction={() => router.navigate('/search')} />
      ) : (
        <ProductGrid items={q.data} />
      )}
    </Screen>
  );
}
