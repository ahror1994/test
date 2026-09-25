import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { createContext, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatPrice } from '@taptym/shared';
import { C, MAX_W, R, shadow } from '@/lib/theme';
import { haptic } from '@/lib/haptics';
import { useToast } from '@/lib/store';
import { errorText, useT } from '@/i18n';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------- text ----------

type TxtVariant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'bodyBold' | 'small' | 'tiny' | 'price';
const tv: Record<TxtVariant, TextStyle> = {
  display: { fontSize: 32, lineHeight: 36, fontWeight: '800', letterSpacing: -1 },
  h1: { fontSize: 28, lineHeight: 32, fontWeight: '800', letterSpacing: -0.8 },
  h2: { fontSize: 22, lineHeight: 27, fontWeight: '800', letterSpacing: -0.5 },
  h3: { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
  bodyBold: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '500', color: C.muted },
  tiny: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 0.2 },
  price: { fontSize: 17, lineHeight: 22, fontWeight: '800', letterSpacing: -0.3 },
};

export function Txt({
  v = 'body',
  color,
  style,
  children,
  lines,
  center,
}: {
  v?: TxtVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  lines?: number;
  center?: boolean;
}) {
  return (
    <Text
      numberOfLines={lines}
      style={[{ color: C.ink }, tv[v], color ? { color } : null, center ? { textAlign: 'center' } : null, style]}
    >
      {children}
    </Text>
  );
}

export const price = (n: number) => formatPrice(n);

// ---------- layout ----------

const ContentWidth = createContext<number | null>(null);

/** Width available for page content: measured by the enclosing Screen, else estimated from the window. */
export function useContentWidth(pad = 16) {
  const measured = useContext(ContentWidth);
  const { width } = useWindowDimensions();
  return measured ?? Math.min(width, MAX_W) - pad * 2;
}

export function Screen({
  children,
  header,
  footer,
  refreshing,
  onRefresh,
  scroll = true,
  pad = true,
  bg = C.bg,
  contentStyle,
  scrollRef,
}: {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
  pad?: boolean;
  bg?: string;
  contentStyle?: StyleProp<ViewStyle>;
  scrollRef?: React.Ref<ScrollView>;
}) {
  const [w, setW] = useState<number | null>(null);
  const inner = (
    <View
      style={[styles.page, pad && styles.pagePad, contentStyle]}
      onLayout={(e) => {
        const next = Math.floor(e.nativeEvent.layout.width - (pad ? 32 : 0));
        if (next > 0 && next !== w) setW(next);
      }}
    >
      <ContentWidth.Provider value={w}>{children}</ContentWidth.Provider>
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {header}
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: footer ? 24 : 40 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} /> : undefined}
        >
          {inner}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{inner}</View>
      )}
      {footer}
    </View>
  );
}

/** Top bar for stack screens: back button + title + optional right slot. */
export function Header({ title, right, onBack, transparent }: { title?: string; right?: ReactNode; onBack?: () => void; transparent?: boolean }) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const back = () => {
    haptic.tap();
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }, transparent ? null : styles.headerSolid]}>
      <View style={styles.headerInner}>
        <Pressable onPress={back} accessibilityRole="button" accessibilityLabel={t('back')} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}>
          <Ionicons name="chevron-back" size={22} color={C.ink} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          {title ? (
            <Txt v="h3" lines={1}>
              {title}
            </Txt>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );
}

/** Large page title used on tab screens. */
export function TabTitle({ title, right, sub }: { title: string; right?: ReactNode; sub?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 14, backgroundColor: C.bg }}>
      <View style={[styles.page, styles.pagePad, { flexDirection: 'row', alignItems: 'center', paddingBottom: 10 }]}>
        <View style={{ flex: 1 }}>
          <Txt v="h1">{title}</Txt>
          {sub ? <Txt v="small" style={{ marginTop: 2 }}>{sub}</Txt> : null}
        </View>
        {right}
      </View>
    </View>
  );
}

/** Sticky bottom action area. */
export function BottomBar({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={[styles.page, styles.pagePad, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>{children}</View>
    </View>
  );
}

export function Row({ children, gap = 8, style, wrap }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, wrap && { flexWrap: 'wrap' }, style]}>{children}</View>;
}

export function Card({ children, style, onPress, pad = 16 }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; pad?: number }) {
  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          haptic.tap();
          onPress();
        }}
        style={({ pressed }) => [styles.card, { padding: pad }, style, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, { padding: pad }, style]}>{children}</View>;
}

export function Section({ title, action, onAction, children, style }: { title: string; action?: string; onAction?: () => void; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginTop: 28 }, style]}>
      <Row style={{ marginBottom: 12, justifyContent: 'space-between' }}>
        <Txt v="h2" style={{ flex: 1 }}>
          {title}
        </Txt>
        {action && onAction ? (
          <Pressable onPress={onAction} hitSlop={10} style={styles.sectionAction}>
            <Txt v="bodyBold" color={C.primary}>
              {action}
            </Txt>
            <Ionicons name="chevron-forward" size={16} color={C.primary} />
          </Pressable>
        ) : null}
      </Row>
      {children}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: C.line }, style]} />;
}

// ---------- controls ----------

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'dark' | 'danger' | 'accent';
const bv: Record<BtnVariant, { bg: string; fg: string }> = {
  primary: { bg: C.primary, fg: C.white },
  secondary: { bg: C.primarySoft, fg: C.primary },
  ghost: { bg: 'transparent', fg: C.ink },
  success: { bg: C.success, fg: C.white },
  dark: { bg: C.ink, fg: C.white },
  danger: { bg: C.dangerSoft, fg: C.danger },
  accent: { bg: C.accent, fg: C.ink },
};

export function Button({
  title,
  onPress,
  v = 'primary',
  icon,
  loading,
  disabled,
  size = 'lg',
  style,
  full,
  sub,
}: {
  title: string;
  onPress?: () => void;
  v?: BtnVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: 'lg' | 'md' | 'sm';
  style?: StyleProp<ViewStyle>;
  full?: boolean;
  sub?: string;
}) {
  const c = bv[v];
  const h = size === 'lg' ? 56 : size === 'md' ? 48 : 40;
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      disabled={off}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.btn,
        { height: h, backgroundColor: c.bg, borderRadius: size === 'sm' ? R.md : R.lg, paddingHorizontal: size === 'lg' ? 20 : 14 },
        v === 'primary' && !off ? shadow.primary : null,
        full && { alignSelf: 'stretch' },
        disabled && { opacity: 0.45 },
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 17 : 20} color={c.fg} /> : null}
          <View style={{ alignItems: 'center', flexShrink: 1 }}>
            <Text numberOfLines={1} style={{ color: c.fg, fontSize: size === 'sm' ? 14 : 16, fontWeight: '800', letterSpacing: -0.2 }}>
              {title}
            </Text>
            {sub ? <Text style={{ color: c.fg, opacity: 0.8, fontSize: 12, fontWeight: '600' }}>{sub}</Text> : null}
          </View>
        </>
      )}
    </Pressable>
  );
}

/** Round icon button that always shows a text label under the icon. */
export function IconLabel({ icon, label, onPress, badge, color = C.ink, active }: { icon: IconName; label: string; onPress: () => void; badge?: number; color?: string; active?: boolean }) {
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [{ alignItems: 'center', minWidth: 56, gap: 3 }, pressed && { opacity: 0.6 }]}
    >
      <View style={[styles.iconCircle, active && { backgroundColor: C.primarySoft }]}>
        <Ionicons name={icon} size={22} color={color} />
        {badge ? (
          <View style={styles.dotBadge}>
            <Text style={styles.dotBadgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Txt v="tiny" color={C.muted} lines={1}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, icon, style }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress?.();
      }}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && { opacity: 0.7 }, style]}
    >
      {icon ? <Ionicons name={icon} size={16} color={selected ? C.white : C.ink} /> : null}
      <Text style={[styles.chipText, selected && { color: C.white }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Badge({ label, color = C.primary, bg = C.primarySoft, icon, style }: { label: string; color?: string; bg?: string; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      {icon ? <Ionicons name={icon} size={12} color={color} /> : null}
      <Text style={{ color, fontSize: 11, fontWeight: '800', letterSpacing: 0.1 }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function Stepper({ qty, onChange, max, compact }: { qty: number; onChange: (q: number) => void; max?: number; compact?: boolean }) {
  const h = compact ? 40 : 48;
  return (
    <View style={[styles.stepper, { height: h }]}>
      <Pressable
        accessibilityLabel="−"
        onPress={() => {
          haptic.select();
          onChange(qty - 1);
        }}
        style={[styles.stepBtn, { width: h }]}
      >
        <Ionicons name={qty <= 1 ? 'trash-outline' : 'remove'} size={compact ? 18 : 20} color={C.primary} />
      </Pressable>
      <Text style={styles.stepQty}>{qty}</Text>
      <Pressable
        accessibilityLabel="+"
        disabled={max != null && qty >= max}
        onPress={() => {
          haptic.select();
          onChange(qty + 1);
        }}
        style={[styles.stepBtn, { width: h }, max != null && qty >= max && { opacity: 0.35 }]}
      >
        <Ionicons name="add" size={compact ? 18 : 20} color={C.primary} />
      </Pressable>
    </View>
  );
}

export function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const a = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: value ? 1 : 0, duration: 160, useNativeDriver: false }).start();
  }, [value, a]);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => {
        haptic.select();
        onChange(!value);
      }}
      style={{ opacity: disabled ? 0.4 : 1, padding: 4 }}
    >
      <Animated.View
        style={[styles.toggle, { backgroundColor: a.interpolate({ inputRange: [0, 1], outputRange: ['#D9DBE5', C.primary] }) }]}
      >
        <Animated.View style={[styles.knob, { transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [2, 22] }) }] }]} />
      </Animated.View>
    </Pressable>
  );
}

export function Field({ label, style, icon, right, ...p }: TextInputProps & { label?: string; icon?: IconName; right?: ReactNode }) {
  return (
    <View style={style as StyleProp<ViewStyle>}>
      {label ? (
        <Txt v="small" style={{ marginBottom: 6, fontWeight: '700', color: C.ink }}>
          {label}
        </Txt>
      ) : null}
      <View style={styles.field}>
        {icon ? <Ionicons name={icon} size={20} color={C.muted} /> : null}
        <TextInput placeholderTextColor={C.faint} {...p} style={[styles.fieldInput, p.multiline && { minHeight: 90, textAlignVertical: 'top', paddingTop: 14 }]} />
        {right}
      </View>
    </View>
  );
}

export function Stars({ value, size = 14, onChange }: { value: number; size?: number; onChange?: (v: number) => void }) {
  return (
    <Row gap={onChange ? 8 : 1}>
      {[1, 2, 3, 4, 5].map((i) => {
        const name: IconName = value >= i ? 'star' : value >= i - 0.5 ? 'star-half' : 'star-outline';
        const icon = <Ionicons name={name} size={size} color={value >= i - 0.5 ? '#FFB800' : '#D0D3DE'} />;
        return onChange ? (
          <Pressable
            key={i}
            accessibilityLabel={`${i}`}
            onPress={() => {
              haptic.select();
              onChange(i);
            }}
            hitSlop={4}
          >
            {icon}
          </Pressable>
        ) : (
          <View key={i}>{icon}</View>
        );
      })}
    </Row>
  );
}

// ---------- feedback ----------

export function Skeleton({ w, h, r = R.md, style }: { w?: number | `${number}%`; h: number; r?: number; style?: StyleProp<ViewStyle> }) {
  const a = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(a, { toValue: 0.5, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [a]);
  return <Animated.View style={[{ width: w ?? '100%', height: h, borderRadius: r, backgroundColor: '#E6E8F0', opacity: a }, style]} />;
}

export function Empty({ emoji, title, sub, action, onAction, icon }: { emoji: string; title: string; sub?: string; action?: string; onAction?: () => void; icon?: IconName }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 10 }}>
      <View style={styles.emptyCircle}>
        <Text style={{ fontSize: 48 }}>{emoji}</Text>
      </View>
      <Txt v="h2" center>
        {title}
      </Txt>
      {sub ? (
        <Txt v="body" color={C.muted} center style={{ maxWidth: 360 }}>
          {sub}
        </Txt>
      ) : null}
      {action && onAction ? <Button title={action} onPress={onAction} icon={icon} style={{ marginTop: 10, minWidth: 220 }} /> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useT();
  return <Empty emoji="😕" title={t('error_title')} sub={errorText(error)} action={t('retry')} icon="refresh" onAction={onRetry} />;
}

/** Modals cover the root host, so an open Sheet renders its own host and the root one steps aside. */
export function ToastHost({ inSheet }: { inSheet?: boolean }) {
  const covered = useToast((s) => s.sheets > 0);
  if (covered && !inSheet) return null;
  return <ToastView />;
}

function ToastView() {
  const toast = useToast((s) => s.toast);
  const hide = useToast((s) => s.hide);
  const insets = useSafeAreaInsets();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!toast) return;
    a.setValue(0);
    Animated.spring(a, { toValue: 1, useNativeDriver: Platform.OS !== 'web', friction: 8 }).start();
    const h = setTimeout(() => {
      Animated.timing(a, { toValue: 0, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start(() => hide());
    }, 2600);
    return () => clearTimeout(h);
  }, [toast, a, hide]);
  if (!toast) return null;
  const icon: IconName = toast.kind === 'success' ? 'checkmark-circle' : toast.kind === 'error' ? 'alert-circle' : 'information-circle';
  const color = toast.kind === 'success' ? '#4ADE80' : toast.kind === 'error' ? '#FF8A80' : C.accent;
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-start', alignItems: 'center', paddingTop: insets.top + 10 }]}>
      <Animated.View
        style={[
          styles.toast,
          { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] },
        ]}
      >
        <Pressable onPress={hide} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name={icon} size={22} color={color} />
          <Text style={{ color: C.white, fontSize: 15, fontWeight: '600', flexShrink: 1 }}>{toast.text}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** Bottom sheet on phones, centered dialog on wide screens. */
export function Sheet({ visible, onClose, title, children, footer }: { visible: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const t = useT();
  const wide = width >= 760;
  useEffect(() => {
    if (!visible) return;
    useToast.getState().sheetDelta(1);
    return () => useToast.getState().sheetDelta(-1);
  }, [visible]);
  return (
    <Modal visible={visible} transparent animationType={wide ? 'fade' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.sheetBackdrop, wide && { justifyContent: 'center', alignItems: 'center' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('close')} />
        <View
          style={[
            styles.sheet,
            { maxHeight: height * 0.88, paddingBottom: Math.max(insets.bottom, 16) },
            wide && { width: 520, borderRadius: R.xxl },
          ]}
        >
          {!wide ? <View style={styles.grabber} /> : null}
          <Row style={{ paddingHorizontal: 20, paddingTop: wide ? 20 : 8, paddingBottom: 8 }}>
            <Txt v="h2" style={{ flex: 1 }}>
              {title}
            </Txt>
            <Pressable onPress={onClose} accessibilityLabel={t('close')} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={C.ink} />
            </Pressable>
          </Row>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>{footer}</View> : null}
        </View>
        <ToastHost inSheet />
      </View>
    </Modal>
  );
}

export function ListItem({
  icon,
  iconBg = C.primarySoft,
  iconColor = C.primary,
  title,
  sub,
  right,
  onPress,
  danger,
}: {
  icon: IconName;
  iconBg?: string;
  iconColor?: string;
  title: string;
  sub?: string;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={({ pressed }) => [styles.listItem, pressed && { backgroundColor: '#F8F8FC' }]}
    >
      <View style={[styles.listIcon, { backgroundColor: danger ? C.dangerSoft : iconBg }]}>
        <Ionicons name={icon} size={20} color={danger ? C.danger : iconColor} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt v="bodyBold" color={danger ? C.danger : C.ink} lines={2}>
          {title}
        </Txt>
        {sub ? (
          <Txt v="small" lines={2}>
            {sub}
          </Txt>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={C.faint} /> : null)}
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: MAX_W, alignSelf: 'center' },
  pagePad: { paddingHorizontal: 16 },
  header: { zIndex: 5 },
  headerSolid: { backgroundColor: C.bg },
  headerInner: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 12, paddingBottom: 8, minHeight: 56 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', ...shadow.sm },
  bottomBar: { backgroundColor: C.white, paddingTop: 12, borderTopLeftRadius: R.xxl, borderTopRightRadius: R.xxl, ...shadow.lg },
  card: { backgroundColor: C.card, borderRadius: R.xl, ...shadow.sm },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', ...shadow.sm },
  dotBadge: { position: 'absolute', top: -2, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: C.white },
  dotBadgeText: { color: C.white, fontSize: 10, fontWeight: '800' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 16, borderRadius: R.pill, backgroundColor: C.white, borderWidth: 1, borderColor: C.line },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontSize: 14, fontWeight: '700', color: C.ink },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 22, borderRadius: R.pill, alignSelf: 'flex-start' },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.primarySoft, borderRadius: R.pill },
  stepBtn: { height: '100%', alignItems: 'center', justifyContent: 'center' },
  stepQty: { minWidth: 28, textAlign: 'center', fontSize: 16, fontWeight: '800', color: C.primary },
  toggle: { width: 50, height: 30, borderRadius: 15, justifyContent: 'center' },
  knob: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.white, ...shadow.sm },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderRadius: R.lg, borderWidth: 1.5, borderColor: C.line, paddingHorizontal: 14, minHeight: 54 },
  fieldInput: { flex: 1, fontSize: 16, fontWeight: '600', color: C.ink, paddingVertical: 12, minWidth: 0, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}) },
  emptyCircle: { width: 104, height: 104, borderRadius: 52, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', marginBottom: 8, ...shadow.md },
  toast: { backgroundColor: 'rgba(15,18,34,0.94)', borderRadius: R.lg, paddingHorizontal: 18, paddingVertical: 14, maxWidth: 520, marginHorizontal: 16, ...shadow.lg },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(15,18,34,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: R.xxl, borderTopRightRadius: R.xxl, width: '100%', maxWidth: 640, alignSelf: 'center' },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#D5D7E0', marginTop: 10 },
  closeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12, minHeight: 64 },
  listIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
