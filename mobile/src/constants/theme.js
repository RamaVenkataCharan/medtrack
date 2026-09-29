export const COLORS = {
  // Canvas & Surfaces — warm ivory base
  background: '#FAF7F2',       // Warm ivory canvas
  warmWhite: '#FFFCF8',        // Warm white card surface
  surface: '#FFFCF8',          // Card / input surface
  surfaceSubtle: '#FFF5EE',    // Soft peach surface
  border: '#E8E0D8',           // Warm hairline border
  borderStrong: '#D1C7BC',     // High-contrast divider
  borderSubtle: '#F2EDE6',

  // Ink Typography (Optimized for 40+ readability)
  text: '#263238',             // Dark charcoal ink
  textPrimary: '#263238',      // Dark charcoal ink
  textSecondary: '#667085',    // Muted gray ink
  textTertiary: '#8A9099',     // Soft timestamp / caption ink
  textMuted: '#667085',        // Muted gray alias
  textInverted: '#FFFFFF',

  // Terracotta Brand Accent
  primary: '#C65D35',          // Terracotta: headers, main CTAs
  primaryDark: '#A44D2B',
  primaryLight: '#FFF0E8',
  primaryBorder: '#E8A88C',
  secondary: '#D97B56',        // Lighter terracotta: secondary accents
  secondaryLight: '#FFF5EE',

  // Avatar warm tones
  avatarBg: '#F5DDD0',         // Light salmon avatar background
  avatarBorder: '#E8A88C',     // Terracotta avatar border

  // Due & Payment Badges
  dueBadgeBg: '#FEF2F2',
  dueBadgeText: '#DC2626',
  dueBadgeBorder: '#FECACA',

  clearBadgeBg: '#F0FDF4',
  clearBadgeText: '#16A34A',
  clearBadgeBorder: '#BBF7D0',

  paymentCardBg: '#F0FDF4',
  paymentCardBorder: '#BBF7D0',
  paymentGreen: '#16A34A',
  paymentGreenLight: '#F0FDF4',

  // System Feedback
  success: '#16A34A',
  successLight: '#F0FDF4',
  warning: '#B45309',
  warningBg: '#FEF3C7',
  warningBorder: '#FCD34D',
  error: '#DC2626',
  errorLight: '#FEF2F2',
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
  // Semantic layout spacing tokens
  tiny: 4,
  gap: 8,
  card: 12,
  edge: 16,
};

export const INPUT_HEIGHT = 48;
export const MAX_FONT_SCALE = 1.3;

export const LAYOUT = {
  edgePadding: 16,
  cardPadding: 12,
  gap: 8,
  inputHeight: 48,
  customerCardHeight: 80,
  maxFontScale: 1.3,
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
