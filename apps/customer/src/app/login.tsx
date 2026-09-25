import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND, DEMO, formatPhone, type CustomerProfile } from '@taptym/shared';
import { LangPicker } from '@/components/lang-picker';
import { ServerRow } from '@/components/server-sheet';
import { Button, Field, Row, Txt } from '@/components/ui';
import { errorText, useT } from '@/i18n';
import { api } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { toast, useApp } from '@/lib/store';
import { C, gradient, R, shadow } from '@/lib/theme';

const fmt = (d: string) => [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join(' ');

export default function LoginScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [digits, setDigits] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [code, setCode] = useState('');
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [ref, setRef] = useState('');
  const [showRef, setShowRef] = useState(false);
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<TextInput>(null);
  const phone = `+996${digits}`;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const request = async () => {
    if (digits.length !== 9) return toast(t('err_bad_phone'), 'error');
    setBusy(true);
    try {
      const r = await api<{ demoCode: string | null }>('/auth/request-code', { body: { phone } });
      setDemoCode(r.demoCode);
      setStep('code');
      setCode('');
      setTimeout(() => codeRef.current?.focus(), 200);
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (c = code) => {
    if (c.length < 4 || busy) return;
    setBusy(true);
    try {
      const lang = useApp.getState().lang;
      const r = await api<{ token: string; profile: CustomerProfile; isNew: boolean }>('/auth/verify', {
        body: { phone, code: c, referralCode: ref.trim() || undefined, lang },
      });
      useApp.getState().setAuth(r.token, r.profile);
      if (r.profile.lang !== lang) {
        api<CustomerProfile>('/me', { method: 'PATCH', body: { lang } })
          .then((p) => useApp.getState().setProfile(p))
          .catch(() => {});
      }
      haptic.success();
      toast(r.isNew || !r.profile.name ? t('welcome_new') : t('welcome_back', { name: r.profile.name }), 'success');
      if (next && next !== '/login') router.replace(next as never);
      else close();
    } catch (e) {
      haptic.error();
      toast(errorText(e), 'error');
      setCode('');
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <View style={[s.hero, gradient('linear-gradient(150deg, #6D4DFF 0%, #4327D9 100%)', C.primary), { paddingTop: insets.top + 12 }]}>
          <View style={s.inner}>
            <Pressable onPress={step === 'code' ? () => setStep('phone') : close} style={s.close} accessibilityLabel={t('back')}>
              <Ionicons name={step === 'code' ? 'chevron-back' : 'close'} size={24} color={C.white} />
            </Pressable>
            <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 36 }}>
              <View style={s.logo}>
                <Text style={{ fontSize: 40 }}>🔎</Text>
              </View>
              <Text style={s.brand}>{BRAND.name}</Text>
              <Text style={s.tag}>{BRAND.tagline}</Text>
            </View>
          </View>
        </View>
        <View style={[s.inner, s.card]}>
          {step === 'phone' ? (
            <>
              <Txt v="h1">{t('login_title')}</Txt>
              <Txt v="body" color={C.muted} style={{ marginTop: 4, marginBottom: 18 }}>
                {t('login_sub')}
              </Txt>
              <Txt v="small" style={{ marginBottom: 6, fontWeight: '700', color: C.ink }}>
                {t('phone')}
              </Txt>
              <View style={s.phone}>
                <Text style={s.prefix}>🇰🇬 +996</Text>
                <TextInput
                  value={fmt(digits)}
                  onChangeText={(v) => {
                    let d = v.replace(/\D/g, '');
                    if (d.startsWith('996') && d.length > 9) d = d.slice(3);
                    if (d.startsWith('0')) d = d.slice(1);
                    setDigits(d.slice(0, 9));
                  }}
                  placeholder="700 123 456"
                  placeholderTextColor={C.faint}
                  keyboardType="phone-pad"
                  autoFocus
                  onSubmitEditing={request}
                  style={s.phoneInput}
                  accessibilityLabel={t('phone')}
                />
              </View>
              <Pressable onPress={() => setDigits(DEMO.customerPhone.slice(4))} style={{ marginTop: 10, alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' }}>
                <Txt v="bodyBold" color={C.primary}>
                  {t('demo_fill')} · {formatPhone(DEMO.customerPhone)}
                </Txt>
              </Pressable>
              {showRef ? (
                <Field
                  label={t('referral_code')}
                  value={ref}
                  onChangeText={(v) => setRef(v.toUpperCase())}
                  autoCapitalize="characters"
                  icon="gift-outline"
                  placeholder="AHROR1"
                  style={{ marginTop: 14 }}
                />
              ) : (
                <Pressable onPress={() => setShowRef(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, minHeight: 40 }}>
                  <Ionicons name="gift-outline" size={18} color={C.muted} />
                  <Txt v="body" color={C.muted}>
                    {t('have_referral')}
                  </Txt>
                </Pressable>
              )}
              <Button title={t('get_code')} icon="chatbox-ellipses-outline" onPress={request} loading={busy} disabled={digits.length !== 9} style={{ marginTop: 18 }} />
            </>
          ) : (
            <>
              <Txt v="h1">{t('enter_code')}</Txt>
              <Txt v="body" color={C.muted} style={{ marginTop: 4, marginBottom: 18 }}>
                {t('code_sent', { phone: formatPhone(phone) })}
              </Txt>
              <Pressable onPress={() => codeRef.current?.focus()} style={s.codeRow}>
                {[0, 1, 2, 3].map((i) => (
                  <View key={i} style={[s.codeBox, code.length === i && s.codeBoxOn]}>
                    <Text style={s.codeDigit}>{code[i] ?? ''}</Text>
                  </View>
                ))}
                <TextInput
                  ref={codeRef}
                  value={code}
                  onChangeText={(v) => {
                    const c = v.replace(/\D/g, '').slice(0, 4);
                    setCode(c);
                    if (c.length === 4) verify(c);
                  }}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  maxLength={4}
                  style={s.hiddenInput}
                  accessibilityLabel={t('enter_code')}
                />
              </Pressable>
              {demoCode ? (
                <Pressable
                  onPress={() => {
                    setCode(demoCode);
                    verify(demoCode);
                  }}
                  style={s.demo}
                >
                  <Ionicons name="flask" size={18} color={C.accentInk} />
                  <Txt v="bodyBold" color={C.accentInk}>
                    {t('demo_code', { code: demoCode })}
                  </Txt>
                </Pressable>
              ) : null}
              <Button title={t('confirm')} onPress={() => verify()} loading={busy} disabled={code.length !== 4} style={{ marginTop: 18 }} />
              <Row style={{ justifyContent: 'center', marginTop: 12 }}>
                <Pressable onPress={() => setStep('phone')} style={{ minHeight: 44, justifyContent: 'center' }}>
                  <Txt v="bodyBold" color={C.primary}>
                    {t('change_phone')}
                  </Txt>
                </Pressable>
              </Row>
            </>
          )}
          <Txt v="small" style={{ marginTop: 26, marginBottom: 8, fontWeight: '700', color: C.ink }}>
            {t('language')}
          </Txt>
          <LangPicker compact />
          <Txt v="small" center style={{ marginTop: 18 }}>
            {t('terms')}
          </Txt>
          <ServerRow style={{ marginTop: 10 }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  hero: { paddingBottom: 40, borderBottomLeftRadius: 36, borderBottomRightRadius: 36 },
  inner: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 20 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  logo: { width: 80, height: 80, borderRadius: 28, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', ...shadow.lg },
  brand: { color: C.white, fontSize: 34, fontWeight: '800', letterSpacing: -1, marginTop: 14 },
  tag: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '600', marginTop: 2 },
  card: { marginTop: -28, backgroundColor: C.white, borderRadius: R.xxl, paddingVertical: 24, maxWidth: 440, width: '92%', ...shadow.lg },
  phone: { flexDirection: 'row', alignItems: 'center', height: 60, borderRadius: R.lg, borderWidth: 2, borderColor: C.primary, backgroundColor: C.white, paddingHorizontal: 14, gap: 10 },
  prefix: { fontSize: 18, fontWeight: '700', color: C.ink },
  phoneInput: { flex: 1, fontSize: 20, fontWeight: '700', color: C.ink, letterSpacing: 1, height: '100%', minWidth: 0, outlineStyle: 'none' } as object,
  codeRow: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  codeBox: { width: 62, height: 70, borderRadius: R.lg, borderWidth: 2, borderColor: C.line, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  codeBoxOn: { borderColor: C.primary, backgroundColor: C.white },
  codeDigit: { fontSize: 30, fontWeight: '800', color: C.ink },
  hiddenInput: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: 0.01, color: 'transparent' } as object,
  demo: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', marginTop: 16, backgroundColor: C.accentSoft, borderRadius: R.pill, paddingHorizontal: 16, height: 44 },
});
