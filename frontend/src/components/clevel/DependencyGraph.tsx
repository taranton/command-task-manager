import { useMemo, useRef, useEffect, useState } from 'react';
import { theme } from '../../styles/theme';
import type { Story, Team, Region } from '../../types';
import type { StoryDep, Blocker } from '../../hooks/useEntities';

// Layout knobs
const NODE_H = 28;
const NODE_GAP = 8;
const OFFICE_HEADER_H = 22;
const COL_PAD_V = 28;
const COL_MIN_W = 240;

export function DependencyGraph({
  stories,
  teams,
  regions,
  deps,
  blockers,
  onOpenStory,
  onOpenTask,
}: {
  stories: Story[];
  teams: Team[];
  regions?: Region[];
  deps: StoryDep[];
  blockers: Blocker[];
  onOpenStory?: (storyId: string) => void;
  onOpenTask?: (taskId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(1200);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setContainerW(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const activeStories = useMemo(() => stories.filter((s) => s.status === 'active'), [stories]);
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const regionById = useMemo(() => new Map((regions || []).map((r) => [r.id, r])), [regions]);

  // Group stories → region → office → [stories].
  // When only one region has stories (common inside a single-region filter),
  // auto-downgrade so columns = offices of that region — gives useful granularity
  // instead of one fat column.
  const groups = useMemo(() => {
    type OfficeGroup = { office: string; stories: Story[] };
    type ColumnGroup = { id: string; label: string; sublabel?: string; offices: OfficeGroup[]; total: number };
    const byRegion = new Map<string, ColumnGroup>();

    for (const s of activeStories) {
      const team = s.team_id ? teamById.get(s.team_id) : undefined;
      const regionID = team?.region_id || 'none';
      const regionLabel =
        regionID === 'none' ? '—' : regionById.get(regionID)?.code || regionById.get(regionID)?.name || '—';
      const office = team?.office || '—';

      let rg = byRegion.get(regionID);
      if (!rg) {
        rg = { id: regionID, label: regionLabel, offices: [], total: 0 };
        byRegion.set(regionID, rg);
      }
      let og = rg.offices.find((o) => o.office === office);
      if (!og) {
        og = { office, stories: [] };
        rg.offices.push(og);
      }
      og.stories.push(s);
      rg.total++;
    }

    const regionsList = Array.from(byRegion.values()).sort((a, b) => a.label.localeCompare(b.label));

    // Auto-downgrade: if only one region has stories, split it by office (each
    // office becomes its own column). Users see city-level detail instead of
    // a single wide column with everything in it.
    if (regionsList.length === 1 && regionsList[0].offices.length > 1) {
      const reg = regionsList[0];
      const perOffice: ColumnGroup[] = reg.offices
        .slice()
        .sort((a, b) => a.office.localeCompare(b.office))
        .map((og) => ({
          id: `${reg.id}:${og.office}`,
          label: og.office,
          sublabel: reg.label,
          offices: [{ office: og.office, stories: og.stories }],
          total: og.stories.length,
        }));
      return { mode: 'office' as const, columns: perOffice };
    }

    regionsList.forEach((rg) => rg.offices.sort((a, b) => a.office.localeCompare(b.office)));
    return { mode: 'region' as const, columns: regionsList };
  }, [activeStories, teamById, regionById]);

  const blockedStoryIds = useMemo(() => new Set(blockers.filter((b) => !b.resolved_at).map((b) => b.story_id)), [blockers]);

  if (activeStories.length === 0) {
    return (
      <div
        ref={containerRef}
        style={{
          padding: 20,
          textAlign: 'center',
          color: theme.colors.cadetGray,
          fontSize: 13,
          background: theme.colors.background,
          borderRadius: 6,
        }}
      >
        No active stories to show.
      </div>
    );
  }

  const isOfficeMode = groups.mode === 'office';
  const columns = groups.columns;

  // Compute layout
  const cols = columns.length;
  const colW = Math.max(COL_MIN_W, Math.floor((containerW - (cols + 1) * 12) / Math.max(cols, 1)));
  const totalW = cols * colW + (cols + 1) * 12;

  // Position map: { storyId → { x, y } } where (x,y) is the centre of the node in SVG coords.
  const posById: Record<string, { x: number; y: number; colIdx: number }> = {};
  const colHeights: number[] = columns.map(() => COL_PAD_V);

  columns.forEach((rg, ci) => {
    const colX = 12 + ci * (colW + 12) + colW / 2;
    let y = COL_PAD_V + 8; // column content starts below region header
    rg.offices.forEach((og) => {
      // Skip per-office subheader in office-mode (column header already shows the office).
      if (!isOfficeMode) y += OFFICE_HEADER_H;
      og.stories.forEach((s) => {
        posById[s.id] = { x: colX, y: y + NODE_H / 2, colIdx: ci };
        y += NODE_H + NODE_GAP;
      });
      y += 4;
    });
    colHeights[ci] = y + 12;
  });

  const svgH = Math.max(...colHeights, 140);

  // Priority accent colour for left border
  const priorityColor = (p: string) => {
    switch (p) {
      case 'critical':
        return theme.colors.error;
      case 'high':
        return theme.colors.warning;
      case 'medium':
        return theme.colors.info;
      case 'low':
        return theme.colors.success;
      default:
        return theme.colors.cadetGray;
    }
  };

  return (
    <div ref={containerRef}>
      <svg
        viewBox={`0 0 ${totalW} ${svgH}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <defs>
          <marker id="dep-arrow" viewBox="0 0 8 8" refX={6} refY={4} markerWidth={6} markerHeight={6} orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill={theme.colors.vividOrange} opacity={0.75} />
          </marker>
          <marker id="dep-arrow-red" viewBox="0 0 8 8" refX={6} refY={4} markerWidth={6} markerHeight={6} orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill={theme.colors.error} />
          </marker>
        </defs>

        {/* Column dividers + headers */}
        {columns.map((rg, ci) => {
          const xStart = 12 + ci * (colW + 12);
          return (
            <g key={`col-${rg.id}`}>
              {ci > 0 && (
                <line
                  x1={xStart - 6}
                  y1={6}
                  x2={xStart - 6}
                  y2={svgH - 6}
                  stroke={theme.colors.border}
                  strokeDasharray="2,3"
                />
              )}
              <rect
                x={xStart}
                y={8}
                width={colW}
                height={20}
                rx={4}
                fill={theme.colors.lightGray}
                opacity={0.4}
              />
              <text
                x={xStart + colW / 2}
                y={22}
                textAnchor="middle"
                fontSize={10}
                fontWeight={700}
                fill={theme.colors.davysGray}
                style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}
              >
                {rg.label} · {rg.total}
                {rg.sublabel ? ` · ${rg.sublabel}` : ''}
              </text>
            </g>
          );
        })}

        {/* Office subheaders (region mode) + story nodes */}
        {columns.map((rg, ci) => {
          const xStart = 12 + ci * (colW + 12);
          let y = COL_PAD_V + 8;
          return (
            <g key={`nodes-${rg.id}`}>
              {rg.offices.map((og) => {
                const storiesStartY = isOfficeMode ? y : y + OFFICE_HEADER_H;
                const officeY = isOfficeMode ? 0 : y + OFFICE_HEADER_H - 6;
                y +=
                  (isOfficeMode ? 0 : OFFICE_HEADER_H) +
                  og.stories.length * (NODE_H + NODE_GAP) +
                  4;

                return (
                  <g key={`office-${rg.id}-${og.office}`}>
                    {!isOfficeMode && (
                      <text
                        x={xStart + 10}
                        y={officeY}
                        fontSize={10}
                        fontWeight={600}
                        fill={theme.colors.cadetGray}
                        style={{ letterSpacing: 0.3 }}
                      >
                        {og.office}
                      </text>
                    )}
                    {og.stories.map((s, si) => {
                      const nodeY = storiesStartY + si * (NODE_H + NODE_GAP);
                      const blocked = blockedStoryIds.has(s.id);
                      const accent = blocked ? theme.colors.error : priorityColor(s.priority);
                      const displayTitle = truncate(s.title, Math.floor((colW - 32) / 8));
                      const clickable = !!onOpenStory;
                      return (
                        <g
                          key={s.id}
                          style={clickable ? { cursor: 'pointer' } : undefined}
                          onClick={clickable ? () => onOpenStory!(s.id) : undefined}
                        >
                          <title>{s.title} · click for details</title>
                          <rect
                            x={xStart + 8}
                            y={nodeY}
                            width={colW - 16}
                            height={NODE_H}
                            rx={6}
                            fill={theme.colors.white}
                            stroke={blocked ? theme.colors.error : theme.colors.border}
                            strokeWidth={blocked ? 1.5 : 1}
                          />
                          <rect
                            x={xStart + 8}
                            y={nodeY}
                            width={3}
                            height={NODE_H}
                            rx={1.5}
                            fill={accent}
                          />
                          <text
                            x={xStart + 18}
                            y={nodeY + NODE_H / 2 + 4}
                            fontSize={11.5}
                            fontWeight={600}
                            fill={theme.colors.charcoal}
                          >
                            {displayTitle}
                          </text>
                          {blocked && (
                            <text
                              x={xStart + colW - 14}
                              y={nodeY + NODE_H / 2 + 4}
                              fontSize={11}
                              textAnchor="end"
                              fill={theme.colors.error}
                              fontWeight={700}
                            >
                              ⚠
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Dependency arcs (drawn on top of nodes) */}
        {deps.map((dep) => {
          const a = posById[dep.from_story];
          const b = posById[dep.to_story];
          if (!a || !b) return null;
          const isCritical = blockedStoryIds.has(dep.to_story);
          // Start/end at the edge of the node, not center
          const sx = a.x + (b.x > a.x ? (colW - 16) / 2 : -(colW - 16) / 2);
          const ex = b.x + (a.x > b.x ? (colW - 16) / 2 : -(colW - 16) / 2);
          const sy = a.y;
          const ey = b.y;
          // Arc control: bend outward based on column distance
          const span = Math.abs(a.colIdx - b.colIdx);
          const bend = 20 + span * 10;
          const mx = (sx + ex) / 2;
          const my = (sy + ey) / 2 - bend;
          return (
            <path
              key={dep.id}
              d={`M${sx},${sy} Q${mx},${my} ${ex},${ey}`}
              stroke={isCritical ? theme.colors.error : theme.colors.vividOrange}
              strokeWidth={isCritical ? 1.8 : 1.2}
              fill="none"
              opacity={0.5}
              markerEnd={`url(#${isCritical ? 'dep-arrow-red' : 'dep-arrow'})`}
            >
              <title>{dep.reason || 'depends on'}</title>
            </path>
          );
        })}
      </svg>

      {/* External blockers list */}
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: theme.colors.cadetGray,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}
        >
          Blockers · {blockers.length}
        </div>
        {blockers.length === 0 && (
          <div
            style={{
              fontSize: 12,
              color: theme.colors.cadetGray,
              padding: 10,
              background: theme.colors.successLight,
              borderRadius: 6,
            }}
          >
            No blockers. ✓
          </div>
        )}
        {blockers.map((b) => {
          const story = stories.find((s) => s.id === b.story_id);
          const sevCol =
            b.severity === 'critical'
              ? theme.colors.error
              : b.severity === 'high'
                ? theme.colors.warning
                : theme.colors.info;
          const ageDays = Math.max(0, Math.floor((Date.now() - new Date(b.since_date).getTime()) / 86400000));
          const canOpenStory = !!onOpenStory && !!b.story_id;
          const canOpenTask = !!onOpenTask && !!b.blocking_task_id;
          return (
            <div
              key={b.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                background: theme.colors.background,
                borderRadius: 6,
                fontSize: 12,
                cursor: canOpenStory ? 'pointer' : 'default',
                transition: theme.transitions.default,
              }}
              title={canOpenStory ? 'Click to open blocked story' : undefined}
              onMouseEnter={(e) => {
                if (canOpenStory) e.currentTarget.style.background = theme.colors.lightGray;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = theme.colors.background;
              }}
              onClick={() => canOpenStory && onOpenStory!(b.story_id)}
            >
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: sevCol,
                  background: sevCol + '18',
                  padding: '2px 5px',
                  borderRadius: 3,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                {b.severity}
              </span>
              <span style={{ color: theme.colors.charcoal, fontWeight: 600 }}>{story?.title || '(deleted story)'}</span>
              <span style={{ color: theme.colors.cadetGray }}>—</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (canOpenTask) onOpenTask!(b.blocking_task_id!);
                }}
                disabled={!canOpenTask}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: b.blocking_task_id ? theme.colors.info + '18' : theme.colors.lightGray,
                  color: b.blocking_task_id ? theme.colors.info : theme.colors.davysGray,
                  textTransform: 'uppercase',
                  letterSpacing: 0.3,
                  flexShrink: 0,
                  border: 'none',
                  cursor: canOpenTask ? 'pointer' : 'default',
                }}
                title={
                  canOpenTask
                    ? 'Click to open the blocking task (auto-resolves when done)'
                    : b.blocking_task_id
                      ? 'Task-linked blocker'
                      : 'External blocker'
                }
              >
                {b.blocking_task_id ? '→ task-linked' : 'external'}
              </button>
              <span style={{ color: theme.colors.davysGray, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {b.blocker_description || (b.blocking_task_id ? 'Waiting for internal task' : '—')}
              </span>
              <span style={{ color: theme.colors.cadetGray, fontSize: 11 }}>
                {b.resolved_at ? 'resolved' : `${ageDays}d`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Truncate with ellipsis, approximately by character count
function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(1, max - 1)) + '…';
}
