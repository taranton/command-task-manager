import styled from 'styled-components';
import { theme } from '../../styles/theme';

export const Card = styled.div<{ $padding?: number; $flex?: boolean }>`
  background: ${theme.colors.white};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.lg};
  padding: ${(p) => p.$padding ?? 22}px;
  box-shadow: ${theme.shadows.card};
  ${(p) => (p.$flex ? 'flex: 1;' : '')}
`;

export const SectionHead = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 14px;
  gap: 12px;
  flex-wrap: wrap;
`;

export const SectionTitle = styled.div`
  font-family: ${theme.typography.fontFamily.primary};
  font-size: 17px;
  font-weight: 700;
  color: ${theme.colors.charcoal};
  letter-spacing: -0.2px;
`;

export const SectionSubtitle = styled.div`
  font-size: 12px;
  color: ${theme.colors.cadetGray};
  margin-top: 2px;
`;

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <SectionHead>
      <div style={{ minWidth: 0 }}>
        <SectionTitle>{title}</SectionTitle>
        {subtitle && <SectionSubtitle>{subtitle}</SectionSubtitle>}
      </div>
      {action}
    </SectionHead>
  );
}

// --- Segmented control ---
const SegWrap = styled.div`
  display: inline-flex;
  background: ${theme.colors.background};
  border-radius: ${theme.borderRadius.md};
  padding: 2px;
  border: 1px solid ${theme.colors.border};
`;

const SegBtn = styled.button<{ $active: boolean }>`
  padding: 6px 14px;
  border-radius: ${theme.borderRadius.sm};
  font-size: 12px;
  font-weight: 600;
  background: ${(p) => (p.$active ? theme.colors.white : 'transparent')};
  color: ${(p) => (p.$active ? theme.colors.charcoal : theme.colors.cadetGray)};
  box-shadow: ${(p) => (p.$active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none')};
  border: none;
  cursor: pointer;
  transition: ${theme.transitions.default};
  font-family: ${theme.typography.fontFamily.secondary};
`;

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <SegWrap>
      {options.map((o) => (
        <SegBtn key={o.value} $active={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </SegBtn>
      ))}
    </SegWrap>
  );
}

// --- Delta indicator ---
export function Delta({ value, inverse = false }: { value: number; inverse?: boolean }) {
  const positive = inverse ? value < 0 : value > 0;
  const neutral = value === 0;
  const color = neutral ? theme.colors.cadetGray : positive ? theme.colors.success : theme.colors.error;
  const arrow = neutral ? '→' : value > 0 ? '↑' : '↓';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 600, color }}>
      <span>{arrow}</span>
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

// --- Sparkline with prior-period ghost + event markers ---
export interface SparkEvent {
  idx: number;
  kind: 'release' | 'incident' | 'hire';
  label: string;
}

export function Sparkline({
  data,
  prior,
  events,
  color,
  width = 180,
  height = 44,
}: {
  data: number[];
  prior?: number[];
  events?: SparkEvent[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (!data || !data.length) return null;
  const W = width,
    H = height,
    PAD = 3;
  const all = [...data, ...(prior || [])];
  const min = Math.min(...all),
    max = Math.max(...all);
  const range = max - min || 1;
  const stepX = (W - PAD * 2) / (data.length - 1);
  const y = (v: number) => PAD + (H - PAD * 2) * (1 - (v - min) / range);
  const path = (arr: number[]) =>
    arr.map((v, i) => (i === 0 ? 'M' : 'L') + (PAD + i * stepX).toFixed(1) + ',' + y(v).toFixed(1)).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
      {prior && (
        <path
          d={path(prior)}
          stroke={theme.colors.cadetGray}
          strokeWidth={1.2}
          fill="none"
          opacity={0.35}
          strokeDasharray="3,3"
        />
      )}
      <path
        d={path(data) + ` L${(PAD + (data.length - 1) * stepX).toFixed(1)},${H - PAD} L${PAD},${H - PAD} Z`}
        fill={color}
        opacity={0.1}
      />
      <path d={path(data)} stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {events &&
        events.map((e, i) => {
          const x = PAD + e.idx * stepX;
          const markY = y(data[e.idx] ?? data[data.length - 1]);
          const col =
            e.kind === 'release' ? theme.colors.success : e.kind === 'incident' ? theme.colors.error : theme.colors.info;
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={PAD} y2={H - PAD} stroke={col} strokeWidth={1} opacity={0.35} strokeDasharray="2,2" />
              <circle cx={x} cy={markY} r={3} fill={col} stroke="white" strokeWidth={1.5}>
                <title>
                  {e.kind}: {e.label}
                </title>
              </circle>
            </g>
          );
        })}
      <circle cx={PAD + (data.length - 1) * stepX} cy={y(data[data.length - 1])} r={2.5} fill={color} />
    </svg>
  );
}

// --- Legend dot (for chart legends) ---
export function LegendDot({
  color,
  label,
  dashed,
  solid,
}: {
  color: string;
  label: string;
  dashed?: boolean;
  solid?: boolean;
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      {dashed ? (
        <svg width={14} height={3}>
          <line x1={0} y1={1.5} x2={14} y2={1.5} stroke={color} strokeWidth={1.5} strokeDasharray="3,3" />
        </svg>
      ) : solid ? (
        <span style={{ width: 10, height: 6, background: color, opacity: 0.6, borderRadius: 1, display: 'inline-block' }} />
      ) : (
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
      )}
      {label}
    </span>
  );
}

// --- Stacked bar (office status breakdown) ---
export function StatusStackBar({
  segments,
  height = 12,
}: {
  segments: { label: string; value: number; color: string }[];
  height?: number;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height,
        borderRadius: 6,
        overflow: 'hidden',
        background: theme.colors.lightGray,
      }}
    >
      {segments.map((s, i) => (
        <div
          key={i}
          title={`${s.label}: ${s.value}`}
          style={{ width: (s.value / total) * 100 + '%', background: s.color, transition: 'width .3s ease' }}
        />
      ))}
    </div>
  );
}

// --- AvatarStack ---
export function AvatarStack({
  names,
  max = 3,
  size = 22,
}: {
  names: string[];
  max?: number;
  size?: number;
}) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  const bg = (n: string) => {
    const h = n.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const hues = [18, 34, 210, 265, 150, 340, 180];
    return `oklch(0.62 0.11 ${hues[h % hues.length]})`;
  };
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
      {shown.map((n, i) => {
        const initials = n
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();
        return (
          <div
            key={i}
            title={n}
            style={{
              marginLeft: i === 0 ? 0 : -6,
              width: size,
              height: size,
              borderRadius: '50%',
              background: bg(n),
              color: 'white',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: Math.max(9, size * 0.38),
              fontWeight: 600,
              border: '1.5px solid white',
              boxShadow: '0 0 0 1px rgba(0,0,0,0.04)',
            }}
          >
            {initials}
          </div>
        );
      })}
      {rest > 0 && (
        <div
          style={{
            marginLeft: -6,
            width: size,
            height: size,
            borderRadius: '50%',
            background: theme.colors.lightGray,
            color: theme.colors.davysGray,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 600,
            border: '1.5px solid white',
          }}
        >
          +{rest}
        </div>
      )}
    </div>
  );
}

// --- Status / priority pills (dashboard-local to match design look) ---
export function StatusPill({ status }: { status: string }) {
  const bg = theme.colors.statusLight[status] || theme.colors.lightGray;
  const fg = theme.colors.status[status] || theme.colors.mediumGray;
  const label =
    ({
      backlog: 'Backlog',
      to_do: 'To Do',
      in_progress: 'In Progress',
      in_review: 'In Review',
      done: 'Done',
      closed: 'Closed',
      active: 'Active',
    } as Record<string, string>)[status] || status;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: theme.borderRadius.pill,
        fontSize: 11,
        fontWeight: 600,
        background: bg,
        color: fg,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: fg }} />
      {label}
    </span>
  );
}

export function PriorityPill({ priority }: { priority: string }) {
  const color = (theme.colors.priority as Record<string, string>)[priority] || theme.colors.cadetGray;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: theme.borderRadius.pill,
        fontSize: 10,
        fontWeight: 700,
        background: color + '18',
        color,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {priority}
    </span>
  );
}
