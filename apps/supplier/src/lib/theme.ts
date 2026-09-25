import { Platform } from 'react-native';
import { BRAND } from '@taptym/shared';

export const C = {
  primary: BRAND.primary,
  primaryDark: BRAND.primaryDark,
  primarySoft: '#EEEAFF',
  primaryTint: '#F6F4FF',
  accent: BRAND.accent,
  ink: BRAND.ink,
  ink2: '#343849',
  muted: BRAND.muted,
  faint: '#9A9EB0',
  line: BRAND.line,
  bg: '#F4F5F9',
  card: '#FFFFFF',
  success: BRAND.success,
  successSoft: '#E6F7EE',
  danger: BRAND.danger,
  dangerSoft: '#FDECEA',
  warning: BRAND.warning,
  warningSoft: '#FEF2E1',
  info: '#2E90FA',
  infoSoft: '#E6F1FE',
};

export const R = { sm: 12, md: 16, lg: 20, xl: 28, pill: 999 };

export const FONT = Platform.select({
  web: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  default: undefined,
});

export const shadow = {
  soft: { boxShadow: '0px 1px 2px rgba(16, 24, 40, 0.04), 0px 6px 20px rgba(16, 24, 40, 0.06)' },
  lift: { boxShadow: '0px 2px 4px rgba(16, 24, 40, 0.05), 0px 16px 40px rgba(16, 24, 40, 0.10)' },
  primary: { boxShadow: '0px 10px 24px rgba(91, 60, 245, 0.30)' },
} as const;

export const MAX_W = 1100;
export const WIDE = 900;
