import { theme } from '../../styles/theme';

export interface BurndownData {
  dates: string[];
  open: number[];
  ideal: number[];
  throughput: number[];
}

export function BurndownChart({ data }: { data: BurndownData }) {
  const { open, ideal, throughput, dates } = data;
  const days = open.length;
  if (days === 0) return null;

  const W = 680,
    H = 220,
    PAD = { l: 36, r: 16, t: 12, b: 28 };
  const cw = W - PAD.l - PAD.r,
    ch = H - PAD.t - PAD.b;
  const maxV = Math.max(...open, ...ideal) * 1.1 || 1;
  const stepX = cw / Math.max(days - 1, 1);
  const xy = (arr: number[]) => arr.map((v, i) => [PAD.l + i * stepX, PAD.t + ch - (v / maxV) * ch] as [number, number]);
  const path = (pts: [number, number][]) =>
    pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const idealPts = xy(ideal);
  const openPts = xy(open);

  const thMax = Math.max(...throughput, 1);
  const thBarW = stepX * 0.55;
  const thH = 44;
  const thLabelY = PAD.t + ch + 30;
  const thBarBase = PAD.t + ch + thH + 24;
  const thBarMax = thH - 14;

  const fmtLabel = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <svg viewBox={`0 0 ${W} ${H + thH + 24}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <g key={i}>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={PAD.t + ch * f}
            y2={PAD.t + ch * f}
            stroke={theme.colors.border}
            strokeDasharray={i === 0 || i === 4 ? '0' : '3,3'}
          />
          <text x={PAD.l - 6} y={PAD.t + ch * f + 3} textAnchor="end" fontSize={10} fill={theme.colors.cadetGray}>
            {Math.round(maxV * (1 - f))}
          </text>
        </g>
      ))}

      <path d={path(idealPts)} stroke={theme.colors.cadetGray} strokeWidth={1.5} fill="none" strokeDasharray="5,4" />

      <path
        d={path(openPts) + ` L${openPts[openPts.length - 1][0]},${PAD.t + ch} L${PAD.l},${PAD.t + ch} Z`}
        fill={theme.colors.vividOrange}
        opacity={0.12}
      />
      <path d={path(openPts)} stroke={theme.colors.vividOrange} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <circle
        cx={openPts[openPts.length - 1][0]}
        cy={openPts[openPts.length - 1][1]}
        r={4}
        fill={theme.colors.vividOrange}
        stroke="white"
        strokeWidth={2}
      />

      {open.map((_, i) =>
        i % Math.max(1, Math.ceil(days / 6)) === 0 || i === days - 1 ? (
          <text
            key={i}
            x={PAD.l + i * stepX}
            y={PAD.t + ch + 16}
            textAnchor="middle"
            fontSize={10}
            fill={theme.colors.cadetGray}
          >
            {fmtLabel(dates[i])}
          </text>
        ) : null,
      )}

      <text
        x={PAD.l}
        y={thLabelY}
        fontSize={9}
        fill={theme.colors.cadetGray}
        fontWeight={600}
        style={{ letterSpacing: 0.5, textTransform: 'uppercase' }}
      >
        tasks completed / day
      </text>

      {throughput.map((v, i) => {
        const barHeight = (v / thMax) * thBarMax;
        return (
          <rect
            key={i}
            x={PAD.l + i * stepX - thBarW / 2}
            y={thBarBase - barHeight}
            width={thBarW}
            height={barHeight}
            fill={theme.colors.charcoal}
            opacity={0.55}
            rx={1.5}
          />
        );
      })}
    </svg>
  );
}
