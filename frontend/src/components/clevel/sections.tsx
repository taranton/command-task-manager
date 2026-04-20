import { theme } from '../../styles/theme';
import { PriorityPill } from './primitives';

// Minimal story shape used by ActiveStories (compatible with real API).
export interface SimpleStory {
  id: string;
  title: string;
  status: string;
  progress: number;
  priority: string;
  team_id?: string;
  deadline?: string | null;
}

export interface SimpleTeam {
  id: string;
  name: string;
}

export function ActiveStories({
  stories,
  teams,
  showWipLimits,
  onOpenStory,
}: {
  stories: SimpleStory[];
  teams: SimpleTeam[];
  showWipLimits: boolean;
  onOpenStory?: (storyId: string) => void;
}) {
  const active = stories.filter((s) => s.status === 'active').slice(0, 6);
  const teamById = new Map(teams.map((t) => [t.id, t]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {active.map((s) => {
        const team = s.team_id ? teamById.get(s.team_id) : undefined;
        const overdue = s.deadline ? new Date(s.deadline) < new Date() : false;
        const wip = 0;
        const limit = 4;
        return (
          <div
            key={s.id}
            onClick={() => onOpenStory && onOpenStory(s.id)}
            onMouseEnter={(e) => {
              if (onOpenStory) e.currentTarget.style.borderColor = theme.colors.vividOrange + '80';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = theme.colors.border;
            }}
            style={{
              padding: '10px 12px',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.md,
              cursor: onOpenStory ? 'pointer' : 'default',
              transition: theme.transitions.default,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <PriorityPill priority={s.priority} />
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: theme.colors.charcoal,
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.title}
              </div>
              {showWipLimits && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 3,
                    background: wip > limit ? theme.colors.errorLight : theme.colors.lightGray,
                    color: wip > limit ? theme.colors.error : theme.colors.cadetGray,
                  }}
                >
                  WIP {wip}/{limit}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  flex: 1,
                  height: 6,
                  background: theme.colors.lightGray,
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: s.progress + '%',
                    height: '100%',
                    background: s.progress === 100 ? theme.colors.success : theme.colors.vividOrange,
                    transition: 'width .3s ease',
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 11,
                  color: theme.colors.cadetGray,
                  fontWeight: 500,
                  width: 36,
                  textAlign: 'right',
                }}
              >
                {s.progress}%
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 11, color: theme.colors.cadetGray }}>
              <span>{team ? team.name : ''}</span>
              {s.deadline && (
                <>
                  <span>·</span>
                  <span
                    style={{
                      color: overdue ? theme.colors.error : theme.colors.cadetGray,
                      fontWeight: overdue ? 600 : 400,
                    }}
                  >
                    due {new Date(s.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
