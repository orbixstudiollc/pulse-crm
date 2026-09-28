/**
 * Design System Tokens
 *
 * Central token system for colors, spacing, typography, and other design primitives.
 * These tokens should be used throughout the component library for consistency.
 */

export const colors = {
  // Primary (Indigo)
  primary: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5', // Primary brand color
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
    950: '#1e1b4b',
  },

  // Success (Green)
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },

  // Warning (Amber)
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },

  // Error (Red)
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },

  // Info (Blue)
  info: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },

  // Neutral (Gray)
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0a0a0a',
  },
} as const;

export const spacing = {
  xs: '0.5rem',    // 8px
  sm: '0.75rem',   // 12px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
} as const;

export const borderRadius = {
  none: '0',
  sm: '0.25rem',   // 4px
  md: '0.375rem',  // 6px
  lg: '0.5rem',    // 8px
  xl: '0.75rem',   // 12px
  '2xl': '1rem',   // 16px
  full: '9999px',
} as const;

export const fontSize = {
  xs: '0.75rem',     // 12px
  sm: '0.875rem',    // 14px
  base: '1rem',      // 16px
  lg: '1.125rem',    // 18px
  xl: '1.25rem',     // 20px
  '2xl': '1.5rem',   // 24px
  '3xl': '1.875rem', // 30px
  '4xl': '2.25rem',  // 36px
} as const;

export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  focus: '0 0 0 3px rgba(79, 70, 229, 0.1)', // Indigo focus ring
} as const;

export const transitions = {
  fast: '150ms',
  base: '200ms',
  slow: '300ms',
  slower: '500ms',
} as const;

export const zIndex = {
  dropdown: 50,
  modal: 100,
  toast: 200,
  tooltip: 300,
} as const;

// Component-specific token maps
export const buttonVariants = {
  primary: {
    bg: colors.primary[600],
    hoverBg: colors.primary[700],
    activeBg: colors.primary[800],
    text: '#ffffff',
  },
  secondary: {
    bg: colors.neutral[100],
    hoverBg: colors.neutral[200],
    activeBg: colors.neutral[300],
    text: colors.neutral[900],
  },
  ghost: {
    bg: 'transparent',
    hoverBg: colors.neutral[100],
    activeBg: colors.neutral[200],
    text: colors.neutral[600],
  },
  danger: {
    bg: colors.error[600],
    hoverBg: colors.error[700],
    activeBg: colors.error[800],
    text: '#ffffff',
  },
} as const;

export const badgeVariants = {
  success: {
    bg: colors.success[100],
    border: colors.success[200],
    text: colors.success[700],
    dot: colors.success[500],
  },
  warning: {
    bg: colors.warning[100],
    border: colors.warning[200],
    text: colors.warning[700],
    dot: colors.warning[500],
  },
  error: {
    bg: colors.error[100],
    border: colors.error[200],
    text: colors.error[700],
    dot: colors.error[500],
  },
  info: {
    bg: colors.info[100],
    border: colors.info[200],
    text: colors.info[700],
    dot: colors.info[500],
  },
  neutral: {
    bg: colors.neutral[100],
    border: colors.neutral[200],
    text: colors.neutral[700],
    dot: colors.neutral[400],
  },
} as const;
