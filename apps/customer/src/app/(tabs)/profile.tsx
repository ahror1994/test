import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { formatPhone, type CustomerProfile } from '@taptym/shared';
import { LangPicker } from '@/components/lang-picker';
import { ServerRow } from '@/components/server-sheet';
import { Badge, Button, Card, Divider, Field, ListItem, price, Row, Screen, Section, TabTitle, Txt } from '@/components/ui';
import { errorText, useT } from '@/i18n';
import { api, useQuery } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { openServerSheet, SERVER_EDITABLE, useServer } from '@/lib/server';
import { toast, useApp } from '@/lib/store';
import { C, gradient, R, shadow } from '@/lib/theme';

type Coins = { balance: number; referralCode: string; invited: number; rules: { referralBonusCoins: number; referralFriendCoins: number } };

export default function ProfileScreen() {
  const t = useT();
  const token = useApp((s) => s.token);
  const profile = useApp((s) => s.profile);
  const unread = useApp((s) => s.unread);
  const server = useServer((s) => s.url);
  const coins = useQuery<Coins>('/coins', { auth: true, refetchOnFocus: true });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  if (!token || !profile) {
    return (
      <Screen header={<TabTitle title={t('tab_profile')} />}>
        <Card pad={20} style={{ borderRadius: R.xxl, alignItems: 'center', gap: 8 }}>
          <View style={s.avatarBig}>
            <Ionicons name="person" size={36} color={C.primary} />
          </View>
          <Txt v="h2">{t('guest')}</Txt>
          <Txt v="body" color={C.muted} center>
            {t('guest_sub')}
          </Txt>
          <Button title={t('login_btn')} icon="log-in-outline" onPress={() => router.push('/login')} style={{ alignSelf: 'stretch', marginTop: 8 }} />
        </Card>
        <Section title={t('language')}>
          <LangPicker />
        </Section>
        <ServerRow style={{ marginTop: 24 }} />
        <Txt v="small" center style={{ marginTop: 30 }}>
          {t('app_version')}
        </Txt>
      </Screen>
    );
  }

  const saveName = async () => {
    setSaving(true);
    try {
      const p = await api<CustomerProfile>('/me', { method: 'PATCH', body: { name: name.trim() } });
      useApp.getState().setProfile(p);
      setEditing(false);
      toast(t('name_saved'), 'success');
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const c = coins.data;
  const balance = c?.balance ?? profile.coins;
  const code = c?.referralCode ?? profile.referralCode;
  const shareText = t('share_text', { code, n: c?.rules.referralFriendCoins ?? 100 });
  const share = async () => {
    haptic.tap();
    try {
      await Share.share({ message: shareText });
    } catch {
      await Clipboard.setStringAsync(shareText);
      toast(t('copied'), 'success');
    }
  };
  const copy = async () => {
    await Clipboard.setStringAsync(code);
    haptic.success();
    toast(t('copied'), 'success');
  };

  return (
    <Screen header={<TabTitle title={t('tab_profile')} />} refreshing={coins.refreshing} onRefresh={coins.refresh}>
      <Card pad={18} style={{ borderRadius: R.xxl }}>
        {editing ? (
          <View style={{ gap: 10 }}>
            <Field label={t('your_name')} value={name} onChangeText={setName} autoFocus icon="person-outline" onSubmitEditing={saveName} />
            <Row gap={10}>
              <Button title={t('cancel')} v="secondary" size="md" onPress={() => setEditing(false)} style={{ flex: 1 }} />
              <Button title={t('save')} size="md" onPress={saveName} loading={saving} disabled={!name.trim()} style={{ flex: 1 }} />
            </Row>
          </View>
        ) : (
          <Row gap={14}>
            <View style={s.avatarBig}>
              <Text style={{ fontSize: 28, fontWeight: '800', color: C.primary }}>{(profile.name || '?').slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt v="h2" lines={1}>
                {profile.name || t('your_name')}
              </Txt>
              <Txt v="body" color={C.muted}>
                {formatPhone(profile.phone)}
              </Txt>
              {profile.isCompany && profile.companyName ? <Badge label={profile.companyName} icon="business" style={{ marginTop: 4 }} /> : null}
            </View>
            <Pressable
              onPress={() => {
                setName(profile.name);
                setEditing(true);
              }}
              style={s.editBtn}
              accessibilityLabel={t('your_name')}
            >
              <Ionicons name="pencil" size={18} color={C.primary} />
              <Text style={s.editText}>{t('edit')}</Text>
            </Pressable>
          </Row>
        )}
      </Card>

      <Pressable onPress={() => router.push('/coins')} style={({ pressed }) => [s.coins, gradient('linear-gradient(135deg, #6D4DFF 0%, #3A1FC9 100%)', C.primary), pressed && { opacity: 0.92 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.coinsLabel}>{t('coins')}</Text>
          <Text style={s.coinsValue}>{t('coins_balance', { n: balance })}</Text>
          <Text style={s.coinsSub}>{t('coins_eq', { x: price(balance) })}</Text>
          <Row gap={4} style={{ marginTop: 10 }}>
            <Text style={[s.coinsSub, { opacity: 1, fontWeight: '800' }]}>{t('how_it_works')}</Text>
            <Ionicons name="chevron-forward" size={14} color={C.white} />
          </Row>
        </View>
        <Text style={{ fontSize: 64 }}>🪙</Text>
      </Pressable>

      <Card pad={18} style={{ borderRadius: R.xxl, marginTop: 14 }}>
        <Row gap={12} style={{ alignItems: 'flex-start' }}>
          <Text style={{ fontSize: 32 }}>🎁</Text>
          <View style={{ flex: 1 }}>
            <Txt v="h3">{t('invite_friends')}</Txt>
            <Txt v="small">{t('invite_sub', { f: c?.rules.referralFriendCoins ?? 100, b: c?.rules.referralBonusCoins ?? 100 })}</Txt>
          </View>
        </Row>
        <Pressable onPress={copy} style={[s.code, { marginTop: 14 }]} accessibilityLabel={t('copy')}>
          <View style={{ flex: 1 }}>
            <Txt v="tiny" color={C.muted}>
              {t('your_code')}
            </Txt>
            <Text style={s.codeText}>{code}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Ionicons name="copy-outline" size={20} color={C.primary} />
            <Txt v="tiny" color={C.primary}>
              {t('copy')}
            </Txt>
          </View>
        </Pressable>
        <Button title={t('share')} icon="share-social" onPress={share} style={{ marginTop: 10 }} />
        <Txt v="small" style={{ marginTop: 10 }}>
          {t('invited_n', { n: c?.invited ?? 0 })}
        </Txt>
      </Card>

      <Card pad={0} style={{ borderRadius: R.xxl, marginTop: 14, overflow: 'hidden' }}>
        <ListItem icon="heart" iconBg="#FFE3EC" iconColor={C.danger} title={t('favorites')} onPress={() => router.push('/favorites')} />
        <Divider style={{ marginLeft: 70 }} />
        <ListItem icon="location" title={t('addresses')} sub={profile.addresses.map((a) => a.label).join(', ') || undefined} onPress={() => router.push('/addresses')} />
        <Divider style={{ marginLeft: 70 }} />
        <ListItem
          icon="notifications"
          iconBg={C.accentSoft}
          iconColor={C.accentInk}
          title={t('notifications')}
          onPress={() => router.push('/notifications')}
          right={unread ? <Badge label={String(unread)} color={C.white} bg={C.danger} /> : undefined}
        />
        <Divider style={{ marginLeft: 70 }} />
        <ListItem icon="chatbubbles" iconBg={C.successSoft} iconColor={C.successInk} title={t('support')} sub={t('support_sub')} onPress={() => router.push('/support')} />
        <Divider style={{ marginLeft: 70 }} />
        <ListItem icon="business" iconBg="#E7F0FF" iconColor="#1D5FD1" title={t('company')} sub={t('company_sub')} onPress={() => router.push('/company')} />
        {SERVER_EDITABLE ? (
          <>
            <Divider style={{ marginLeft: 70 }} />
            <ListItem icon="server-outline" iconBg={C.surface} iconColor={C.ink} title={t('server')} sub={server || t('server_not_set')} onPress={openServerSheet} />
          </>
        ) : null}
      </Card>

      <Section title={t('language')}>
        <LangPicker />
      </Section>

      <Card pad={0} style={{ borderRadius: R.xxl, marginTop: 24, overflow: 'hidden' }}>
        <ListItem icon="log-out-outline" title={t('logout')} danger onPress={() => useApp.getState().logout()} />
      </Card>
      <Txt v="small" center style={{ marginTop: 20 }}>
        {t('app_version')}
      </Txt>
    </Screen>
  );
}

const s = StyleSheet.create({
  avatarBig: { width: 64, height: 64, borderRadius: 24, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  editBtn: { alignItems: 'center', justifyContent: 'center', minWidth: 56, height: 52, borderRadius: 16, backgroundColor: C.primarySoft, paddingHorizontal: 8 },
  editText: { fontSize: 10, fontWeight: '700', color: C.primary, marginTop: 2 },
  coins: { marginTop: 14, borderRadius: R.xxl, padding: 20, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', ...shadow.primary },
  coinsLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '700' },
  coinsValue: { color: C.white, fontSize: 32, fontWeight: '800', letterSpacing: -1, marginTop: 2 },
  coinsSub: { color: C.white, opacity: 0.85, fontSize: 13, fontWeight: '600' },
  code: { flexDirection: 'row', alignItems: 'center', height: 60, borderRadius: R.lg, borderWidth: 2, borderColor: C.primary, borderStyle: 'dashed', paddingHorizontal: 14, backgroundColor: '#FAF9FF' },
  codeText: { fontSize: 20, fontWeight: '800', color: C.ink, letterSpacing: 2 },
});
