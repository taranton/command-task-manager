import { forwardRef, useState, useEffect } from 'react';
import styled, { css } from 'styled-components';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FiCalendar, FiCheckSquare, FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { theme } from '../../styles/theme';
import { api } from '../../lib/api';
import { Avatar } from '../ui/Avatar';
import type { Task, Priority, Subtask } from '../../types';
import { PRIORITY_LABELS } from '../../types';

const PRIORITY_CONFIG: Record<Priority, { bg: string; color: string }> = {
  critical: { bg: '#FFEBEE', color: '#F44336' },
  high: { bg: '#FFF3E0', color: '#FF9800' },
  medium: { bg: '#E3F2FD', color: '#2196F3' },
  low: { bg: '#E8F5E9', color: '#4CAF50' },
};

const Card = styled.div<{ $isDragging: boolean; $isOverlay: boolean; $isDone: boolean }>`
  background: ${theme.colors.white};
  border: 1px solid ${(p) => p.$isDragging ? theme.colors.vividOrange + '40' : theme.colors.border};
  border-radius: ${theme.borderRadius.lg};
  padding: 12px 14px;
  cursor: ${(p) => p.$isDragging ? 'grabbing' : 'grab'};
  transition: ${(p) => p.$isDragging ? 'none' : theme.transitions.default};
  box-shadow: ${(p) => p.$isOverlay ? theme.shadows.lg : p.$isDragging ? 'none' : '0 1px 2px rgba(0,0,0,0.04)'};
  opacity: ${(p) => p.$isDragging ? 0.35 : p.$isDone ? 0.55 : 1};
  ${(p) => !p.$isDragging && !p.$isOverlay && css`
    &:hover { box-shadow: ${theme.shadows.card}; border-color: ${theme.colors.silver}; }
  `}
`;

const CardTop = styled.div`
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: ${theme.spacing.sm}; margin-bottom: 6px;
`;
const Title = styled.div`
  font-size: ${theme.typography.fontSize.sm}; font-weight: ${theme.typography.fontWeight.semibold};
  color: ${theme.colors.charcoal}; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; flex: 1;
`;
const PriorityBadge = styled.span<{ $priority: Priority }>`
  display: inline-flex; align-items: center; padding: 2px 8px;
  border-radius: ${theme.borderRadius.pill}; font-size: 10px;
  font-weight: ${theme.typography.fontWeight.semibold}; white-space: nowrap; flex-shrink: 0;
  background: ${(p) => PRIORITY_CONFIG[p.$priority]?.bg || theme.colors.lightGray};
  color: ${(p) => PRIORITY_CONFIG[p.$priority]?.color || theme.colors.cadetGray};
`;

const StoryMarker = styled.div`
  display: flex; align-items: center; gap: 4px;
  font-size: 11px; color: ${theme.colors.cadetGray}; margin-bottom: 6px;
`;
const StoryDot = styled.span<{ $color: string }>`
  width: 6px; height: 6px; border-radius: 50%; background: ${(p) => p.$color}; flex-shrink: 0;
`;

const CardMeta = styled.div`
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
`;
const MetaItem = styled.span<{ $color?: string }>`
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 11px; color: ${(p) => p.$color || theme.colors.cadetGray};
  svg { width: 12px; height: 12px; }
`;
const ProgressTrack = styled.div`
  width: 36px; height: 3px; background: ${theme.colors.lightGray}; border-radius: 2px; overflow: hidden;
`;
const ProgressFill = styled.div<{ $pct: number }>`
  height: 100%; width: ${(p) => p.$pct}%;
  background: ${(p) => p.$pct === 100 ? theme.colors.success : theme.colors.vividOrange};
`;
const CardBottom = styled.div`
  display: flex; align-items: center; justify-content: space-between; margin-top: 8px;
`;

const ExpandBtn = styled.button`
  display: flex; align-items: center; gap: 4px;
  font-size: 11px; color: ${theme.colors.cadetGray}; background: none;
  padding: 4px 0; margin-top: 6px;
  &:hover { color: ${theme.colors.charcoal}; }
  svg { width: 12px; height: 12px; }
`;
const SubtaskList = styled.div`
  margin-top: 6px; padding: 6px 0;
  border-top: 1px solid ${theme.colors.border};
  display: flex; flex-direction: column; gap: 4px;
`;
const SubtaskRow = styled.div<{ $done: boolean }>`
  font-size: 12px; padding: 2px 0;
  color: ${(p) => p.$done ? theme.colors.cadetGray : theme.colors.charcoal};
  text-decoration: ${(p) => p.$done ? 'line-through' : 'none'};
`;

// Story color by index (deterministic)
const STORY_COLORS = ['#7C3AED', '#2196F3', '#FF9800', '#4CAF50', '#F44336', '#00BCD4', '#E91E63'];
function storyColor(storyTitle?: string): string {
  if (!storyTitle) return theme.colors.cadetGray;
  let hash = 0;
  for (let i = 0; i < storyTitle.length; i++) hash = storyTitle.charCodeAt(i) + ((hash << 5) - hash);
  return STORY_COLORS[Math.abs(hash) % STORY_COLORS.length];
}

function formatDeadline(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function isOverdue(d: string): boolean { return new Date(d) < new Date(); }
function isSoon(d: string): boolean { const diff = new Date(d).getTime() - Date.now(); return diff > 0 && diff < 2 * 86400000; }

interface TaskCardProps {
  task: Task;
  onClick: (task: Task) => void;
  hideStoryMarker?: boolean;
}

export const TaskCardComponent = forwardRef<HTMLDivElement, TaskCardProps & { isDragging?: boolean; isOverlay?: boolean; style?: React.CSSProperties }>(
  ({ task, onClick, hideStoryMarker = false, isDragging = false, isOverlay = false, style }, ref) => {
    const [showSubtasks, setShowSubtasks] = useState(false);
    const [loadedSubtasks, setLoadedSubtasks] = useState<Subtask[]>([]);
    const subtaskPct = task.subtask_count > 0 ? Math.round((task.subtask_done / task.subtask_count) * 100) : 0;
    const isDone = task.status === 'done';
    const deadlineOver = task.deadline ? isOverdue(task.deadline) : false;
    const deadlineSoonV = task.deadline ? isSoon(task.deadline) : false;

    // Fetch subtasks on demand
    useEffect(() => {
      if (showSubtasks && loadedSubtasks.length === 0 && task.subtask_count > 0) {
        api.get<Subtask[]>(`/api/v1/tasks/${task.id}/subtasks`).then(setLoadedSubtasks).catch(() => {});
      }
    }, [showSubtasks, task.id, task.subtask_count, loadedSubtasks.length]);

    const subtasks = task.subtasks?.length ? task.subtasks : loadedSubtasks;

    return (
      <Card ref={ref} style={style} $isDragging={isDragging} $isOverlay={isOverlay} $isDone={isDone}
        onClick={() => onClick(task)}>

        {/* Story marker */}
        {!hideStoryMarker && task.story_title && (
          <StoryMarker>
            <StoryDot $color={storyColor(task.story_title)} />
            {task.story_title}
          </StoryMarker>
        )}

        <CardTop>
          <Title>{task.title}</Title>
          <PriorityBadge $priority={task.priority}>{PRIORITY_LABELS[task.priority]}</PriorityBadge>
        </CardTop>

        <CardBottom>
          <CardMeta>
            {task.assignee && <Avatar name={task.assignee.full_name} url={task.assignee.avatar_url} size={22} />}
            {task.subtask_count > 0 && (
              <>
                <MetaItem><FiCheckSquare /> {task.subtask_done}/{task.subtask_count}</MetaItem>
                <ProgressTrack><ProgressFill $pct={subtaskPct} /></ProgressTrack>
              </>
            )}
            {task.deadline && (
              <MetaItem $color={deadlineOver ? theme.colors.error : deadlineSoonV ? theme.colors.warning : undefined}>
                <FiCalendar /> {formatDeadline(task.deadline)}
              </MetaItem>
            )}
            {/* Comment count placeholder — needs backend to include count */}
            {/* <MetaItem><FiMessageCircle /> 3</MetaItem> */}
          </CardMeta>
        </CardBottom>

        {/* Expand subtasks */}
        {task.subtask_count > 0 && (
          <ExpandBtn onClick={(e) => { e.stopPropagation(); setShowSubtasks(!showSubtasks); }}>
            {showSubtasks ? <FiChevronDown /> : <FiChevronRight />}
            {showSubtasks ? 'Hide subtasks' : 'Show subtasks'}
          </ExpandBtn>
        )}
        {showSubtasks && (
          <SubtaskList onClick={(e) => e.stopPropagation()}>
            {subtasks.length > 0 ? subtasks.map((s) => (
              <SubtaskRow key={s.id} $done={s.status === 'done'}>{s.title}</SubtaskRow>
            )) : (
              <SubtaskRow $done={false} style={{ color: theme.colors.cadetGray, fontStyle: 'italic' }}>Loading...</SubtaskRow>
            )}
          </SubtaskList>
        )}
      </Card>
    );
  }
);

TaskCardComponent.displayName = 'TaskCard';

export function SortableTaskCard({ task, onClick, hideStoryMarker }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, data: { task } });
  const style: React.CSSProperties = { transform: CSS.Translate.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCardComponent task={task} onClick={onClick} isDragging={isDragging} hideStoryMarker={hideStoryMarker} />
    </div>
  );
}
