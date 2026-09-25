import { router } from 'expo-router';
import { Empty, Header, Screen } from '@/components/ui';
import { useT } from '@/i18n';

export default function NotFound() {
  const t = useT();
  return (
    <Screen header={<Header />}>
      <Empty emoji="🧭" title={t('err_not_found')} action={t('tab_home')} icon="home" onAction={() => router.replace('/')} />
    </Screen>
  );
}
