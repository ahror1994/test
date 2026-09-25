import { Platform, type ViewStyle } from 'react-native';
import { BRAND } from '@taptym/shared';

export const C = {
  primary: BRAND.primary,
  primaryDark: BRAND.primaryDark,
  primarySoft: '#EFEBFF',
  accent: BRAND.accent,
  accentSoft: '#FFF7D1',
  accentInk: '#7A5B00',
  success: BRAND.success,
  successSoft: '#E4F8EE',
  successInk: '#067647',
  danger: BRAND.danger,
  dangerSoft: '#FEEDEC',
  warning: BRAND.warning,
  warningSoft: '#FEF3E2',
  ink: BRAND.ink,
  muted: BRAND.muted,
  faint: '#A3A7B8',
  line: BRAND.line,
  surface: BRAND.surface,
  bg: '#F6F7FB',
  card: '#FFFFFF',
  white: '#FFFFFF',
};

export const R = { sm: 12, md: 16, lg: 20, xl: 24, xxl: 28, pill: 999 };

export const MAX_W = 1100;

export const shadow = {
  sm: { boxShadow: '0px 1px 2px rgba(16,24,40,0.05), 0px 2px 8px rgba(16,24,40,0.04)' } as ViewStyle,
  md: { boxShadow: '0px 1px 2px rgba(16,24,40,0.04), 0px 8px 24px rgba(16,24,40,0.07)' } as ViewStyle,
  lg: { boxShadow: '0px 2px 4px rgba(16,24,40,0.05), 0px 18px 44px rgba(16,24,40,0.12)' } as ViewStyle,
  primary: { boxShadow: '0px 10px 24px rgba(91,60,245,0.32)' } as ViewStyle,
};

/** CSS gradient on web and on the new architecture; `fallback` stays as the solid background. */
export function gradient(css: string, fallback: string): ViewStyle {
  return Platform.OS === 'web'
    ? ({ backgroundColor: fallback, backgroundImage: css } as ViewStyle)
    : ({ backgroundColor: fallback, experimental_backgroundImage: css } as ViewStyle);
}

export function gridColumns(contentWidth: number) {
  if (contentWidth < 520) return 2;
  if (contentWidth < 760) return 3;
  if (contentWidth < 1000) return 4;
  return 5;
}
