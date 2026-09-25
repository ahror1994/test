import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BRAND, LANGS, normalizePhone } from '@taptym/shared';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import { C, FONT, shadow } from '@/lib/theme';
import { errorText, useT } from '@/lib/useT';
import { useLayout } from '@/lib/layout';
import { toast } from '@/lib/overlay';
import { Button, Card, Chip, digits, Field, Notice, Row, SwitchRow, Txt } from '@/components/ui';

type Step = 'phone' | 'code' | 'register' | 'welcome';
type Loc = { id: string; label: string; line: string; lat: number; lng: number };

function fmtLocal(d: string) {
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join(' ');
}

export default function Login() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { wide } = useLayout();
  const token = useStore((s) => s.token);
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  const signIn = useStore((s) => s.signIn);

  const [step, setStep] = useState<Step>('phone');
  const [local, setLocal] = useState('');
  const [code, setCode] = useState('');
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [pending, setPending] = useState<{ token: string; name: string } | null>(null);
  const [locs, setLocs] = useState<Loc[]>([]);
  const [reg, setReg] = useState({ name: '', ownerName: '', address: '', lat: 40.5283, lng: 72.7985, ownDelivery: false, fee: '150', freeFrom: '2000' });
  const codeRef = useRef<TextInput>(null);

  const phone = normalizePhone('996' + local);

  useEffect(() => {
    if (step === 'register' && !locs.length) void api<Loc[]>('/api/c/locations').then(setLocs).catch(() => {});
    if (step === 'code') setTimeout(() => codeRef.current?.focus(), 150);
  }, [step, locs.length]);

  // Already signed in (e.g. opened /login directly): go to the dashboard.
  useEffect(() => {
    if (token && !pending) router.replace('/');
  }, [token, pending]);

  const requestCode = async () => {
    if (local.length !== 9) return setErr(t('err_bad_phone'));
    setBusy(true);
    setErr('');
    try {
      const r = await api<{ demoCode: string | null }>('/api/s/auth/request-code', { body: { phone } });
      setDemoCode(r.demoCode);
      setCode('');
      setStep('code');
    } catch (e) {
      setErr(errorText(t, e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (c = code) => {
    if (c.length < 4) return;
    setBusy(true);
    setErr('');
    try {
      const r = await api<{ token?: string; needsRegistration?: boolean }>('/api/s/auth/verify', { body: { phone, code: c } });
      if (r.needsRegistration) setStep('register');
      else if (r.token) {
        await signIn(r.token);
        router.replace('/');
      }
    } catch (e) {
      setErr(errorText(t, e));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const register = async () => {
    if (!reg.name.trim() || !reg.address.trim()) return setErr(t('err_name_address'));
    setBusy(true);
    setErr('');
    try {
      const r = await api<{ token: string }>('/api/s/auth/register', {
        body: {
          phone,
          code,
          name: reg.name.trim(),
          ownerName: reg.ownerName.trim() || undefined,
          address: reg.address.trim(),
          lat: reg.lat,
          lng: reg.lng,
          ownDelivery: reg.ownDelivery,
          ownDeliveryFee: Number(reg.fee) || 0,
          ownFreeFrom: Number(reg.freeFrom) || 0,
        },
      });
      setPending({ token: r.token, name: reg.name.trim() });
      setStep('welcome');
    } catch (e) {
      setErr(errorText(t, e));
    } finally {
      setBusy(false);
    }
  };

  const finish = async (to: string) => {
    if (!pending) return;
    await signIn(pending.token);
    toast(t('welcome_toast'));
    router.replace(to as never);
  };

  const langBar = (
    <Row gap={8} wrap style={{ justifyContent: 'center' }}>
      {LANGS.map((l) => (
        <Chip key={l.code} label={l.native} emoji={l.flag} active={lang === l.code} onPress={() => setLang(l.code)} />
      ))}
    </Row>
  );

  let content: React.ReactNode;
  if (step === 'phone') {
    content = (
      <>
        <View style={{ gap: 6 }}>
          <Txt v="h1">{t('login_title')}</Txt>
          <Txt v="cap">{t('login_sub')}</Txt>
        </View>
        <View style={{ gap: 6 }}>
          <Txt v="capB">{t('phone')}</Txt>
          <View style={s.phoneBox}>
            <Text style={s.phonePrefix}>🇰🇬 +996</Text>
            <TextInput
              testID="phone"
              value={fmtLocal(local)}
              onChangeText={(v) => {
                let d = digits(v);
                if (d.startsWith('996') && d.length > 9) d = d.slice(3);
                if (d.startsWith('0')) d = d.slice(1);
                setLocal(d.slice(0, 9));
                setErr('');
              }}
              placeholder="555 123 456"
              placeholderTextColor={C.faint}
              keyboardType="phone-pad"
              autoFocus={Platform.OS === 'web'}
              onSubmitEditing={requestCode}
              style={[s.phoneInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
            />
          </View>
        </View>
        {err ? <Txt color={C.danger}>{err}</Txt> : null}
        <Button title={t('get_code')} icon="chatbox-ellipses-outline" onPress={requestCode} loading={busy} disabled={local.length !== 9} testID="get-code" />
        <Pressable onPress={() => setLocal('555000001')} style={s.demo} accessibilityRole="button">
          <Ionicons name="flash-outline" size={16} color={C.primary} />
          <Txt v="capB" color={C.primary}>
            {t('demo_fill')}
          </Txt>
        </Pressable>
      </>
    );
  } else if (step === 'code') {
    content = (
      <>
        <Pressable onPress={() => setStep('phone')} style={s.backLink} accessibilityRole="button">
          <Ionicons name="arrow-back" size={18} color={C.ink} />
          <Txt v="bodyB">{t('change_number')}</Txt>
        </Pressable>
        <View style={{ gap: 6 }}>
          <Txt v="h1">{t('enter_code')}</Txt>
          <Txt v="cap">{t('code_sent', { phone: '+996 ' + fmtLocal(local) })}</Txt>
        </View>
        <TextInput
          ref={codeRef}
          testID="code"
          value={code}
          onChangeText={(v) => {
            const d = digits(v).slice(0, 4);
            setCode(d);
            setErr('');
            if (d.length === 4) void verify(d);
          }}
          keyboardType="number-pad"
          maxLength={4}
          placeholder="• • • •"
          placeholderTextColor={C.faint}
          style={[s.code, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
        />
        {demoCode ? <Notice icon="key-outline" tone="primary" text={t('demo_code', { code: demoCode })} /> : null}
        {err ? <Txt color={C.danger}>{err}</Txt> : null}
        <Button title={t('login_btn')} icon="log-in-outline" onPress={() => verify()} loading={busy} disabled={code.length < 4} />
        <Button title={t('resend')} kind="ghost" size="md" onPress={requestCode} />
      </>
    );
  } else if (step === 'register') {
    content = (
      <>
        <View style={{ gap: 6 }}>
          <Txt v="h1">{t('reg_title')}</Txt>
          <Txt v="cap">{t('reg_sub')}</Txt>
        </View>
        <Field label={t('store_name')} placeholder={t('store_name_ph')} value={reg.name} onChangeText={(v) => setReg({ ...reg, name: v })} testID="reg-name" />
        <Field label={t('owner_name')} placeholder={t('owner_name_ph')} value={reg.ownerName} onChangeText={(v) => setReg({ ...reg, ownerName: v })} />
        <View style={{ gap: 8 }}>
          <Txt v="capB">{t('store_address')}</Txt>
          <Row gap={8} wrap>
            {locs.map((l) => (
              <Chip key={l.id} label={l.label} icon="location-outline" active={reg.address === l.line} onPress={() => setReg({ ...reg, address: l.line, lat: l.lat, lng: l.lng })} />
            ))}
          </Row>
          <Field placeholder={t('address_ph')} value={reg.address} onChangeText={(v) => setReg({ ...reg, address: v })} testID="reg-address" />
        </View>
        <Card tint={C.bg} style={{ gap: 10, shadowOpacity: 0 }}>
          <SwitchRow icon="bicycle-outline" label={t('own_delivery')} hint={t('own_delivery_hint')} value={reg.ownDelivery} onChange={(v) => setReg({ ...reg, ownDelivery: v })} />
          {reg.ownDelivery ? (
            <Row gap={10}>
              <Field style={{ flex: 1 }} label={t('delivery_fee')} value={reg.fee} onChangeText={(v) => setReg({ ...reg, fee: digits(v) })} keyboardType="number-pad" suffix={BRAND.currency} />
              <Field style={{ flex: 1 }} label={t('free_from')} value={reg.freeFrom} onChangeText={(v) => setReg({ ...reg, freeFrom: digits(v) })} keyboardType="number-pad" suffix={BRAND.currency} />
            </Row>
          ) : null}
        </Card>
        {err ? <Txt color={C.danger}>{err}</Txt> : null}
        <Button title={t('reg_btn')} icon="rocket-outline" onPress={register} loading={busy} testID="reg-submit" />
      </>
    );
  } else {
    const perks: { e: string; k: Parameters<typeof t>[0]; d: Parameters<typeof t>[0] }[] = [
      { e: '🎁', k: 'perk1', d: 'perk1_d' },
      { e: '🛵', k: 'perk2', d: 'perk2_d' },
      { e: '📣', k: 'perk3', d: 'perk3_d' },
      { e: '🧑‍💻', k: 'perk4', d: 'perk4_d' },
      { e: '⚡', k: 'perk5', d: 'perk5_d' },
    ];
    content = (
      <>
        <View style={s.hero}>
          <Text style={{ fontSize: 48 }}>🎉</Text>
          <Text style={s.heroTitle}>{t('welcome_title', { name: pending?.name ?? '' })}</Text>
          <Text style={s.heroSub}>{t('welcome_sub')}</Text>
        </View>
        <View style={{ gap: 10 }}>
          {perks.map((p) => (
            <Row key={p.k} gap={14} style={s.perk}>
              <Text style={{ fontSize: 28 }}>{p.e}</Text>
              <View style={{ flex: 1 }}>
                <Txt v="bodyB">{t(p.k)}</Txt>
                <Txt v="cap">{t(p.d)}</Txt>
              </View>
            </Row>
          ))}
        </View>
        <Button title={t('welcome_add_product')} icon="camera-outline" onPress={() => finish('/product/new')} testID="welcome-go" />
        <Button title={t('welcome_excel')} icon="document-outline" kind="secondary" onPress={() => finish('/import')} />
        <Button title={t('welcome_dashboard')} kind="ghost" size="md" onPress={() => finish('/')} />
      </>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: wide ? C.primary : C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <View style={[s.wrap, wide && s.wrapWide]}>
          <View style={{ alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <View style={s.logoMark}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 26 }}>T</Text>
            </View>
            <Text style={s.logo}>
              Tap<Text style={{ color: C.primary }}>tym</Text> <Text style={{ color: C.muted, fontWeight: '700' }}>{t('business')}</Text>
            </Text>
          </View>
          {step !== 'welcome' ? langBar : null}
          <View style={{ gap: 16, marginTop: 8 }}>{content}</View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16 },
  wrap: { width: '100%', maxWidth: 460, alignSelf: 'center', gap: 16 },
  wrapWide: { backgroundColor: C.card, borderRadius: 32, padding: 32, ...shadow.lift },
  logoMark: { width: 56, height: 56, borderRadius: 18, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', ...shadow.primary },
  logo: { fontSize: 24, fontWeight: '900', color: C.ink, letterSpacing: -0.6, fontFamily: FONT },
  phoneBox: { flexDirection: 'row', alignItems: 'center', height: 64, borderRadius: 18, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, paddingHorizontal: 16, gap: 10 },
  phonePrefix: { fontSize: 20, fontWeight: '800', color: C.ink, fontFamily: FONT },
  phoneInput: { flex: 1, fontSize: 22, fontWeight: '800', color: C.ink, letterSpacing: 1, fontFamily: FONT, minWidth: 0 },
  code: { height: 76, borderRadius: 20, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.primary, textAlign: 'center', fontSize: 36, fontWeight: '900', letterSpacing: 16, color: C.ink, fontFamily: FONT },
  demo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44 },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  hero: { backgroundColor: C.primary, borderRadius: 28, padding: 24, gap: 6, ...shadow.primary },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: -0.6, fontFamily: FONT },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '600', fontFamily: FONT },
  perk: { backgroundColor: C.card, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: C.line },
});
