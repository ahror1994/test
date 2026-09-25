import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LANGS } from '@taptym/shared';
import { Screen } from '@/components/Screen';
import { Card, Divider, ListRow, Pill, Row, Txt } from '@/components/ui';
import { allowed, MORE_ITEMS } from '@/lib/nav';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { useT } from '@/lib/useT';
import { confirm, openServerSheet } from '@/lib/overlay';
import { SERVER_CONFIGURABLE } from '@/lib/api';
import { useLayout } from '@/lib/layout';
import type { TKey } from '../../i18n';

const HINTS: Record<string, TKey> = {
  promotion: 'mh_promotion',
  promos: 'mh_promos',
  reports: 'mh_reports',
  staff: 'mh_staff',
  reviews: 'mh_reviews',
  settings: 'mh_settings',
  integrations: 'mh_integrations',
  'support/index': 'mh_support',
  notifications: 'mh_notifications',
  language: 'mh_language',
};

export default function More() {
  const t = useT();
  const me = useStore((s) => s.me);
  const lang = useStore((s) => s.lang);
  const apiUrl = useStore((s) => s.apiUrl);
  const { cols } = useLayout();
  const perms = me?.permissions ?? [];
  const items = MORE_ITEMS.filter((x) => allowed(x, perms));
  const half = cols > 1 ? Math.ceil(items.length / 2) : items.length;
  const groups = cols > 1 ? [items.slice(0, half), items.slice(half)] : [items];

  return (
    <Screen title={t('tab_more')}>
      <Card style={s.profile}>
        <View style={[s.logo, { backgroundColor: me?.color ?? C.primarySoft }]}>
          <Text style={{ fontSize: 30 }}>{me?.logoEmoji ?? '🏪'}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt v="h2" numberOfLines={1}>
            {me?.name}
          </Txt>
          <Row gap={6} wrap>
            <Pill tone="primary" label={me ? t(`role_${me.myRole}` as TKey) : ''} icon="person-outline" />
            {me?.inTrial ? <Pill tone="success" label={t('trial')} icon="gift-outline" /> : null}
          </Row>
          <Txt v="cap">{me?.staffName}</Txt>
        </View>
      </Card>
      <View style={{ flexDirection: cols > 1 ? 'row' : 'column', gap: 16, alignItems: 'flex-start' }}>
        {groups.map((g, gi) => (
          <Card key={gi} pad={6} style={{ flex: cols > 1 ? 1 : undefined, alignSelf: 'stretch' }}>
            {g.map((x, i) => (
              <View key={x.route}>
                {i > 0 ? <Divider style={{ marginHorizontal: 14 }} /> : null}
                <ListRow
                  icon={x.iconOn}
                  title={t(x.label)}
                  subtitle={x.route === 'language' ? LANGS.find((l) => l.code === lang)?.native : t(HINTS[x.route])}
                  badge={x.route === 'notifications' ? me?.unread : undefined}
                  onPress={() => router.navigate(x.href as never)}
                />
              </View>
            ))}
          </Card>
        ))}
      </View>
      {SERVER_CONFIGURABLE ? (
        <Card pad={6}>
          <ListRow icon="server-outline" title={t('server')} subtitle={apiUrl.replace(/^https?:\/\//, '')} onPress={openServerSheet} />
        </Card>
      ) : null}
      <Card pad={6}>
        <ListRow
          icon="log-out-outline"
          danger
          title={t('logout')}
          chevron={false}
          onPress={async () => {
            if (await confirm({ title: t('logout_q'), confirmText: t('logout'), danger: true })) void useStore.getState().signOut();
          }}
        />
      </Card>
      <Txt v="cap" center>
        Taptym Бизнес · v1.0 · {t('support_phone')}
      </Txt>
    </Screen>
  );
}

const s = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
