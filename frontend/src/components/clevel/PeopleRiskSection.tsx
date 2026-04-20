import { theme } from '../../styles/theme';
import type { PeopleRiskResponse } from '../../hooks/useAnalytics';
import { Avatar } from '../ui/Avatar';

const band = (b: number) => (b >= 75 ? 'high' : b >= 50 ? 'medium' : 'low');
const bandColor = (b: number) => {
  const v = band(b);
  return v === 'high' ? theme.colors.error : v === 'medium' ? theme.colors.warning : theme.colors.success;
};

export function PeopleRiskSection({ data }: { data: PeopleRiskResponse | undefined }) {
  if (!data) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: theme.colors.cadetGray, fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  const top = data.top_burnout || [];
  const busFactor = data.bus_factor || [];
  const busWarn = busFactor.filter((b) => b.bus <= 1);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 18 }}>
      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: theme.colors.cadetGray,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginBottom: 8,
          }}
        >
          Burnout risk (top {top.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {top.length === 0 && (
            <div
              style={{
                fontSize: 13,
                color: theme.colors.cadetGray,
                padding: 14,
                background: theme.colors.successLight,
                borderRadius: 6,
              }}
            >
              No one is overloaded.
            </div>
          )}
          {top.map((p) => {
            const col = bandColor(p.burnout);
            return (
              <div
                key={p.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '28px 1fr auto auto auto',
                  gap: 10,
                  alignItems: 'center',
                  padding: '7px 10px',
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.sm,
                }}
              >
                <Avatar name={p.name} size={26} />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: theme.colors.charcoal,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {p.name}
                  </div>
                  <div style={{ fontSize: 10, color: theme.colors.cadetGray }}>
                    {p.team_name || 'No team'} · {p.workload} open
                    {p.overdue > 0 && (
                      <span style={{ color: theme.colors.error, fontWeight: 600 }}> · {p.overdue} overdue</span>
                    )}
                    {p.criticals > 0 && (
                      <span style={{ color: theme.colors.error, fontWeight: 600 }}> · {p.criticals} crit</span>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    width: 110,
                    height: 6,
                    background: theme.colors.lightGray,
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ width: p.burnout + '%', height: '100%', background: col }} />
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: col,
                    minWidth: 34,
                    textAlign: 'right',
                    fontFamily: theme.typography.fontFamily.primary,
                  }}
                >
                  {p.burnout}
                </div>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: col,
                    background: col + '18',
                    padding: '2px 6px',
                    borderRadius: 3,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {band(p.burnout)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: theme.colors.cadetGray,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginBottom: 8,
          }}
        >
          Bus factor ≤ 1
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {busWarn.length === 0 && (
            <div
              style={{
                fontSize: 12,
                color: theme.colors.cadetGray,
                padding: 12,
                background: theme.colors.successLight,
                borderRadius: 6,
              }}
            >
              All teams have bus factor ≥ 2. ✓
            </div>
          )}
          {busWarn.map((b) => (
            <div
              key={b.team_id}
              style={{
                padding: 10,
                border: `1px solid ${theme.colors.error}30`,
                background: theme.colors.errorLight + '60',
                borderRadius: theme.borderRadius.sm,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: theme.colors.charcoal }}>{b.team_name}</div>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: theme.colors.error,
                    background: theme.colors.white,
                    padding: '2px 6px',
                    borderRadius: 3,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  bus {b.bus}
                </span>
              </div>
              <div style={{ fontSize: 11, color: theme.colors.davysGray }}>
                {b.top_person && (
                  <>
                    <b>{b.top_person}</b> holds {b.top_share}% of in-flight work.
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 14, padding: 12, background: theme.colors.background, borderRadius: 6 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: theme.colors.cadetGray,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              marginBottom: 6,
            }}
          >
            Bench overview
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
            <div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: theme.colors.error,
                  fontFamily: theme.typography.fontFamily.primary,
                }}
              >
                {data.counts.high}
              </div>
              <div style={{ fontSize: 10, color: theme.colors.cadetGray }}>at high risk</div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: theme.colors.warning,
                  fontFamily: theme.typography.fontFamily.primary,
                }}
              >
                {data.counts.elevated}
              </div>
              <div style={{ fontSize: 10, color: theme.colors.cadetGray }}>elevated</div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: theme.colors.success,
                  fontFamily: theme.typography.fontFamily.primary,
                }}
              >
                {data.counts.healthy}
              </div>
              <div style={{ fontSize: 10, color: theme.colors.cadetGray }}>healthy</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
