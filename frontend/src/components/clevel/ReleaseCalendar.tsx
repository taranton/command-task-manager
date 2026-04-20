import { theme } from '../../styles/theme';
import type { Release } from '../../hooks/useEntities';

export function ReleaseCalendar({ releases }: { releases: Release[] }) {
  const WEEKS = 12;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const weeks: { idx: number; start: Date; end: Date }[] = [];
  for (let w = 0; w < WEEKS; w++) {
    const ws = new Date(startDate);
    ws.setDate(ws.getDate() + w * 7);
    const we = new Date(ws);
    we.setDate(we.getDate() + 6);
    weeks.push({ idx: w, start: ws, end: we });
  }

  const officeColor = (office: string | null): string => {
    if (!office) return theme.colors.vividOrange;
    const map: Record<string, string> = {
      Sussex: theme.colors.vividOrange,
      Kraków: theme.colors.info,
      Krakow: theme.colors.info,
      Texas: theme.colors.status.in_review,
      Dubai: theme.colors.success,
    };
    return map[office] || theme.colors.vividOrange;
  };

  const todayWeekIdx = Math.floor((today.getTime() - startDate.getTime()) / (7 * 86400000));
  const dayInWeek =
    (today.getTime() - new Date(startDate.getTime() + todayWeekIdx * 7 * 86400000).getTime()) / 86400000;

  const inWindow = releases.filter((r) => {
    const d = new Date(r.release_date);
    const offset = (d.getTime() - startDate.getTime()) / 86400000;
    return offset >= 0 && offset <= WEEKS * 7;
  });

  return (
    <div>
      {inWindow.length === 0 && (
        <div
          style={{
            padding: 16,
            textAlign: 'center',
            color: theme.colors.cadetGray,
            fontSize: 13,
            background: theme.colors.background,
            borderRadius: 6,
            marginBottom: 10,
          }}
        >
          No releases scheduled in the next 12 weeks. Add one from the admin page.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${WEEKS}, 1fr)`, gap: 2, marginBottom: 4 }}>
        {weeks.map((w, i) => (
          <div
            key={i}
            style={{
              fontSize: 9,
              color: theme.colors.cadetGray,
              textAlign: 'center',
              fontWeight: w.idx === todayWeekIdx ? 700 : 400,
            }}
          >
            {w.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        ))}
      </div>

      <div
        style={{
          position: 'relative',
          height: 140,
          background: theme.colors.background,
          borderRadius: 6,
          padding: '12px 0',
          overflow: 'hidden',
        }}
      >
        {weeks.map((_, i) =>
          i > 0 ? (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${(i / WEEKS) * 100}%`,
                width: 1,
                background: theme.colors.border,
              }}
            />
          ) : null,
        )}

        {todayWeekIdx >= 0 && todayWeekIdx < WEEKS && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${((todayWeekIdx + dayInWeek / 7) / WEEKS) * 100}%`,
              width: 2,
              background: theme.colors.vividOrange,
              zIndex: 2,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: -6,
                left: -18,
                background: theme.colors.vividOrange,
                color: 'white',
                fontSize: 9,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 3,
                letterSpacing: 0.4,
                whiteSpace: 'nowrap',
              }}
            >
              TODAY
            </div>
          </div>
        )}

        {inWindow.map((r, i) => {
          const d = new Date(r.release_date);
          const dayOffset = (d.getTime() - startDate.getTime()) / 86400000;
          const leftPct = (dayOffset / (WEEKS * 7)) * 100;
          const isMajor = r.release_type === 'major';
          const lane = i % 4;
          const col = officeColor(r.office);
          return (
            <div
              key={r.id}
              title={r.description || r.label}
              style={{ position: 'absolute', left: `${leftPct}%`, top: 14 + lane * 28, transform: 'translateX(-6px)' }}
            >
              <div
                style={{
                  width: isMajor ? 12 : 8,
                  height: isMajor ? 12 : 8,
                  background: col,
                  borderRadius: isMajor ? 2 : '50%',
                  transform: isMajor ? 'rotate(45deg)' : 'none',
                  border: `2px solid ${theme.colors.white}`,
                  boxShadow: isMajor ? `0 0 0 1px ${col}` : 'none',
                  marginBottom: 2,
                }}
              />
              <div
                style={{
                  fontSize: isMajor ? 11 : 10,
                  fontWeight: isMajor ? 700 : 600,
                  color: theme.colors.charcoal,
                  whiteSpace: 'nowrap',
                  marginLeft: isMajor ? -18 : -12,
                }}
              >
                {r.label}
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: theme.colors.cadetGray,
                  whiteSpace: 'nowrap',
                  marginLeft: isMajor ? -18 : -12,
                  marginTop: 1,
                }}
              >
                {r.office || '—'} · {r.story_ids.length} {r.story_ids.length === 1 ? 'story' : 'stories'}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 10, color: theme.colors.cadetGray }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              width: 10,
              height: 10,
              background: theme.colors.charcoal,
              borderRadius: 2,
              transform: 'rotate(45deg)',
              display: 'inline-block',
            }}
          />{' '}
          Major
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              width: 7,
              height: 7,
              background: theme.colors.charcoal,
              borderRadius: '50%',
              display: 'inline-block',
            }}
          />{' '}
          Minor/Patch
        </span>
      </div>
    </div>
  );
}
