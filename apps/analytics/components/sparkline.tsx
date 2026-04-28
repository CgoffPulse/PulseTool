/**
 * Minimal SVG sparkline. Self-contained so we don't have to ship a chart
 * library on every page — Recharts is reserved for the Ask page.
 */

interface SparklineProps {
  values: Array<number | null>;
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  ariaLabel?: string;
}

export function Sparkline({
  values,
  width = 220,
  height = 56,
  stroke = '#27452b',
  fill = 'rgba(232,158,80,0.18)',
  ariaLabel = 'sparkline',
}: SparklineProps) {
  const clean = values.map(v => (typeof v === 'number' && Number.isFinite(v) ? v : null));
  const numeric = clean.filter((v): v is number => v !== null);
  if (numeric.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-dashed border-cream-dk/60 bg-white/40 text-[11px] uppercase tracking-eyebrow text-charcoal/40"
        style={{ width, height }}
      >
        Not enough data
      </div>
    );
  }
  const min = Math.min(...numeric);
  const max = Math.max(...numeric);
  const range = max - min || 1;
  const stepX = clean.length > 1 ? width / (clean.length - 1) : width;

  const points = clean.map((v, i) => {
    const x = i * stepX;
    if (v === null) return { x, y: null };
    const y = height - ((v - min) / range) * (height - 6) - 3;
    return { x, y };
  });

  let d = '';
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.y === null) continue;
    if (d === '') d = `M${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    else d += ` L${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }

  let fillD = '';
  if (d) {
    const firstX = points.find(p => p.y !== null)?.x ?? 0;
    const lastX = [...points].reverse().find(p => p.y !== null)?.x ?? width;
    fillD = `${d} L${lastX.toFixed(1)},${height} L${firstX.toFixed(1)},${height} Z`;
  }

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
    >
      {fillD && <path d={fillD} fill={fill} stroke="none" />}
      <path d={d} stroke={stroke} strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
