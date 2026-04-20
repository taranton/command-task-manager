import { theme } from '../../styles/theme';
import type { OfficeRollupRow } from '../../hooks/useAnalytics';
import { StatusStackBar } from './primitives';
import { WorldMap } from './WorldMap';

// Office → (lat, lng) lookup for the world-map view. Extend as new offices appear.
const OFFICE_COORDS: Record<string, { lat: number; lng: number }> = {
  Sussex: { lat: 50.86, lng: -0.08 },
  Kraków: { lat: 50.06, lng: 19.94 },
  Krakow: { lat: 50.06, lng: 19.94 },
  Texas: { lat: 30.27, lng: -97.74 },
  Dubai: { lat: 25.2, lng: 55.27 },
  London: { lat: 51.5, lng: -0.13 },
  'New York': { lat: 40.71, lng: -74.0 },
};

export function OfficeComparison({
  rows,
  view = 'list',
  onSelectOffice,
}: {
  rows: OfficeRollupRow[];
  view?: 'list' | 'map';
  onSelectOffice?: (office: string) => void;
}) {
  if (!rows || rows.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: theme.colors.cadetGray, fontSize: 13 }}>
        No offices in this region yet. Set an office on a board to see it here.
      </div>
    );
  }

  if (view === 'map') {
    const mapped = rows
      .map((r) => {
        const c = OFFICE_COORDS[r.office];
        if (!c) return null;
        return {
          office: r.office,
          rate: r.completion_pct,
          total: r.total,
          overdue: r.overdue,
          byStatus: {
            backlog: r.backlog,
            to_do: r.to_do,
            in_progress: r.in_progress,
            in_review: r.in_review,
            done: r.done,
          },
          people: Array(r.people_count).fill('·'),
          lat: c.lat,
          lng: c.lng,
        };
      })
      .filter(Boolean) as Parameters<typeof WorldMap>[0]['offices'];
    if (mapped.length === 0) {
      return (
        <div style={{ padding: 24, textAlign: 'center', color: theme.colors.cadetGray, fontSize: 13 }}>
          Coordinates unknown for: {rows.map((r) => r.office).join(', ')}. Showing list instead.
        </div>
      );
    }
    return <WorldMap offices={mapped} onSelectOffice={onSelectOffice} />;
  }

  const segments = (r: OfficeRollupRow) => [
    { label: 'Done', value: r.done, color: theme.colors.status.done },
    { label: 'In Review', value: r.in_review, color: theme.colors.status.in_review },
    { label: 'In Progress', value: r.in_progress, color: theme.colors.status.in_progress },
    { label: 'To Do', value: r.to_do, color: theme.colors.status.to_do },
    { label: 'Backlog', value: r.backlog, color: theme.colors.status.backlog },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {rows.map((r) => (
        <div
          key={r.office}
          onClick={() => onSelectOffice && onSelectOffice(r.office)}
          style={{
            display: 'grid',
            gridTemplateColumns: '110px minmax(0,1fr) 56px 76px 70px',
            gap: 12,
            alignItems: 'center',
            padding: '10px 12px',
            borderRadius: theme.borderRadius.md,
            cursor: onSelectOffice ? 'pointer' : 'default',
            transition: theme.transitions.default,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: theme.colors.charcoal,
                fontFamily: theme.typography.fontFamily.primary,
              }}
            >
              {r.office}
            </div>
            <div style={{ fontSize: 10, color: theme.colors.cadetGray, marginTop: 2 }}>
              {r.people_count} {r.people_count === 1 ? 'person' : 'people'} · {r.total} tasks
            </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <StatusStackBar segments={segments(r)} height={12} />
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                columnGap: 12,
                rowGap: 2,
                marginTop: 6,
                fontSize: 10,
                color: theme.colors.cadetGray,
                whiteSpace: 'nowrap',
              }}
            >
              <span>
                <b style={{ color: theme.colors.status.done }}>{r.done}</b> done
              </span>
              <span>
                <b style={{ color: theme.colors.status.in_progress }}>{r.in_progress}</b> progress
              </span>
              <span>
                <b style={{ color: theme.colors.status.in_review }}>{r.in_review}</b> review
              </span>
              <span>
                <b style={{ color: theme.colors.status.to_do }}>{r.to_do}</b> to do
              </span>
            </div>
          </div>
          <div
            style={{
              textAlign: 'right',
              fontSize: 20,
              fontWeight: 700,
              fontFamily: theme.typography.fontFamily.primary,
              color: theme.colors.charcoal,
            }}
          >
            {r.completion_pct}%
          </div>
          <div
            style={{
              textAlign: 'right',
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              color: r.overdue > 0 ? theme.colors.error : theme.colors.cadetGray,
            }}
          >
            {r.overdue} overdue
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, color: theme.colors.cadetGray, fontWeight: 500 }}>
            {r.people_count}
          </div>
        </div>
      ))}
    </div>
  );
}
