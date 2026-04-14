import { useState, useMemo } from 'react';
import styled from 'styled-components';
import { FiChevronRight, FiChevronDown, FiBookOpen, FiCheckSquare, FiList } from 'react-icons/fi';
import { theme } from '../../styles/theme';
import { Avatar } from '../ui/Avatar';
import { StatusBadge, PriorityBadge } from '../ui/Badge';
import { TaskDetail } from './TaskDetail';
import { StoryDetail } from './StoryDetail';
import { useIsMobile } from '../../hooks/useMediaQuery';
import type { Story, Task, Subtask } from '../../types';

// ---- Styled ----
const Container = styled.div`flex: 1; overflow: auto; display: flex;`;
const TableWrap = styled.div`flex: 1; overflow: auto;`;

const Table = styled.div`min-width: 900px;`;

const HeaderRow = styled.div`
  display: grid;
  grid-template-columns: 32px 2fr 110px 90px 140px 80px 100px 100px;
  align-items: center;
  padding: 8px 16px;
  background: ${theme.colors.background};
  border-bottom: 1px solid ${theme.colors.border};
  font-size: ${theme.typography.fontSize.xs};
  font-weight: ${theme.typography.fontWeight.semibold};
  color: ${theme.colors.cadetGray};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  position: sticky;
  top: 0;
  z-index: 10;
`;

const Row = styled.div<{ $level: number; $selected: boolean }>`
  display: grid;
  grid-template-columns: 32px 2fr 110px 90px 140px 80px 100px 100px;
  align-items: center;
  padding: 10px 16px;
  padding-left: ${(p) => 16 + p.$level * 24}px;
  border-bottom: 1px solid ${theme.colors.border};
  background: ${(p) => p.$selected ? theme.colors.vividOrange + '08' : theme.colors.white};
  cursor: pointer;
  transition: ${theme.transitions.default};
  font-size: ${theme.typography.fontSize.sm};

  &:hover {
    background: ${(p) => p.$selected ? theme.colors.vividOrange + '10' : theme.colors.background};
  }
`;

const ExpandBtn = styled.button<{ $visible: boolean }>`
  background: none;
  color: ${theme.colors.cadetGray};
  padding: 2px;
  display: flex;
  align-items: center;
  visibility: ${(p) => p.$visible ? 'visible' : 'hidden'};
  svg { width: 16px; height: 16px; }
  &:hover { color: ${theme.colors.charcoal}; }
`;

const TypeIcon = styled.span<{ $type: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  margin-right: 8px;
  flex-shrink: 0;
  background: ${(p) =>
    p.$type === 'story' ? '#7C3AED20' :
    p.$type === 'task' ? '#2196F320' : '#FF980020'};
  color: ${(p) =>
    p.$type === 'story' ? '#7C3AED' :
    p.$type === 'task' ? '#2196F3' : '#FF9800'};
  svg { width: 12px; height: 12px; }
`;

const TitleCell = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
`;

const TitleText = styled.span<{ $bold: boolean }>`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: ${(p) => p.$bold ? '600' : '400'};
`;

const ProgressBar = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const ProgressTrack = styled.div`
  width: 40px; height: 4px; background: ${theme.colors.lightGray};
  border-radius: 2px; overflow: hidden;
`;

const ProgressFill = styled.div<{ $pct: number }>`
  height: 100%; width: ${(p) => p.$pct}%;
  background: ${(p) => p.$pct === 100 ? theme.colors.success : theme.colors.vividOrange};
`;

const DateCell = styled.span<{ $overdue?: boolean }>`
  font-size: ${theme.typography.fontSize.xs};
  color: ${(p) => p.$overdue ? theme.colors.error : theme.colors.davysGray};
  font-weight: ${(p) => p.$overdue ? '600' : '400'};
`;

const EmptyMsg = styled.div`
  padding: 48px; text-align: center;
  color: ${theme.colors.cadetGray};
`;

// ---- Types ----
type RowData = {
  id: string;
  type: 'story' | 'task' | 'subtask';
  title: string;
  status: string;
  priority?: string;
  assignee?: { full_name: string; avatar_url?: string };
  progress: number;
  startDate?: string;
  deadline?: string;
  level: number;
  hasChildren: boolean;
  parentId?: string;
  raw: Story | Task | Subtask;
};

function formatDate(d?: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(d?: string): boolean {
  return !!d && new Date(d) < new Date();
}

// ---- Component ----
interface BacklogTableProps {
  stories: Story[];
  allTasks: Task[];
}

export function BacklogTable({ stories, allTasks }: BacklogTableProps) {
  const isMobile = useIsMobile();
  const [expandedStories, setExpandedStories] = useState<Set<string>>(() => new Set(stories.map((s) => s.id)));
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'story' | 'task' | 'subtask'>('task');

  // Build flat row list from hierarchy
  const rows = useMemo(() => {
    const result: RowData[] = [];

    for (const story of stories) {
      const storyTasks = allTasks.filter((t) => t.story_id === story.id);

      result.push({
        id: story.id,
        type: 'story',
        title: story.title,
        status: story.status,
        priority: story.priority,
        progress: story.progress,
        startDate: story.start_date,
        deadline: story.deadline,
        level: 0,
        hasChildren: storyTasks.length > 0,
        raw: story,
      });

      if (expandedStories.has(story.id)) {
        for (const task of storyTasks) {
          const subtasks = task.subtasks || [];

          result.push({
            id: task.id,
            type: 'task',
            title: task.title,
            status: task.status,
            priority: task.priority,
            assignee: task.assignee ? { full_name: task.assignee.full_name, avatar_url: task.assignee.avatar_url } : undefined,
            progress: task.progress,
            startDate: task.start_date,
            deadline: task.deadline,
            level: 1,
            hasChildren: subtasks.length > 0,
            parentId: story.id,
            raw: task,
          });

          if (expandedTasks.has(task.id)) {
            for (const sub of subtasks) {
              result.push({
                id: sub.id,
                type: 'subtask',
                title: sub.title,
                status: sub.status,
                assignee: sub.assignee ? { full_name: sub.assignee.full_name, avatar_url: sub.assignee.avatar_url } : undefined,
                progress: sub.progress,
                startDate: sub.start_date,
                deadline: sub.deadline,
                level: 2,
                hasChildren: false,
                parentId: task.id,
                raw: sub,
              });
            }
          }
        }
      }
    }
    return result;
  }, [stories, allTasks, expandedStories, expandedTasks]);

  const toggleExpand = (id: string, type: string) => {
    if (type === 'story') {
      setExpandedStories((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    } else if (type === 'task') {
      setExpandedTasks((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    }
  };

  const handleRowClick = (row: RowData) => {
    setSelectedId(row.id);
    setSelectedType(row.type);
  };

  return (
    <Container>
      <TableWrap>
        <Table>
          <HeaderRow>
            <div></div>
            <div>Title</div>
            <div>Status</div>
            <div>Priority</div>
            <div>Assignee</div>
            <div>Progress</div>
            <div>Start</div>
            <div>Deadline</div>
          </HeaderRow>

          {rows.length === 0 ? (
            <EmptyMsg>No stories or tasks yet</EmptyMsg>
          ) : (
            rows.map((row) => (
              <Row
                key={row.id}
                $level={row.level}
                $selected={selectedId === row.id}
                onClick={() => handleRowClick(row)}
              >
                <ExpandBtn
                  $visible={row.hasChildren}
                  onClick={(e) => { e.stopPropagation(); toggleExpand(row.id, row.type); }}
                >
                  {row.hasChildren && (
                    (row.type === 'story' ? expandedStories : expandedTasks).has(row.id)
                      ? <FiChevronDown /> : <FiChevronRight />
                  )}
                </ExpandBtn>

                <TitleCell>
                  <TypeIcon $type={row.type}>
                    {row.type === 'story' ? <FiBookOpen /> : row.type === 'task' ? <FiCheckSquare /> : <FiList />}
                  </TypeIcon>
                  <TitleText $bold={row.type === 'story'}>{row.title}</TitleText>
                </TitleCell>

                <div><StatusBadge status={row.status} /></div>

                <div>{row.priority && <PriorityBadge priority={row.priority as 'critical' | 'high' | 'medium' | 'low'} />}</div>

                <div>
                  {row.assignee ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Avatar name={row.assignee.full_name} url={row.assignee.avatar_url} size={22} />
                      <span style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.assignee.full_name}
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: theme.colors.cadetGray, fontSize: '12px' }}>—</span>
                  )}
                </div>

                <ProgressBar>
                  <ProgressTrack><ProgressFill $pct={row.progress} /></ProgressTrack>
                  <span style={{ fontSize: '11px', color: theme.colors.cadetGray }}>{row.progress}%</span>
                </ProgressBar>

                <DateCell>{formatDate(row.startDate)}</DateCell>
                <DateCell $overdue={isOverdue(row.deadline)}>{formatDate(row.deadline)}</DateCell>
              </Row>
            ))
          )}
        </Table>
      </TableWrap>

      {selectedId && selectedType === 'task' && (
        <TaskDetail
          taskId={selectedId}
          onClose={() => setSelectedId(null)}
          inline={!isMobile}
        />
      )}
      {selectedId && selectedType === 'story' && (
        <StoryDetail
          storyId={selectedId}
          onClose={() => setSelectedId(null)}
          onTaskClick={(taskId) => { setSelectedId(taskId); setSelectedType('task'); }}
          inline={!isMobile}
        />
      )}
    </Container>
  );
}
