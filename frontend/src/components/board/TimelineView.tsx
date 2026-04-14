import { useState, useMemo } from 'react';
import styled from 'styled-components';
import { FiChevronLeft, FiChevronRight, FiChevronDown, FiChevronRight as FiExpand } from 'react-icons/fi';
import { theme } from '../../styles/theme';
import { Avatar } from '../ui/Avatar';
import { TaskDetail } from './TaskDetail';
import { useIsMobile } from '../../hooks/useMediaQuery';
import type { Story, Task } from '../../types';

// ---- Colors ----
const COLORS = ['#7C3AED', '#2196F3', '#FF9800', '#4CAF50', '#F44336', '#00BCD4', '#E91E63', '#795548'];
function getColor(idx: number): string { return COLORS[idx % COLORS.length]; }

// ---- Date helpers ----
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfWeek(d: Date): Date {
  const r = new Date(d); r.setDate(r.getDate() - ((r.getDay() + 6) % 7)); r.setHours(0, 0, 0, 0); return r;
}
function daysBetween(a: Date, b: Date): number { return Math.round((b.getTime() - a.getTime()) / 86400000); }
function parseD(s?: string): Date | null { if (!s) return null; const d = new Date(s); return isNaN(d.getTime()) ? null : d; }
function fmtWeek(d: Date): string {
  const e = addDays(d, 6);
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { day: 'numeric' })}`;
}

// ---- Styled ----
const Wrap = styled.div`flex: 1; display: flex; flex-direction: column; overflow: hidden;`;
const Toolbar = styled.div`
  display: flex; align-items: center; gap: ${theme.spacing.md};
  padding: ${theme.spacing.sm} ${theme.spacing.lg}; background: ${theme.colors.white};
  border-bottom: 1px solid ${theme.colors.border}; flex-shrink: 0;
`;
const NavBtn = styled.button`
  background: none; color: ${theme.colors.davysGray}; padding: 6px; border-radius: 4px; display: flex;
  &:hover { background: ${theme.colors.lightGray}; } svg { width: 16px; height: 16px; }
`;
const TodayBtn = styled.button`
  padding: 4px 12px; border: 1px solid ${theme.colors.border}; border-radius: 20px;
  font-size: 12px; font-weight: 500; background: white; &:hover { background: ${theme.colors.lightGray}; }
`;
const RangeLabel = styled.span`font-size: 13px; font-weight: 500; color: ${theme.colors.charcoal};`;

const ScrollArea = styled.div`flex: 1; overflow: auto;`;
const Table = styled.div`display: flex; min-width: fit-content; min-height: 100%;`;
const NameCol = styled.div`
  min-width: 260px; max-width: 260px; flex-shrink: 0; position: sticky; left: 0; z-index: 10;
  background: ${theme.colors.white}; border-right: 1px solid ${theme.colors.border}; min-height: 100%;
`;
const TimeCol = styled.div`flex: 1; min-height: 100%;`;

// Header
const HeaderCell = styled.div`
  height: 22px; font-size: 10px; font-weight: 600; color: ${theme.colors.cadetGray};
  display: flex; align-items: center; border-bottom: 1px solid ${theme.colors.border};
`;
const NameHeader = styled(HeaderCell)`padding: 0 14px; height: 44px;`;
const WeekLabel = styled.div<{ $w: number }>`
  width: ${(p) => p.$w * 36}px; padding: 0 6px; border-right: 1px solid ${theme.colors.border};
  display: flex; align-items: center; height: 22px; font-size: 10px; color: ${theme.colors.cadetGray};
  font-weight: 600; white-space: nowrap; overflow: hidden;
`;
const DayLabel = styled.div<{ $today: boolean; $weekend: boolean }>`
  width: 36px; text-align: center; height: 22px; display: flex; align-items: center; justify-content: center;
  font-size: 10px; border-right: 1px solid ${theme.colors.border}10;
  color: ${(p) => p.$today ? theme.colors.vividOrange : p.$weekend ? theme.colors.silver : theme.colors.cadetGray};
  font-weight: ${(p) => p.$today ? '700' : '400'};
  background: ${(p) => p.$weekend ? '#FAFAFA' : 'transparent'};
`;

// Rows
const ROW_H = 36;
const Row = styled.div<{ $h?: number }>`
  height: ${(p) => p.$h || ROW_H}px; display: flex; align-items: center;
  border-bottom: 1px solid ${theme.colors.border};
`;
const StoryNameRow = styled(Row)`
  padding: 0 8px; gap: 6px; cursor: pointer;
  &:hover { background: ${theme.colors.background}; }
`;
const StoryDot = styled.div<{ $c: string }>`
  width: 20px; height: 20px; border-radius: 5px; background: ${(p) => p.$c}; color: white;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; flex-shrink: 0;
`;
const ExpandIcon = styled.span`
  color: ${theme.colors.cadetGray}; display: flex; flex-shrink: 0;
  svg { width: 14px; height: 14px; }
`;
const StoryTitle = styled.span`
  font-size: 13px; font-weight: 600; color: ${theme.colors.charcoal};
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;
`;
const TaskNameRow = styled(Row)`
  padding: 0 8px 0 36px; gap: 6px; cursor: pointer;
  &:hover { background: ${theme.colors.background}; }
`;
const TaskTitle = styled.span`
  font-size: 12px; color: ${theme.colors.davysGray};
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;
`;

// Bars
const BarArea = styled.div<{ $days: number }>`
  position: relative; width: ${(p) => p.$days * 36}px; height: ${ROW_H}px;
`;
const Bar = styled.div<{ $left: number; $width: number; $color: string; $progress: number }>`
  position: absolute; top: 6px; height: ${ROW_H - 12}px;
  left: ${(p) => p.$left}px; width: ${(p) => Math.max(p.$width, 80)}px;
  background: ${(p) => p.$color}20; border-radius: 4px;
  display: flex; align-items: center; overflow: hidden;
  cursor: pointer;
  &::before {
    content: ''; position: absolute; left: 0; top: 0; bottom: 0;
    width: ${(p) => p.$progress}%; background: ${(p) => p.$color}; border-radius: 4px 0 0 4px;
    ${(p) => p.$progress >= 100 ? 'border-radius: 4px;' : ''}
  }
  &:hover { box-shadow: 0 1px 4px ${(p) => p.$color}40; }
`;
const BarText = styled.span<{ $filled: boolean }>`
  position: relative; z-index: 1; padding: 0 6px;
  font-size: 11px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  color: ${(p) => p.$filled ? 'white' : 'inherit'};
`;
const OvertimeBar = styled.div<{ $left: number; $width: number }>`
  position: absolute; top: 6px; height: ${ROW_H - 12}px;
  left: ${(p) => p.$left}px; width: ${(p) => p.$width}px;
  background: #F4433620; border: 1px dashed #F4433660; border-left: none;
  border-radius: 0 4px 4px 0;
`;
const TodayLine = styled.div<{ $x: number }>`
  position: absolute; top: 0; bottom: 0; left: ${(p) => p.$x}px; width: 2px;
  background: ${theme.colors.error}; z-index: 5; pointer-events: none;
`;

// ---- Component ----
interface Props { stories: Story[]; allTasks: Task[]; }

export function TimelineView({ stories, allTasks }: Props) {
  const isMobile = useIsMobile();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [viewStart, setViewStart] = useState(() => startOfWeek(addDays(today, -7)));
  const totalDays = 42; // 6 weeks
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(stories.map((s) => s.id)));

  const days = useMemo(() => Array.from({ length: totalDays }, (_, i) => addDays(viewStart, i)), [viewStart, totalDays]);
  const weeks = useMemo(() => {
    const w: { start: Date; days: number }[] = [];
    let curr = startOfWeek(days[0]); let n = 0;
    for (const d of days) { const ws = startOfWeek(d); if (ws.getTime() !== curr.getTime()) { w.push({ start: curr, days: n }); curr = ws; n = 1; } else n++; }
    if (n > 0) w.push({ start: curr, days: n });
    return w;
  }, [days]);

  const storyData = useMemo(() => stories.map((story, idx) => {
    const tasks = allTasks.filter((t) => t.story_id === story.id);
    // Task date range
    let taskMinDate: Date | null = null, taskMaxDate: Date | null = null;
    for (const t of tasks) {
      const s = parseD(t.start_date) || parseD(t.deadline);
      const e = parseD(t.deadline) || s;
      if (s && (!taskMinDate || s < taskMinDate)) taskMinDate = s;
      if (e && (!taskMaxDate || e > taskMaxDate)) taskMaxDate = e;
    }
    // Story's own dates
    const storyStart = parseD(story.start_date) || taskMinDate;
    const storyDeadline = parseD(story.deadline);
    // Effective range: story dates OR task dates (whichever is wider)
    const minDate = storyStart && taskMinDate ? (storyStart < taskMinDate ? storyStart : taskMinDate) : storyStart || taskMinDate;
    const maxDate = taskMaxDate && storyDeadline ? (taskMaxDate > storyDeadline ? taskMaxDate : storyDeadline) : taskMaxDate || storyDeadline;
    // Overtime: tasks extend beyond story deadline
    const hasOvertime = storyDeadline && taskMaxDate && taskMaxDate > storyDeadline;
    return { story, tasks, color: getColor(idx), minDate, maxDate, storyDeadline, hasOvertime };
  }), [stories, allTasks]);

  const todayX = daysBetween(viewStart, today) * 36 + 18;
  const toggle = (id: string) => setExpanded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const calcBar = (start: Date | null, end: Date | null) => {
    if (!start || !end) return null;
    const l = daysBetween(viewStart, start) * 36;
    const w = Math.max((daysBetween(start, end) + 1) * 36, 36);
    if (l + w < 0 || l > totalDays * 36) return null;
    return { left: l, width: w };
  };

  return (
    <Wrap>
      <Toolbar>
        <NavBtn onClick={() => setViewStart(addDays(viewStart, -7))}><FiChevronLeft /></NavBtn>
        <NavBtn onClick={() => setViewStart(addDays(viewStart, 7))}><FiChevronRight /></NavBtn>
        <TodayBtn onClick={() => setViewStart(startOfWeek(addDays(today, -7)))}>Today</TodayBtn>
        <RangeLabel>{fmtWeek(viewStart)}</RangeLabel>
      </Toolbar>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <ScrollArea>
        <Table>
          {/* ---- Left: names ---- */}
          <NameCol>
            <NameHeader>Task</NameHeader>
            {storyData.map(({ story, tasks, color }) => (
              <div key={story.id}>
                <StoryNameRow onClick={() => toggle(story.id)}>
                  <ExpandIcon>{expanded.has(story.id) ? <FiChevronDown /> : <FiExpand />}</ExpandIcon>
                  <StoryDot $c={color}>{story.title.charAt(0)}</StoryDot>
                  <StoryTitle>{story.title}</StoryTitle>
                  <span style={{ fontSize: '10px', color: theme.colors.cadetGray }}>{story.progress}%</span>
                </StoryNameRow>
                {expanded.has(story.id) && tasks.map((task) => (
                  <TaskNameRow key={task.id} onClick={() => setSelectedTaskId(task.id)}>
                    {task.assignee && <Avatar name={task.assignee.full_name} url={task.assignee.avatar_url} size={18} />}
                    <TaskTitle>{task.title}</TaskTitle>
                  </TaskNameRow>
                ))}
              </div>
            ))}
          </NameCol>

          {/* ---- Right: timeline ---- */}
          <TimeCol>
            {/* Week headers */}
            <div style={{ display: 'flex', height: 22, borderBottom: `1px solid ${theme.colors.border}` }}>
              {weeks.map((w, i) => <WeekLabel key={i} $w={w.days}>{fmtWeek(w.start)}</WeekLabel>)}
            </div>
            {/* Day numbers */}
            <div style={{ display: 'flex', height: 22, borderBottom: `1px solid ${theme.colors.border}` }}>
              {days.map((d, i) => (
                <DayLabel key={i} $today={d.getTime() === today.getTime()} $weekend={d.getDay() === 0 || d.getDay() === 6}>
                  {d.getDate()}
                </DayLabel>
              ))}
            </div>

            {/* Bars */}
            {storyData.map(({ story, tasks, color, minDate, maxDate, storyDeadline, hasOvertime }) => {
              const storyBar = calcBar(minDate, maxDate);
              // Overtime bar: from story deadline to task max date
              const overtimeBar = hasOvertime && storyDeadline ? calcBar(storyDeadline, maxDate) : null;
              return (
                <div key={story.id} style={{ position: 'relative' }}>
                  {/* Story aggregate bar */}
                  <BarArea $days={totalDays}>
                    {storyBar && (
                      <Bar $left={storyBar.left} $width={storyBar.width} $color={color} $progress={story.progress}
                        onClick={() => toggle(story.id)} style={{ cursor: 'pointer' }}>
                        <BarText $filled={story.progress > 30}>{story.title} — {story.progress}%</BarText>
                      </Bar>
                    )}
                    {overtimeBar && (
                      <OvertimeBar $left={overtimeBar.left} $width={overtimeBar.width} />
                    )}
                    {todayX > 0 && todayX < totalDays * 36 && <TodayLine $x={todayX} />}
                  </BarArea>

                  {/* Task bars */}
                  {expanded.has(story.id) && tasks.map((task) => {
                    const s = parseD(task.start_date) || parseD(task.deadline);
                    const e = parseD(task.deadline) || (s ? addDays(s, 5) : null);
                    const bar = calcBar(s, e);
                    return (
                      <BarArea key={task.id} $days={totalDays}>
                        {bar ? (
                          <Bar $left={bar.left} $width={bar.width} $color={color} $progress={task.progress}
                            onClick={() => setSelectedTaskId(task.id)}>
                            <BarText $filled={task.progress > 30}>{task.title}</BarText>
                          </Bar>
                        ) : (
                          <div style={{ height: ROW_H, display: 'flex', alignItems: 'center', paddingLeft: 8, fontSize: 11, color: theme.colors.cadetGray, fontStyle: 'italic' }}>
                            no dates set
                          </div>
                        )}
                        {todayX > 0 && todayX < totalDays * 36 && <TodayLine $x={todayX} />}
                      </BarArea>
                    );
                  })}
                </div>
              );
            })}
          </TimeCol>
        </Table>
      </ScrollArea>

      {selectedTaskId && (
        <TaskDetail taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} inline={!isMobile} />
      )}
      </div>
    </Wrap>
  );
}
