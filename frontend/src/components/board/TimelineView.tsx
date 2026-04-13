import { useState, useMemo } from 'react';
import styled from 'styled-components';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { theme } from '../../styles/theme';
import { TaskDetail } from './TaskDetail';
import { useIsMobile } from '../../hooks/useMediaQuery';
import type { Story, Task } from '../../types';

// ---- Story colors ----
const STORY_COLORS = ['#7C3AED', '#2196F3', '#FF9800', '#4CAF50', '#F44336', '#00BCD4', '#E91E63', '#795548'];
function getStoryColor(idx: number): string {
  return STORY_COLORS[idx % STORY_COLORS.length];
}

// ---- Date helpers ----
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1)); // Monday start
  r.setHours(0, 0, 0, 0);
  return r;
}
function formatDay(d: Date): string {
  return d.getDate().toString();
}
function formatWeekRange(d: Date): string {
  const end = addDays(d, 6);
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
function parseDate(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// ---- Styled ----
const Container = styled.div`flex: 1; display: flex; flex-direction: column; overflow: hidden;`;

const Toolbar = styled.div`
  display: flex; align-items: center; gap: ${theme.spacing.md};
  padding: ${theme.spacing.sm} ${theme.spacing.lg};
  background: ${theme.colors.white}; border-bottom: 1px solid ${theme.colors.border};
  flex-shrink: 0;
`;
const NavBtn = styled.button`
  background: none; color: ${theme.colors.davysGray}; padding: 6px;
  border-radius: ${theme.borderRadius.sm}; display: flex;
  &:hover { background: ${theme.colors.lightGray}; }
  svg { width: 16px; height: 16px; }
`;
const TodayBtn = styled.button`
  padding: 4px 12px; border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.pill}; font-size: ${theme.typography.fontSize.xs};
  font-weight: ${theme.typography.fontWeight.medium}; background: white;
  &:hover { background: ${theme.colors.lightGray}; }
`;
const RangeLabel = styled.span`
  font-size: ${theme.typography.fontSize.sm}; font-weight: ${theme.typography.fontWeight.medium};
  color: ${theme.colors.charcoal};
`;

const Grid = styled.div`flex: 1; overflow: auto; display: flex;`;
const LeftPanel = styled.div`
  min-width: 220px; max-width: 220px; border-right: 1px solid ${theme.colors.border};
  background: ${theme.colors.white}; flex-shrink: 0; overflow-y: auto;
`;
const RightPanel = styled.div`flex: 1; overflow: auto; position: relative;`;

// Header row (week labels + day numbers)
const TimeHeader = styled.div<{ $cols: number }>`
  display: grid; grid-template-columns: repeat(${(p) => p.$cols}, 36px);
  position: sticky; top: 0; z-index: 5; background: ${theme.colors.white};
  border-bottom: 1px solid ${theme.colors.border};
`;
const WeekHeader = styled.div<{ $span: number }>`
  grid-column: span ${(p) => p.$span};
  padding: 4px 8px; font-size: 10px; font-weight: 600;
  color: ${theme.colors.cadetGray}; border-right: 1px solid ${theme.colors.border};
  white-space: nowrap; overflow: hidden;
`;
const DayCell = styled.div<{ $isToday: boolean; $isWeekend: boolean }>`
  padding: 2px; text-align: center; font-size: 10px;
  color: ${(p) => p.$isToday ? theme.colors.vividOrange : p.$isWeekend ? theme.colors.silver : theme.colors.cadetGray};
  font-weight: ${(p) => p.$isToday ? '700' : '400'};
  background: ${(p) => p.$isWeekend ? '#FAFAFA' : 'transparent'};
  border-right: 1px solid ${theme.colors.border}08;
`;

// Story row in left panel
const StoryRow = styled.div`
  padding: 12px 14px; border-bottom: 1px solid ${theme.colors.border};
  min-height: 60px; display: flex; flex-direction: column; justify-content: center;
`;
const StoryName = styled.div<{ $color: string }>`
  display: flex; align-items: center; gap: 8px;
  font-size: ${theme.typography.fontSize.sm}; font-weight: ${theme.typography.fontWeight.semibold};
`;
const StoryDot = styled.div<{ $color: string }>`
  width: 24px; height: 24px; border-radius: 6px;
  background: ${(p) => p.$color}; color: white;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; flex-shrink: 0;
`;
const ProgressMini = styled.div`
  margin-top: 6px; height: 3px; background: ${theme.colors.lightGray};
  border-radius: 2px; overflow: hidden; width: 100%;
`;
const ProgressFill = styled.div<{ $pct: number; $color: string }>`
  height: 100%; width: ${(p) => p.$pct}%;
  background: ${(p) => p.$color}; border-radius: 2px;
`;
const UnscheduledLabel = styled.div`
  font-size: 10px; color: ${theme.colors.cadetGray}; margin-top: 4px;
`;

// Task bars in right panel
const BarRow = styled.div<{ $cols: number }>`
  display: grid; grid-template-columns: repeat(${(p) => p.$cols}, 36px);
  min-height: 60px; border-bottom: 1px solid ${theme.colors.border};
  align-items: center; position: relative;
`;
const TaskBar = styled.div<{ $start: number; $span: number; $color: string }>`
  grid-column: ${(p) => p.$start} / span ${(p) => Math.max(p.$span, 1)};
  background: ${(p) => p.$color};
  color: white; font-size: 11px; font-weight: 500;
  padding: 4px 8px; border-radius: 4px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  cursor: pointer; min-height: 26px; display: flex; align-items: center; gap: 6px;
  margin: 2px 0;
  &:hover { opacity: 0.9; box-shadow: 0 2px 6px rgba(0,0,0,0.15); }
`;
const TaskHours = styled.span`
  font-size: 9px; background: rgba(255,255,255,0.25);
  padding: 1px 5px; border-radius: 3px; flex-shrink: 0;
`;

// Today line
const TodayLine = styled.div<{ $left: number }>`
  position: absolute; top: 0; bottom: 0;
  left: ${(p) => p.$left}px; width: 2px;
  background: ${theme.colors.error}; z-index: 4;
  pointer-events: none;
`;

// ---- Component ----
interface TimelineViewProps {
  stories: Story[];
  allTasks: Task[];
}

export function TimelineView({ stories, allTasks }: TimelineViewProps) {
  const isMobile = useIsMobile();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [viewStart, setViewStart] = useState(() => startOfWeek(addDays(today, -7)));
  const totalDays = 35; // 5 weeks

  // Generate days array
  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < totalDays; i++) arr.push(addDays(viewStart, i));
    return arr;
  }, [viewStart, totalDays]);

  // Group days by week for header
  const weeks = useMemo(() => {
    const w: { start: Date; days: number }[] = [];
    let curr = startOfWeek(days[0]);
    let count = 0;
    for (const d of days) {
      const ws = startOfWeek(d);
      if (ws.getTime() !== curr.getTime()) {
        w.push({ start: curr, days: count });
        curr = ws;
        count = 1;
      } else {
        count++;
      }
    }
    if (count > 0) w.push({ start: curr, days: count });
    return w;
  }, [days]);

  // Build story data with tasks
  const storyData = useMemo(() => {
    return stories.map((story, idx) => {
      const tasks = allTasks.filter((t) => t.story_id === story.id);
      const scheduled = tasks.filter((t) => t.start_date || t.deadline);
      const unscheduled = tasks.length - scheduled.length;
      return { story, tasks, scheduled, unscheduled, color: getStoryColor(idx) };
    });
  }, [stories, allTasks]);

  const todayCol = daysBetween(viewStart, today) + 1;
  const todayLeft = (todayCol - 1) * 36 + 18;

  return (
    <Container>
      <Toolbar>
        <NavBtn onClick={() => setViewStart(addDays(viewStart, -7))}><FiChevronLeft /></NavBtn>
        <NavBtn onClick={() => setViewStart(addDays(viewStart, 7))}><FiChevronRight /></NavBtn>
        <TodayBtn onClick={() => setViewStart(startOfWeek(addDays(today, -7)))}>Today</TodayBtn>
        <RangeLabel>{formatWeekRange(viewStart)} — {formatWeekRange(addDays(viewStart, 28))}</RangeLabel>
      </Toolbar>

      <Grid>
        <LeftPanel>
          {/* Spacer for header */}
          <div style={{ height: 44, borderBottom: `1px solid ${theme.colors.border}` }} />
          {storyData.map(({ story, unscheduled, color }) => (
            <StoryRow key={story.id}>
              <StoryName $color={color}>
                <StoryDot $color={color}>{story.title.charAt(0).toUpperCase()}</StoryDot>
                {story.title}
              </StoryName>
              <ProgressMini>
                <ProgressFill $pct={story.progress} $color={color} />
              </ProgressMini>
              {unscheduled > 0 && <UnscheduledLabel>{unscheduled} unscheduled</UnscheduledLabel>}
            </StoryRow>
          ))}
        </LeftPanel>

        <RightPanel>
          {/* Time header */}
          <div style={{ display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, zIndex: 5, background: 'white' }}>
            <TimeHeader $cols={totalDays}>
              {weeks.map((w, i) => (
                <WeekHeader key={i} $span={w.days}>{formatWeekRange(w.start)}</WeekHeader>
              ))}
            </TimeHeader>
            <TimeHeader $cols={totalDays}>
              {days.map((d, i) => (
                <DayCell key={i} $isToday={d.getTime() === today.getTime()} $isWeekend={d.getDay() === 0 || d.getDay() === 6}>
                  {formatDay(d)}
                </DayCell>
              ))}
            </TimeHeader>
          </div>

          {/* Task bars */}
          {storyData.map(({ story, tasks, color }) => (
            <BarRow key={story.id} $cols={totalDays}>
              {tasks.map((task) => {
                const start = parseDate(task.start_date) || parseDate(task.deadline);
                const end = parseDate(task.deadline) || (start ? addDays(start, 3) : null);
                if (!start || !end) return null;

                const startCol = Math.max(daysBetween(viewStart, start) + 1, 1);
                const endCol = Math.min(daysBetween(viewStart, end) + 1, totalDays);
                const span = Math.max(endCol - startCol + 1, 1);

                if (startCol > totalDays || endCol < 1) return null;

                return (
                  <TaskBar
                    key={task.id}
                    $start={Math.max(startCol, 1)}
                    $span={span}
                    $color={color}
                    onClick={() => setSelectedTaskId(task.id)}
                    title={`${task.title}\n${task.start_date || '?'} → ${task.deadline || '?'}`}
                  >
                    {task.title}
                    {task.estimated_hours && <TaskHours>{task.estimated_hours}h</TaskHours>}
                  </TaskBar>
                );
              })}
            </BarRow>
          ))}

          {/* Today line */}
          {todayCol >= 1 && todayCol <= totalDays && (
            <TodayLine $left={todayLeft} />
          )}
        </RightPanel>
      </Grid>

      {selectedTaskId && (
        <TaskDetail taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} inline={!isMobile} />
      )}
    </Container>
  );
}
