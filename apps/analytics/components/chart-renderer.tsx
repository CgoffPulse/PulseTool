import type { ChartSpec } from '@/lib/types';
import { formatNumber } from '@/lib/format';

/**
 * Renders a typed chart spec. For MVP we render a `<table>` for
 * `chart_type='table'` and a hand-rolled SVG for line/bar/scatter.
 *
 * The data series live on `spec.data` — when missing we still render the
 * spec metadata so the user sees the chart pick rationale.
 */
export function ChartRenderer({ spec }: { spec: ChartSpec }) {
  const data = (spec.data ?? []) as Array<Record<string, string | number | null>>;

  return (
    <div className="panel p-6">
      <span className="eyebrow">{spec.chart_type}</span>
      <h3 className="mt-2 font-display text-2xl font-bold text-green-deep">
        {spec.title}
      </h3>
      <p className="mt-1 text-sm text-charcoal/65">{spec.explanation}</p>

      <div className="mt-4">
        {spec.chart_type === 'table' || data.length === 0 ? (
          <DataTable rows={data} xKey={spec.x_axis} yKey={spec.y_axis} />
        ) : spec.chart_type === 'bar' ? (
          <BarSvg rows={data} xKey={spec.x_axis} yKey={spec.y_axis} />
        ) : (
          <LineSvg rows={data} xKey={spec.x_axis} yKey={spec.y_axis} />
        )}
      </div>
    </div>
  );
}

function getNum(row: Record<string, unknown>, key: string): number | null {
  const v = row[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function DataTable({
  rows,
  xKey,
  yKey,
}: {
  rows: Array<Record<string, string | number | null>>;
  xKey: string;
  yKey: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-charcoal/55">
        No data was returned with this spec — the AI suggested the visualization shape only.
      </p>
    );
  }
  const headers = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto rounded-md border border-cream-dk/50">
      <table className="min-w-full text-sm">
        <thead className="bg-cream-lt/60">
          <tr className="text-left text-[11px] uppercase tracking-eyebrow text-charcoal/55">
            {headers.map(h => (
              <th key={h} className="px-3 py-2">
                {h === xKey ? `${h} (x)` : h === yKey ? `${h} (y)` : h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-cream-dk/40">
              {headers.map(h => (
                <td key={h} className="px-3 py-2 tabular-nums text-charcoal/85">
                  {String(r[h] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LineSvg({
  rows,
  xKey,
  yKey,
}: {
  rows: Array<Record<string, string | number | null>>;
  xKey: string;
  yKey: string;
}) {
  const series = rows
    .map(r => ({
      x: String(r[xKey] ?? ''),
      y: getNum(r, yKey),
    }))
    .filter(p => p.y !== null) as Array<{ x: string; y: number }>;
  if (series.length < 2) {
    return <DataTable rows={rows} xKey={xKey} yKey={yKey} />;
  }

  const w = 720;
  const h = 240;
  const pad = { l: 40, r: 16, t: 12, b: 28 };
  const yVals = series.map(p => p.y);
  const yMin = Math.min(...yVals);
  const yMax = Math.max(...yVals);
  const yRange = yMax - yMin || 1;
  const stepX = (w - pad.l - pad.r) / (series.length - 1);
  const points = series.map((p, i) => ({
    x: pad.l + i * stepX,
    y: pad.t + (h - pad.t - pad.b) * (1 - (p.y - yMin) / yRange),
  }));
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="line chart">
      <line x1={pad.l} y1={h - pad.b} x2={w - pad.r} y2={h - pad.b} stroke="#d9c4ac" />
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={h - pad.b} stroke="#d9c4ac" />
      <text x={pad.l} y={pad.t + 4} fontSize="10" fill="#2a2a28">
        {formatNumber(yMax)}
      </text>
      <text x={pad.l} y={h - pad.b - 4} fontSize="10" fill="#2a2a28">
        {formatNumber(yMin)}
      </text>
      <path d={d} stroke="#27452b" strokeWidth={2} fill="none" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#c96f1f" />
      ))}
      {[0, Math.floor(series.length / 2), series.length - 1].map(i => (
        <text
          key={i}
          x={pad.l + i * stepX}
          y={h - pad.b + 16}
          fontSize="10"
          textAnchor="middle"
          fill="#2a2a28"
        >
          {series[i]?.x.slice(0, 10)}
        </text>
      ))}
    </svg>
  );
}

function BarSvg({
  rows,
  xKey,
  yKey,
}: {
  rows: Array<Record<string, string | number | null>>;
  xKey: string;
  yKey: string;
}) {
  const series = rows
    .map(r => ({
      x: String(r[xKey] ?? ''),
      y: getNum(r, yKey),
    }))
    .filter(p => p.y !== null) as Array<{ x: string; y: number }>;
  if (series.length === 0) {
    return <DataTable rows={rows} xKey={xKey} yKey={yKey} />;
  }
  const w = 720;
  const h = 240;
  const pad = { l: 40, r: 16, t: 12, b: 40 };
  const yMax = Math.max(...series.map(p => p.y), 1);
  const barW = (w - pad.l - pad.r) / series.length - 4;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="bar chart">
      <line x1={pad.l} y1={h - pad.b} x2={w - pad.r} y2={h - pad.b} stroke="#d9c4ac" />
      {series.map((p, i) => {
        const barH = (h - pad.t - pad.b) * (p.y / yMax);
        return (
          <g key={i}>
            <rect
              x={pad.l + i * (barW + 4)}
              y={h - pad.b - barH}
              width={barW}
              height={barH}
              fill="#27452b"
            />
            <text
              x={pad.l + i * (barW + 4) + barW / 2}
              y={h - pad.b + 14}
              fontSize="10"
              textAnchor="middle"
              fill="#2a2a28"
            >
              {p.x.slice(0, 8)}
            </text>
          </g>
        );
      })}
      <text x={pad.l} y={pad.t + 4} fontSize="10" fill="#2a2a28">
        {formatNumber(yMax)}
      </text>
    </svg>
  );
}
