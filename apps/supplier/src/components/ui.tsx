import { type ComponentProps, type ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatPrice } from '@taptym/shared';
import { C, FONT, R, shadow } from '@/lib/theme';
import { haptic } from '@/lib/haptics';

export type IconName = ComponentProps<typeof Ionicons>['name'];

const web = Platform.OS === 'web';

// ---------- text ----------

type TxtProps = ComponentProps<typeof Text> & {
  v?: 'h1' | 'h2' | 'h3' | 'body' | 'bodyB' | 'cap' | 'capB' | 'money' | 'moneyL' | 'tiny';
  color?: string;
  center?: boolean;
};

export function Txt({ v = 'body', color, center, style, ...rest }: TxtProps) {
  return <Text {...rest} style={[txt.base, txt[v], color ? { color } : null, center ? { textAlign: 'center' } : null, style]} />;
}

const txt = StyleSheet.create({
  base: { color: C.ink, fontFamily: FONT },
  h1: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.6 },
  h2: { fontSize: 21, lineHeight: 27, fontWeight: '800', letterSpacing: -0.3 },
  h3: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '500', color: C.ink2 },
  bodyB: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
  cap: { fontSize: 13, lineHeight: 18, fontWeight: '500', color: C.muted },
  capB: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: C.muted },
  tiny: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: C.muted, letterSpacing: 0.3 },
  money: { fontSize: 24, lineHeight: 30, fontWeight: '900', letterSpacing: -0.6 },
  moneyL: { fontSize: 38, lineHeight: 44, fontWeight: '900', letterSpacing: -1.2 },
});

export function Money({ value, v = 'money', color, sign }: { value: number; v?: 'money' | 'moneyL' | 'bodyB' | 'h3'; color?: string; sign?: boolean }) {
  const s = formatPrice(value);
  return (
    <Txt v={v} color={color}>
      {sign && value > 0 ? '+' + s : s}
    </Txt>
  );
}

// ---------- containers ----------

export function Card({ children, style, onPress, pad = 18, tint }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; pad?: number; tint?: string }) {
  const base = [ui.card, { padding: pad }, tint ? { backgroundColor: tint } : null, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed, hovered }: any) => [base, hovered && ui.cardHover, pressed && ui.pressed]}
    >
      {children}
    </Pressable>
  );
}

export function Row({ children, gap = 10, style, wrap }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, wrap && { flexWrap: 'wrap' }, style]}>{children}</View>;
}

export function Grid({ cols, gap = 12, children }: { cols: number; gap?: number; children: ReactNode[] | ReactNode }) {
  const items = (Array.isArray(children) ? children : [children]).filter(Boolean);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {items.map((c, i) => (
        <View key={i} style={{ flexBasis: cols === 1 ? '100%' : `${100 / cols - 2}%`, flexGrow: 1, minWidth: cols === 1 ? undefined : 150 }}>
          {c}
        </View>
      ))}
    </View>
  );
}

export function Section({ title, action, onAction, children, icon }: { title: string; action?: string; onAction?: () => void; children: ReactNode; icon?: IconName }) {
  return (
    <View style={{ gap: 12 }}>
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: 2 }}>
        <Row gap={8}>
          {icon ? <Ionicons name={icon} size={20} color={C.ink} /> : null}
          <Txt v="h3">{title}</Txt>
        </Row>
        {action ? (
          <Pressable onPress={onAction} hitSlop={12} style={{ minHeight: 32, justifyContent: 'center' }}>
            <Txt v="capB" color={C.primary}>
              {action}
            </Txt>
          </Pressable>
        ) : null}
      </Row>
      {children}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: StyleSheet.hairlineWidth * 2, backgroundColor: C.line }, style]} />;
}

// ---------- buttons ----------

type BtnKind = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'dark' | 'light';

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  loading,
  disabled,
  size = 'lg',
  style,
  full = true,
  testID,
}: {
  title: string;
  onPress?: () => void | Promise<void>;
  kind?: BtnKind;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: 'lg' | 'md' | 'sm';
  style?: StyleProp<ViewStyle>;
  full?: boolean;
  testID?: string;
}) {
  const palette: Record<BtnKind, { bg: string; fg: string; border?: string }> = {
    primary: { bg: C.primary, fg: '#fff' },
    secondary: { bg: C.primarySoft, fg: C.primary },
    ghost: { bg: 'transparent', fg: C.ink, border: C.line },
    danger: { bg: C.dangerSoft, fg: C.danger },
    success: { bg: C.success, fg: '#fff' },
    dark: { bg: C.ink, fg: '#fff' },
    light: { bg: '#fff', fg: C.primary },
  };
  const p = palette[kind];
  const h = size === 'lg' ? 56 : size === 'md' ? 48 : 38;
  const off = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={off}
      onPress={() => {
        haptic.tap();
        void onPress?.();
      }}
      style={({ pressed, hovered }: any) => [
        ui.btn,
        {
          height: h,
          backgroundColor: p.bg,
          borderRadius: size === 'sm' ? 12 : 18,
          paddingHorizontal: size === 'sm' ? 12 : 20,
          alignSelf: full ? 'stretch' : 'flex-start',
        },
        p.border ? { borderWidth: 1.5, borderColor: p.border } : null,
        kind === 'primary' && !off ? shadow.primary : null,
        hovered && !off ? { opacity: 0.92 } : null,
        pressed && ui.pressed,
        off && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 16 : 20} color={p.fg} /> : null}
          <Text numberOfLines={1} style={[ui.btnText, { color: p.fg, fontSize: size === 'lg' ? 17 : size === 'md' ? 15 : 13 }]}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function IconBtn({ icon, onPress, label, color = C.ink, bg = C.card, size = 44, badge }: { icon: IconName; onPress: () => void; label: string; color?: string; bg?: string; size?: number; badge?: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      hitSlop={6}
      style={({ pressed, hovered }: any) => [
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' },
        bg === C.card ? shadow.soft : null,
        hovered && { opacity: 0.85 },
        pressed && ui.pressed,
      ]}
    >
      <Ionicons name={icon} size={size * 0.48} color={color} />
      {badge ? (
        <View style={ui.dotBadge}>
          <Text style={ui.dotBadgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Chip({ label, active, onPress, icon, count, emoji, tone }: { label: string; active?: boolean; onPress?: () => void; icon?: IconName; count?: number; emoji?: string; tone?: 'danger' | 'warning' }) {
  const activeBg = tone === 'danger' ? C.danger : tone === 'warning' ? C.warning : C.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={({ pressed, hovered }: any) => [ui.chip, active && { backgroundColor: activeBg, borderColor: activeBg }, hovered && !active && { borderColor: C.faint }, pressed && ui.pressed]}
    >
      {emoji ? <Text style={{ fontSize: 16 }}>{emoji}</Text> : null}
      {icon ? <Ionicons name={icon} size={16} color={active ? '#fff' : C.ink2} /> : null}
      <Text style={[ui.chipText, active && { color: '#fff' }]}>{label}</Text>
      {count != null ? (
        <View style={[ui.chipCount, active && { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
          <Text style={[ui.chipCountText, active && { color: '#fff' }]}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Segmented<K extends string>({ items, value, onChange }: { items: { key: K; label: string; count?: number; icon?: IconName }[]; value: K; onChange: (k: K) => void }) {
  // Scrolls sideways on narrow phones instead of truncating labels to "Нов…".
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ui.segWrap} contentContainerStyle={ui.seg}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              haptic.tap();
              onChange(it.key);
            }}
            style={[ui.segItem, on && ui.segOn]}
          >
            {it.icon ? <Ionicons name={it.icon} size={16} color={on ? C.ink : C.muted} /> : null}
            <Text numberOfLines={1} style={[ui.segText, on && { color: C.ink }]}>
              {it.label}
            </Text>
            {it.count ? (
              <View style={[ui.segCount, on && it.key === 'new' && { backgroundColor: C.danger }]}>
                <Text style={[ui.segCountText, on && it.key === 'new' && { color: '#fff' }]}>{it.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Pill({ label, tone = 'neutral', icon }: { label: string; tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'; icon?: IconName }) {
  const map = {
    neutral: [C.bg, C.ink2],
    primary: [C.primarySoft, C.primary],
    success: [C.successSoft, '#067647'],
    warning: [C.warningSoft, '#B54708'],
    danger: [C.dangerSoft, '#B42318'],
    info: [C.infoSoft, '#175CD3'],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[ui.pill, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <Text style={[ui.pillText, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// ---------- inputs ----------

export function Field({
  label,
  hint,
  error,
  big,
  prefix,
  suffix,
  style,
  inputStyle,
  ...rest
}: TextInputProps & { label?: string; hint?: string; error?: string; big?: boolean; prefix?: string; suffix?: string; style?: StyleProp<ViewStyle>; inputStyle?: StyleProp<TextStyle> }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <Txt v="capB">{label}</Txt> : null}
      <View style={[ui.input, big && { height: 64 }, rest.multiline && { height: undefined, minHeight: 96, alignItems: 'flex-start', paddingVertical: 12 }, focus && ui.inputFocus, error ? { borderColor: C.danger } : null]}>
        {prefix ? <Text style={[ui.affix, big && { fontSize: 22 }]}>{prefix}</Text> : null}
        <TextInput
          placeholderTextColor={C.faint}
          {...rest}
          onFocus={(e) => {
            setFocus(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocus(false);
            rest.onBlur?.(e);
          }}
          style={[ui.inputText, big && { fontSize: 24, fontWeight: '800' }, rest.multiline && { textAlignVertical: 'top' }, web && ({ outlineStyle: 'none' } as any), inputStyle]}
        />
        {suffix ? <Text style={[ui.affix, big && { fontSize: 18 }]}>{suffix}</Text> : null}
      </View>
      {error ? (
        <Txt v="cap" color={C.danger}>
          {error}
        </Txt>
      ) : hint ? (
        <Txt v="cap">{hint}</Txt>
      ) : null}
    </View>
  );
}

export const digits = (s: string) => s.replace(/[^\d]/g, '');

/** Numeric input with big −/+ buttons. */
export function Stepper({ value, onChange, step = 1, min = 0, label, compact }: { value: number; onChange: (n: number) => void; step?: number; min?: number; label?: string; compact?: boolean }) {
  const h = compact ? 40 : 56;
  const btn = (d: number, icon: IconName, name: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={() => {
        haptic.tap();
        onChange(Math.max(min, value + d));
      }}
      style={({ pressed }) => [{ width: h, height: h, borderRadius: compact ? 12 : 16, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }, pressed && ui.pressed]}
    >
      <Ionicons name={icon} size={compact ? 18 : 24} color={C.primary} />
    </Pressable>
  );
  return (
    <View style={{ gap: 6 }}>
      {label ? <Txt v="capB">{label}</Txt> : null}
      <Row gap={8}>
        {btn(-step, 'remove', '−')}
        <TextInput
          value={String(value)}
          onChangeText={(s) => onChange(Math.max(min, Number(digits(s) || 0)))}
          keyboardType="number-pad"
          selectTextOnFocus
          style={[ui.input, ui.inputText, { height: h, flex: 1, minWidth: compact ? 56 : 80, textAlign: 'center', fontSize: compact ? 16 : 22, fontWeight: '800' }, web && ({ outlineStyle: 'none' } as any)]}
        />
        {btn(step, 'add', '+')}
      </Row>
    </View>
  );
}

export function SwitchRow({ label, hint, value, onChange, icon }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; icon?: IconName }) {
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onChange(!value);
      }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 }}
    >
      {icon ? (
        <View style={ui.iconTile}>
          <Ionicons name={icon} size={20} color={C.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Txt v="bodyB">{label}</Txt>
        {hint ? <Txt v="cap">{hint}</Txt> : null}
      </View>
      <Toggle value={value} onChange={onChange} label={label} />
    </Pressable>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  // react-native-web paints the active thumb teal unless activeThumbColor is set.
  return <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: C.primary, false: '#D0D3DE' }} thumbColor="#fff" {...(web ? ({ activeThumbColor: '#fff' } as any) : {})} />;
}

// ---------- list rows ----------

export function ListRow({ icon, iconColor = C.primary, iconBg = C.primarySoft, emoji, title, subtitle, right, onPress, chevron = true, danger, badge }: {
  icon?: IconName;
  iconColor?: string;
  iconBg?: string;
  emoji?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  danger?: boolean;
  badge?: number;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={({ pressed, hovered }: any) => [ui.listRow, hovered && onPress && { backgroundColor: C.primaryTint }, pressed && { opacity: 0.7 }]}
    >
      {icon || emoji ? (
        <View style={[ui.iconTile, { backgroundColor: danger ? C.dangerSoft : iconBg }]}>
          {emoji ? <Text style={{ fontSize: 20 }}>{emoji}</Text> : <Ionicons name={icon!} size={21} color={danger ? C.danger : iconColor} />}
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 1 }}>
        <Txt v="bodyB" color={danger ? C.danger : undefined} numberOfLines={2}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt v="cap" numberOfLines={2}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {badge ? (
        <View style={[ui.dotBadge, { position: 'relative', top: 0, right: 0 }]}>
          <Text style={ui.dotBadgeText}>{badge}</Text>
        </View>
      ) : null}
      {right}
      {onPress && chevron ? <Ionicons name="chevron-forward" size={18} color={C.faint} /> : null}
    </Pressable>
  );
}

// ---------- states ----------

export function Skeleton({ h = 18, w = '100%', r = 10, style }: { h?: number; w?: number | `${number}%`; r?: number; style?: StyleProp<ViewStyle> }) {
  const [a] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: !web }),
        Animated.timing(a, { toValue: 0.5, duration: 700, useNativeDriver: !web }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [a]);
  return <Animated.View style={[{ height: h, width: w, borderRadius: r, backgroundColor: '#E6E8F0', opacity: a }, style]} />;
}

export function SkeletonList({ n = 4, h = 76 }: { n?: number; h?: number }) {
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} h={h} r={R.lg} />
      ))}
    </View>
  );
}

export function Empty({ emoji = '📭', title, text, action, onAction }: { emoji?: string; title: string; text?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 8 }}>
      <Text style={{ fontSize: 52 }}>{emoji}</Text>
      <Txt v="h3" center>
        {title}
      </Txt>
      {text ? (
        <Txt v="cap" center style={{ maxWidth: 340 }}>
          {text}
        </Txt>
      ) : null}
      {action ? <Button title={action} onPress={onAction} size="md" full={false} style={{ marginTop: 10 }} /> : null}
    </View>
  );
}

export function ErrorBox({ text, onRetry, retry }: { text: string; onRetry?: () => void; retry?: string }) {
  return (
    <Card tint={C.dangerSoft} style={{ gap: 10 }}>
      <Row>
        <Ionicons name="cloud-offline-outline" size={22} color={C.danger} />
        <Txt v="bodyB" color={C.danger} style={{ flex: 1 }}>
          {text}
        </Txt>
      </Row>
      {onRetry ? <Button title={retry ?? '↻'} kind="danger" size="sm" icon="refresh" full={false} onPress={onRetry} /> : null}
    </Card>
  );
}

export function Notice({ icon = 'information-circle', text, tone = 'info' }: { icon?: IconName; text: string; tone?: 'info' | 'warning' | 'success' | 'primary' }) {
  const map = { info: [C.infoSoft, '#175CD3'], warning: [C.warningSoft, '#B54708'], success: [C.successSoft, '#067647'], primary: [C.primarySoft, C.primary] } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ flexDirection: 'row', gap: 10, backgroundColor: bg, borderRadius: R.md, padding: 14, alignItems: 'flex-start' }}>
      <Ionicons name={icon} size={20} color={fg} style={{ marginTop: 1 }} />
      <Txt v="cap" color={fg} style={{ flex: 1, fontWeight: '600' }}>
        {text}
      </Txt>
    </View>
  );
}

export function Stat({ label, value, icon, tone = C.primary, hint, onPress }: { label: string; value: ReactNode; icon: IconName; tone?: string; hint?: string; onPress?: () => void }) {
  const len = typeof value === 'string' ? value.length : 0;
  return (
    <Card onPress={onPress} style={{ gap: 10, minHeight: 118 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Txt v="capB" style={{ flex: 1, minWidth: 0 }} numberOfLines={2}>
          {label}
        </Txt>
        <View style={[ui.iconTileSm, { backgroundColor: tone + '1A', flexShrink: 0 }]}>
          <Ionicons name={icon} size={16} color={tone} />
        </View>
      </Row>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Txt v="money" numberOfLines={1} style={len > 11 ? { fontSize: 18 } : len > 9 ? { fontSize: 21 } : null}>
          {value}
        </Txt>
      ) : (
        value
      )}
      {hint ? <Txt v="cap">{hint}</Txt> : null}
    </Card>
  );
}

export const ui = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 24, ...shadow.soft },
  cardHover: { ...shadow.lift },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { fontWeight: '800', fontFamily: FONT, letterSpacing: -0.2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: R.pill, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line },
  chipText: { fontSize: 14, fontWeight: '700', color: C.ink2, fontFamily: FONT },
  chipCount: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  chipCountText: { fontSize: 12, fontWeight: '800', color: C.ink2 },
  segWrap: { flexGrow: 0, backgroundColor: '#E9EAF1', borderRadius: 18 },
  seg: { flexGrow: 1, flexDirection: 'row', padding: 4, gap: 4 },
  segItem: { flexGrow: 1, flexShrink: 0, flexBasis: 'auto', height: 44, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 12 },
  segOn: { backgroundColor: C.card, ...shadow.soft },
  segText: { fontSize: 13.5, fontWeight: '700', color: C.muted, fontFamily: FONT },
  segCount: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: '#DADCE6', alignItems: 'center', justifyContent: 'center' },
  segCountText: { fontSize: 11, fontWeight: '800', color: C.ink2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 24, paddingHorizontal: 10, borderRadius: R.pill, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '800', fontFamily: FONT },
  input: { flexDirection: 'row', alignItems: 'center', height: 54, borderRadius: 16, backgroundColor: C.bg, borderWidth: 1.5, borderColor: 'transparent', paddingHorizontal: 14, gap: 6 },
  inputFocus: { borderColor: C.primary, backgroundColor: C.card },
  inputText: { flex: 1, fontSize: 16, fontWeight: '600', color: C.ink, fontFamily: FONT, paddingVertical: 0, minWidth: 0 },
  affix: { fontSize: 16, fontWeight: '700', color: C.muted },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18 },
  iconTile: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  iconTileSm: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dotBadge: { position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  dotBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
