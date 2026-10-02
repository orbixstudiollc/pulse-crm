import type { CSSProperties } from 'react';

import type { useTheme } from 'src/insights/ui';

type Theme = ReturnType<typeof useTheme>;

export const borderColor = (theme: Theme) => (theme.dark ? '#333' : '#e5e7eb');

export const buttonStyle = (theme: Theme, busy: boolean): CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 6,
  border: `1px solid ${borderColor(theme)}`,
  background: theme.dark ? '#1f1f1f' : '#fff',
  color: theme.text,
  fontSize: 13,
  cursor: busy ? 'default' : 'pointer',
  opacity: busy ? 0.6 : 1,
});

export const sectionTitle: CSSProperties = { fontSize: 16, fontWeight: 600 };
