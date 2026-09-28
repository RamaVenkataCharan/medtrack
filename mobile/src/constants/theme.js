export const COLORS = {
  // Canvas & Surfaces
  background: '#FAF7F2',       // Warm white / ivory canvas
  warmWhite: '#FFFCF8',        // Pure warm card surface
  surface: '#FFFFFF',          // Card paper
  surfaceSubtle: '#F9EEE7',    // Soft peach surface
  border: '#E8E2D9',           // Ruled hairline border
  borderStrong: '#D6CDBD',     // High-contrast divider
  borderSubtle: '#F0EAE1',

  // Ink Typography (Optimized for 40+ readability)
  text: '#263238',             // Deep charcoal ink
  textPrimary: '#263238',      // Deep charcoal ink
  textSecondary: '#667085',    // Muted grey ink
  textTertiary: '#8F9BB3',     // Soft timestamp / caption ink
  textMuted: '#667085',        // Muted grey alias
  textInverted: '#FFFFFF',

  // Terracotta Brand Accent
  primary: '#C65D35',          // Authentic terracotta
  primaryDark: '#A54622',
  primaryLight: '#FDF0EC',
  primaryBorder: '#F2C8BC',
  softPeach: '#F9EEE7',

  // Due & Payment Badges (Clean & accessible)
  dueBadgeBg: '#FEF3C7',       // Warm pale amber
  dueBadgeText: '#92400E',
  dueBadgeBorder: '#FCD34D',

  clearBadgeBg: '#F3F4F6',     // Calm light slate
  clearBadgeText: '#4B5563',
  clearBadgeBorder: '#E5E7EB',

  paymentCardBg: '#F0FDF4',     // Soft mint/sage for payment received
  paymentCardBorder: '#BBF7D0',
  paymentGreen: '#15803D',
  paymentGreenLight: '#DCFCE7',

  // System Feedback
  success: '#15803D',
  successLight: '#DCFCE7',
  warning: '#B45309',
  warningBg: '#FEF3C7',
  warningBorder: '#FCD34D',
  error: '#DC2626',
  errorLight: '#FDECE7',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  dangerBorder: '#FECACA',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const RADIUS = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 24,
  pill: 999,
  full: 999,
};

export const TYPOGRAPHY = {
  h1: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    color: COLORS.textPrimary,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  labelSmall: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textTertiary,
  },
};

export const FONTS = {
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 26,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  largeTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.4,
  },
  header: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    color: COLORS.textPrimary,
    lineHeight: 24,
  },
  bodyMedium: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textPrimary,
    lineHeight: 24,
  },
  bodyBold: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    lineHeight: 24,
  },
  bodySecondary: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 21,
  },
  subtext: {
    fontSize: 13,
    color: COLORS.textTertiary,
    lineHeight: 18,
  },
  caption: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
};

export const TOUCH_TARGETS = {
  minHeight: 48,
  minWidth: 48,
};

export const TOUCH_TARGET = TOUCH_TARGETS;
