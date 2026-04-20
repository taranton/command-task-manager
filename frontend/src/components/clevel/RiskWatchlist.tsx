import { useState } from 'react';
import { theme } from '../../styles/theme';
import type { Risk } from '../../hooks/useAnalytics';
import { PriorityPill } from './primitives';
import { Avatar } from '../ui/Avatar';

const sevColor = (s: string) =>
  s === 'critical' ? theme.colors.error : s === 'high' ? theme.colors.warning : theme.colors.info;

export function RiskWatchlist({
  risks,
  view = 'list',
  onOpenTask,
}: {
  risks: Risk[];
  view?: 'list' | 'triage';
  onOpenTask?: (risk: Risk) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  if (!risks || risks.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: 'center',
          color: theme.colors.cadetGray,
          fontSize: 13,
          background: theme.colors.successLight,
          borderRadius: theme.borderRadius.md,
        }}
      >
        All clear — no risks flagged in this scope.
      </div>
    );
  }

  if (view === 'triage') return <TriageColumns risks={risks} onOpenTask={onOpenTask} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {risks.map((r) => (
        <div
          key={r.task_id}
          onClick={() => onOpenTask && onOpenTask(r)}
          onMouseEnter={() => setHovered(r.task_id)}
          onMouseLeave={() => setHovered(null)}
          style={{
            display: 'flex',
            gap: 12,
            padding: 12,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.borderRadius.md,
            cursor: onOpenTask ? 'pointer' : 'default',
            background: hovered === r.task_id ? theme.colors.background : theme.colors.white,
            transition: theme.transitions.default,
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              width: 4,
              alignSelf: 'stretch',
              borderRadius: 2,
              background: sevColor(r.severity),
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  color: sevColor(r.severity),
                  background: sevColor(r.severity) + '18',
                  padding: '2px 6px',
                  borderRadius: 3,
                }}
              >
                {r.severity}
              </span>
              <span style={{ fontSize: 11, color: theme.colors.cadetGray }}>
                {r.office || '—'} · {r.team_name || '—'}
              </span>
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: theme.colors.charcoal,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {r.title}
            </div>
            <div
              style={{
                fontSize: 12,
                color: theme.colors.davysGray,
                lineHeight: 1.5,
                marginTop: 4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {r.reason}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              {r.assignee && <Avatar name={r.assignee} size={18} />}
              {r.assignee && <span style={{ fontSize: 11, color: theme.colors.cadetGray }}>{r.assignee}</span>}
              <span style={{ fontSize: 11, color: theme.colors.cadetGray }}>·</span>
              <PriorityPill priority={r.priority} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TriageColumns({ risks, onOpenTask }: { risks: Risk[]; onOpenTask?: (risk: Risk) => void }) {
  const today = new Date();
  const bucket = (r: Risk): 'act' | 'week' | 'monitor' => {
    const deadline = r.deadline ? new Date(r.deadline) : null;
    const daysLeft = deadline ? Math.ceil((deadline.getTime() - today.getTime()) / 86400000) : 99;
    if (r.severity === 'critical' || daysLeft <= 2) return 'act';
    if (r.severity === 'high' || daysLeft <= 7) return 'week';
    return 'monitor';
  };

  const columns: {
    id: 'act' | 'week' | 'monitor';
    title: string;
    subtitle: string;
    color: string;
    bg: string;
  }[] = [
    { id: 'act', title: 'Act now', subtitle: 'Critical severity or deadline in ≤ 2 days', color: theme.colors.error, bg: theme.colors.errorLight },
    { id: 'week', title: 'This week', subtitle: 'High severity or deadline in ≤ 7 days', color: theme.colors.warning, bg: theme.colors.warningLight },
    { id: 'monitor', title: 'Monitor', subtitle: 'Medium severity, longer horizon', color: theme.colors.info, bg: theme.colors.infoLight },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
      {columns.map((col) => {
        const colItems = risks.filter((r) => bucket(r) === col.id);
        return (
          <div
            key={col.id}
            style={{
              background: col.bg,
              borderRadius: theme.borderRadius.md,
              padding: 12,
              minHeight: 120,
              border: `1px solid ${col.color}22`,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, flexShrink: 0 }} />
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: theme.colors.charcoal,
                      textTransform: 'uppercase',
                      letterSpacing: 0.4,
                      whiteSpace: 'nowrap',
                      fontFamily: theme.typography.fontFamily.primary,
                    }}
                  >
                    {col.title}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: col.color,
                    background: 'white',
                    padding: '3px 8px',
                    borderRadius: 10,
                    border: `1px solid ${col.color}40`,
                    flexShrink: 0,
                  }}
                >
                  {colItems.length}
                </div>
              </div>
              <div style={{ fontSize: 10, color: theme.colors.cadetGray, marginLeft: 14 }}>{col.subtitle}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {colItems.length === 0 && (
                <div
                  style={{
                    fontSize: 11,
                    color: theme.colors.cadetGray,
                    textAlign: 'center',
                    padding: 20,
                    fontStyle: 'italic',
                  }}
                >
                  Nothing here.
                </div>
              )}
              {colItems.map((r) => {
                const deadline = r.deadline ? new Date(r.deadline) : null;
                const daysLeft = deadline
                  ? Math.ceil((deadline.getTime() - today.getTime()) / 86400000)
                  : null;
                return (
                  <div
                    key={r.task_id}
                    onClick={() => onOpenTask && onOpenTask(r)}
                    style={{
                      background: 'white',
                      padding: '10px 11px',
                      borderRadius: 6,
                      border: `1px solid ${theme.colors.border}`,
                      borderLeft: `3px solid ${sevColor(r.severity)}`,
                      cursor: onOpenTask ? 'pointer' : 'default',
                      transition: theme.transitions.default,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          color: sevColor(r.severity),
                          textTransform: 'uppercase',
                          letterSpacing: 0.4,
                          background: sevColor(r.severity) + '18',
                          padding: '1px 6px',
                          borderRadius: 3,
                        }}
                      >
                        {r.severity}
                      </span>
                      {r.office && (
                        <div
                          style={{
                            fontSize: 9,
                            color: theme.colors.cadetGray,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: 0.3,
                          }}
                        >
                          {r.office}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: theme.colors.charcoal,
                        lineHeight: 1.3,
                        marginBottom: 6,
                      }}
                    >
                      {r.title}
                    </div>
                    <div style={{ fontSize: 10, color: theme.colors.cadetGray, lineHeight: 1.4, marginBottom: 8 }}>
                      {r.reason}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {r.assignee ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Avatar name={r.assignee} size={16} />
                          <span style={{ fontSize: 10, color: theme.colors.cadetGray }}>
                            {r.assignee.split(' ')[0]}
                          </span>
                        </div>
                      ) : (
                        <div />
                      )}
                      {daysLeft !== null && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: daysLeft < 0 || daysLeft <= 2 ? theme.colors.error : theme.colors.cadetGray,
                          }}
                        >
                          {daysLeft < 0
                            ? `${Math.abs(daysLeft)}d overdue`
                            : daysLeft === 0
                              ? 'today'
                              : `${daysLeft}d left`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
