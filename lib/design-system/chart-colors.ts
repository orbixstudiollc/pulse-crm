// Chart colours as CSS variables (styles/globals.css). Recharts passes these
// straight into SVG presentation attributes, so they follow the theme without
// reading computed styles.
export const chartSeries = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"] as const;
export const chartAccent = chartSeries[0];
export const chartSuccess = chartSeries[1];
export const chartWarning = chartSeries[2];
export const chartDanger = chartSeries[3];
export const chartNeutral = chartSeries[4];
export const chartGrid = "var(--chart-grid)";
export const chartAxis = "var(--chart-axis)";
export const chartSurface = "var(--surface)";
export const chartTooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  color: "var(--fg)",
  fontSize: 12,
  padding: "6px 8px",
} as const;
export const axisTick = { fontSize: 12, fill: "var(--chart-axis)" } as const;
