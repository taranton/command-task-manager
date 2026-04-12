import { forwardRef } from 'react';
import styled, { css } from 'styled-components';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FiCalendar, FiCheckSquare } from 'react-icons/fi';
import { theme } from '../../styles/theme';
import { Avatar } from '../ui/Avatar';
import type { Task, Priority } from '../../types';
import { PRIORITY_LABELS } from '../../types';

// Priority badge colors matching Figma
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
  padding: 14px;
  cursor: ${(p) => p.$isDragging ? 'grabbing' : 'grab'};
  transition: ${(p) => p.$isDragging ? 'none' : theme.transitions.default};
  box-shadow: ${(p) => p.$isOverlay ? theme.shadows.lg : p.$isDragging ? 'none' : '0 1px 2px rgba(0,0,0,0.04)'};
  opacity: ${(p) => p.$isDragging ? 0.35 : p.$isDone ? 0.55 : 1};

  ${(p) => !p.$isDragging && !p.$isOverlay && css`
    &:hover {
      box-shadow: ${theme.shadows.card};
      border-color: ${theme.colors.silver};
    }
  `}
`;

const CardTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${theme.spacing.sm};
  margin-bottom: 10px;
`;

const Title = styled.div`
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.semibold};
  color: ${theme.colors.charcoal};
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
`;

const PriorityBadge = styled.span<{ $priority: Priority }>`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: ${theme.borderRadius.pill};
  font-size: 10px;
  font-weight: ${theme.typography.fontWeight.semibold};
  white-space: nowrap;
  flex-shrink: 0;
  background: ${(p) => PRIORITY_CONFIG[p.$priority]?.bg || theme.colors.lightGray};
  color: ${(p) => PRIORITY_CONFIG[p.$priority]?.color || theme.colors.cadetGray};
`;

const CardMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`;

const MetaItem = styled.span<{ $color?: string }>`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: ${(p) => p.$color || theme.colors.cadetGray};
  svg { width: 12px; height: 12px; }
`;

const SubtaskBar = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const ProgressTrack = styled.div`
  width: 36px;
  height: 3px;
  background: ${theme.colors.lightGray};
  border-radius: 2px;
  overflow: hidden;
`;

const ProgressFill = styled.div<{ $percent: number }>`
  height: 100%;
  width: ${(p) => p.$percent}%;
  background: ${(p) => p.$percent === 100 ? theme.colors.success : theme.colors.vividOrange};
  border-radius: 2px;
`;

const CardBottom = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
`;

const AvatarGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

function formatDeadline(deadline: string): string {
  return new Date(deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOverdue(deadline: string): boolean {
  return new Date(deadline) < new Date();
}

function isSoon(deadline: string): boolean {
  const diff = new Date(deadline).getTime() - Date.now();
  return diff > 0 && diff < 2 * 24 * 60 * 60 * 1000;
}

interface TaskCardProps {
  task: Task;
  onClick: (task: Task) => void;
}

export const TaskCardComponent = forwardRef<HTMLDivElement, TaskCardProps & { isDragging?: boolean; isOverlay?: boolean; style?: React.CSSProperties }>(
  ({ task, onClick, isDragging = false, isOverlay = false, style }, ref) => {
    const subtaskPercent = task.subtask_count > 0
      ? Math.round((task.subtask_done / task.subtask_count) * 100)
      : 0;
    const isDone = task.status === 'done';
    const deadlineOverdue = task.deadline ? isOverdue(task.deadline) : false;
    const deadlineSoon = task.deadline ? isSoon(task.deadline) : false;

    return (
      <Card
        ref={ref}
        style={style}
        $isDragging={isDragging}
        $isOverlay={isOverlay}
        $isDone={isDone}
        onClick={() => onClick(task)}
      >
        <CardTop>
          <Title>{task.title}</Title>
          <PriorityBadge $priority={task.priority}>
            {PRIORITY_LABELS[task.priority]}
          </PriorityBadge>
        </CardTop>

        <CardBottom>
          <CardMeta>
            {task.deadline && (
              <MetaItem $color={deadlineOverdue ? theme.colors.error : deadlineSoon ? theme.colors.warning : undefined}>
                <FiCalendar />
                {formatDeadline(task.deadline)}
              </MetaItem>
            )}
            {task.subtask_count > 0 && (
              <SubtaskBar>
                <MetaItem>
                  <FiCheckSquare />
                  {task.subtask_done}/{task.subtask_count}
                </MetaItem>
                <ProgressTrack>
                  <ProgressFill $percent={subtaskPercent} />
                </ProgressTrack>
              </SubtaskBar>
            )}
            {/* Comment count — placeholder, needs API to return count */}
            {/* <MetaItem><FiMessageCircle /> 3</MetaItem> */}
          </CardMeta>

          <AvatarGroup>
            {task.assignee && (
              <Avatar
                name={task.assignee.full_name}
                url={task.assignee.avatar_url}
                size={24}
              />
            )}
          </AvatarGroup>
        </CardBottom>
      </Card>
    );
  }
);

TaskCardComponent.displayName = 'TaskCard';

// Sortable wrapper for DnD-kit
export function SortableTaskCard({ task, onClick }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { task } });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCardComponent task={task} onClick={onClick} isDragging={isDragging} />
    </div>
  );
}
