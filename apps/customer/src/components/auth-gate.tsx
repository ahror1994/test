import { router, usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { useT } from '@/i18n';
import { useApp } from '@/lib/store';
import { Empty, Header, Screen } from './ui';

/** Renders children only for logged-in users; guests get a login prompt. */
export function AuthGate({ title, children }: { title?: string; children: ReactNode }) {
  const token = useApp((s) => s.token);
  const t = useT();
  const path = usePathname();
  if (token) return <>{children}</>;
  return (
    <Screen header={<Header title={title} />}>
      <Empty emoji="🔐" title={t('login_required')} sub={t('guest_sub')} action={t('login_btn')} icon="log-in-outline" onAction={() => router.push({ pathname: '/login', params: { next: path } })} />
    </Screen>
  );
}
