import { theme } from '../../styles/theme';
import type { KPIValue } from '../../hooks/useAnalytics';

export function PeriodCompareTable({
  current,
  prior,
  days,
}: {
  current: KPIValue;
  prior: KPIValue;
  days: number;
}) {
  const rows: { key: keyof KPIValue; label: string; unit: string; inverse: boolean }[] = [
    { key: 'completion', label: 'Completion Rate', unit: '%', inverse: false },
    { key: 'velocity', label: 'Velocity', unit: '/wk', inverse: false },
    { key: 'cycle_days', label: 'Cycle Time', unit: 'd', inverse: true },
    { key: 'overdue_pct', label: 'Overdue Rate', unit: '%', inverse: true },
    { key: 'utilization', label: 'Resource Util.', unit: '%', inverse: false },
  ];

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.6fr) minmax(56px, 1fr) minmax(56px, 1fr) minmax(64px, 1fr)',
          gap: 10,
          fontSize: 10,
          fontWeight: 700,
          color: theme.colors.cadetGray,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          paddingBottom: 8,
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <div>Metric</div>
        <div style={{ textAlign: 'right' }}>Prior {days}d</div>
        <div style={{ textAlign: 'right' }}>This {days}d</div>
        <div style={{ textAlign: 'right' }}>Δ</div>
      </div>
      {rows.map((r) => {
        const tv = current[r.key];
        const pv = prior[r.key];
        const abs = +(Number(tv) - Number(pv)).toFixed(1);
        const pct = pv ? +((abs / Number(pv)) * 100).toFixed(1) : 0;
        const good = r.inverse ? abs < 0 : abs > 0;
        const col = abs === 0 ? theme.colors.cadetGray : good ? theme.colors.success : theme.colors.error;
        return (
          <div
            key={r.key}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.6fr) minmax(56px, 1fr) minmax(56px, 1fr) minmax(64px, 1fr)',
              gap: 10,
              alignItems: 'center',
              padding: '10px 0',
              borderBottom: `1px solid ${theme.colors.border}`,
              fontSize: 13,
            }}
          >
            <div style={{ fontWeight: 600, color: theme.colors.charcoal }}>{r.label}</div>
            <div style={{ textAlign: 'right', color: theme.colors.cadetGray }}>
              {pv}
              <span style={{ fontSize: 10, marginLeft: 2 }}>{r.unit}</span>
            </div>
            <div
              style={{
                textAlign: 'right',
                color: theme.colors.charcoal,
                fontWeight: 700,
                fontFamily: theme.typography.fontFamily.primary,
              }}
            >
              {tv}
              <span style={{ fontSize: 10, fontWeight: 500, color: theme.colors.cadetGray, marginLeft: 2 }}>
                {r.unit}
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 11,
                  fontWeight: 700,
                  color: col,
                  background: col + '14',
                  padding: '2px 7px',
                  borderRadius: 10,
                }}
              >
                {abs > 0 ? '▲' : abs < 0 ? '▼' : '·'} {Math.abs(pct)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
