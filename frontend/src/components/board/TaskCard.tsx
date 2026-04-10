import { forwardRef } from 'react';
import styled from 'styled-components';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FiCalendar } from 'react-icons/fi';
import { theme } from '../../styles/theme';
import { Avatar } from '../ui/Avatar';
import { PriorityDot } from '../ui/Badge';
import type { Task, Priority } from '../../types';

const Card = styled.div<{ $isDragging: boolean; $isOverlay: boolean; $priority: Priority }>`
  background: ${(p) => p.$isDragging ? theme.colors.background : theme.colors.white};
  border: 1px solid ${(p) => p.$isDragging ? theme.colors.vividOrange + '40' : theme.colors.border};
  border-left: 4px solid ${(p) => p.$isDragging ? theme.colors.vividOrange + '40' : (theme.colors.priority[p.$priority] || theme.colors.border)};
  border-radius: ${theme.borderRadius.md};
  padding: 12px 14px;
  cursor: ${(p) => p.$isDragging ? 'grabbing' : 'grab'};
  transition: ${(p) => p.$isDragging ? 'none' : theme.transitions.default};
  box-shadow: ${(p) => p.$isOverlay ? theme.shadows.lg : p.$isDragging ? 'none' : '0 1px 3px rgba(0,0,0,0.06)'};
  opacity: ${(p) => p.$isDragging ? 0.35 : 1};

  ${(p) => !p.$isDragging && !p.$isOverlay && `
    &:hover {
      box-shadow: ${theme.shadows.card};
      transform: translateY(-1px);
    }
  `}
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
`;

const TaskId = styled.span`
  font-size: 11px;
  font-weight: ${theme.typography.fontWeight.medium};
  color: ${theme.colors.cadetGray};
  text-transform: uppercase;
`;

const Title = styled.div`
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  color: ${theme.colors.charcoal};
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 8px;
`;

const CardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${theme.spacing.sm};
`;

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
`;

const Deadline = styled.span<{ $overdue: boolean; $soon: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: ${(p) =>
    p.$overdue
      ? theme.colors.error
      : p.$soon
        ? theme.colors.warning
        : theme.colors.cadetGray};
  font-weight: ${(p) => (p.$overdue || p.$soon ? '600' : '400')};

  svg {
    width: 12px;
    height: 12px;
  }
`;

const SubtaskProgress = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: ${theme.colors.cadetGray};
`;

const ProgressBar = styled.div<{ $percent: number }>`
  width: 40px;
  height: 4px;
  background: ${theme.colors.lightGray};
  border-radius: 2px;
  overflow: hidden;

  &::after {
    content: '';
    display: block;
    width: ${(p) => p.$percent}%;
    height: 100%;
    background: ${(p) =>
      p.$percent === 100 ? theme.colors.success : theme.colors.vividOrange};
    border-radius: 2px;
    transition: width 0.3s ease;
  }
`;

function formatDeadline(deadline: string): string {
  const d = new Date(deadline);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
    const subtaskPercent =
      task.subtask_count > 0
        ? Math.round((task.subtask_done / task.subtask_count) * 100)
        : 0;

    return (
      <Card
        ref={ref}
        style={style}
        $isDragging={isDragging}
        $isOverlay={isOverlay}
        $priority={task.priority}
        onClick={() => onClick(task)}
      >
        <CardHeader>
          <TaskId>{task.story_title ? task.story_title.slice(0, 20) : 'Task'}</TaskId>
          <PriorityDot $priority={task.priority} />
        </CardHeader>

        <Title>{task.title}</Title>

        <CardFooter>
          <MetaRow>
            {task.deadline && (
              <Deadline
                $overdue={isOverdue(task.deadline)}
                $soon={isSoon(task.deadline)}
              >
                <FiCalendar />
                {formatDeadline(task.deadline)}
              </Deadline>
            )}
            {task.subtask_count > 0 && (
              <SubtaskProgress>
                <ProgressBar $percent={subtaskPercent} />
                {task.subtask_done}/{task.subtask_count}
              </SubtaskProgress>
            )}
          </MetaRow>
          {task.assignee && (
            <Avatar
              name={task.assignee.full_name}
              url={task.assignee.avatar_url}
              size={24}
            />
          )}
        </CardFooter>
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
