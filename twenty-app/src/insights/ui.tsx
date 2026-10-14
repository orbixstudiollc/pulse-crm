import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useColorScheme } from 'twenty-sdk/front-component';

import { capBuckets, type Bucket, type LeadRecord, type OpportunityRecord } from 'src/insights/aggregations';
import { fetchAllRecords } from 'src/insights/fetch-records';

// Shared building blocks for the Overview and Analytics widgets. Every widget
// fills its grid cell exactly: rows share the height with flex and text sizes
// follow the container (cqh/cqw), so nothing ever scrolls.

export type InsightsData = { people: LeadRecord[]; opportunities: OpportunityRecord[] };

type Need = { people?: boolean; opportunities?: boolean };

export const useInsightsData = (need: Need) => {
  const [data, setData] = useState<InsightsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([
      need.people ? fetchAllRecords<LeadRecord>('people') : Promise.resolve([]),
      need.opportunities ? fetchAllRecords<OpportunityRecord>('opportunities') : Promise.resolve([]),
    ])
      .then(([people, opportunities]) => alive && setData({ people, opportunities }))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Could not load data'));
    return () => {
      alive = false;
    };
  }, [need.people, need.opportunities]);
  return { data, error };
};

const PALETTE: Record<string, { light: string; dark: string }> = {
  gray: { light: '#9ca3af', dark: '#6b7280' },
  red: { light: '#ef4444', dark: '#f87171' },
  orange: { light: '#f97316', dark: '#fb923c' },
  amber: { light: '#f59e0b', dark: '#fbbf24' },
  yellow: { light: '#eab308', dark: '#facc15' },
  green: { light: '#22c55e', dark: '#4ade80' },
  sky: { light: '#0ea5e9', dark: '#38bdf8' },
  blue: { light: '#3b82f6', dark: '#60a5fa' },
  iris: { light: '#6366f1', dark: '#818cf8' },
  purple: { light: '#a855f7', dark: '#c084fc' },
};

export const useTheme = () => {
  const dark = useColorScheme() === 'dark';
  return {
    dark,
    text: dark ? '#e5e7eb' : '#1f2937',
    muted: dark ? '#9ca3af' : '#6b7280',
    track: dark ? '#262626' : '#f3f4f6',
    accent: dark ? '#818cf8' : '#4f46e5',
    color: (name?: string) => (PALETTE[name ?? 'iris'] ?? PALETTE.iris)[dark ? 'dark' : 'light'],
  };
};

const frame: CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  padding: '8px 12px',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'inherit',
  containerType: 'size',
};

export const Frame = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ ...frame, ...style }}>{children}</div>
);

export const Status = ({ error, empty }: { error?: string | null; empty?: string }) => {
  const theme = useTheme();
  return (
    <Frame style={{ alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: error ? theme.color('red') : theme.muted, fontSize: 13, textAlign: 'center' }}>
        {error ?? empty ?? 'Loading…'}
      </span>
    </Frame>
  );
};

/** Horizontal bars; rows split the height evenly so any row count fits. */
export const BarList = ({
  buckets,
  measure = 'count',
  format = (n) => String(n),
  detail,
  maxRows = 8,
}: {
  buckets: Bucket[];
  measure?: 'count' | 'value';
  format?: (n: number) => string;
  detail?: (b: Bucket) => string;
  maxRows?: number;
}) => {
  const theme = useTheme();
  const rows = capBuckets(buckets, maxRows);
  const max = Math.max(1, ...rows.map((b) => b[measure]));
  if (rows.every((b) => b.count === 0)) return <Status empty="No data yet" />;
  return (
    <Frame style={{ gap: 4 }}>
      {rows.map((b) => (
        <div
          key={b.key}
          style={{ flex: '1 1 0', minHeight: 0, maxHeight: 40, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <span
            style={{
              width: '28%',
              flexShrink: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: theme.text,
              fontSize: 'clamp(10px, 6cqh, 13px)',
            }}
          >
            {b.label}
          </span>
          <div style={{ flex: 1, height: '60%', maxHeight: 18, background: theme.track, borderRadius: 4 }}>
            <div
              style={{
                width: `${(b[measure] / max) * 100}%`,
                height: '100%',
                borderRadius: 4,
                background: theme.color(b.color),
              }}
            />
          </div>
          <span
            style={{
              width: '22%',
              flexShrink: 0,
              textAlign: 'right',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: theme.muted,
              fontSize: 'clamp(10px, 6cqh, 13px)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {format(b[measure])}
            {detail ? ` · ${detail(b)}` : ''}
          </span>
        </div>
      ))}
    </Frame>
  );
};

/** Big-number tiles laid out in one row that shares the width. */
export const KpiRow = ({ tiles }: { tiles: { label: string; value: string; hint?: string; tone?: string }[] }) => {
  const theme = useTheme();
  return (
    <Frame style={{ flexDirection: 'row', gap: 12, alignItems: 'stretch' }}>
      {tiles.map((t) => (
        <div
          key={t.label}
          style={{
            flex: '1 1 0',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 2,
            overflow: 'hidden',
          }}
        >
          <span style={{ color: theme.muted, fontSize: 'clamp(10px, 14cqh, 13px)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {t.label}
          </span>
          <span
            style={{
              color: t.tone ? theme.color(t.tone) : theme.text,
              fontSize: 'clamp(16px, 30cqh, 28px)',
              fontWeight: 600,
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {t.value}
          </span>
          {t.hint ? (
            <span style={{ color: theme.muted, fontSize: 'clamp(9px, 11cqh, 12px)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {t.hint}
            </span>
          ) : null}
        </div>
      ))}
    </Frame>
  );
};

/** Vertical columns, one per period; heights scale to the tallest. */
export const ColumnChart = ({ points }: { points: { label: string; count: number }[] }) => {
  const theme = useTheme();
  const max = Math.max(1, ...points.map((p) => p.count));
  return (
    <Frame style={{ flexDirection: 'row', alignItems: 'stretch', gap: 6 }}>
      {points.map((p) => (
        <div key={p.label} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ textAlign: 'center', color: theme.text, fontSize: 'clamp(9px, 6cqh, 12px)' }}>{p.count}</span>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'flex-end' }}>
            <div
              style={{
                width: '100%',
                height: `${Math.max(2, (p.count / max) * 100)}%`,
                background: theme.accent,
                borderRadius: '4px 4px 0 0',
              }}
            />
          </div>
          <span
            style={{
              textAlign: 'center',
              color: theme.muted,
              fontSize: 'clamp(8px, 5cqh, 11px)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {p.label}
          </span>
        </div>
      ))}
    </Frame>
  );
};
