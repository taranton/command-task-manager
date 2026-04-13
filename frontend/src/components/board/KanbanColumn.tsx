import styled from 'styled-components';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { FiPlus } from 'react-icons/fi';
import { theme } from '../../styles/theme';
import { SortableTaskCard } from './TaskCard';
import type { Task, TaskStatus } from '../../types';
import { TASK_STATUS_LABELS } from '../../types';

const Column = styled.div<{ $isOver: boolean }>`
  min-width: ${theme.layout.kanbanColumnWidth};
  max-width: ${theme.layout.kanbanColumnWidth};
  background: ${(p) => (p.$isOver ? '#FFF8F0' : theme.colors.background)};
  border-radius: ${theme.borderRadius.lg};
  padding: ${theme.spacing.sm};
  display: flex;
  flex-direction: column;
  max-height: 100%;
  transition: background 0.15s ease;
`;

const ColumnHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.sm} ${theme.spacing.sm};
  margin-bottom: ${theme.spacing.sm};
  flex-shrink: 0;
`;

const StatusDot = styled.div<{ $color: string }>`
  width: 8px;
  height: 8px;
  border-radius: ${theme.borderRadius.round};
  background: ${(p) => p.$color};
  flex-shrink: 0;
`;

const ColumnTitle = styled.span`
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.semibold};
  color: ${theme.colors.charcoal};
`;

const ColumnCount = styled.span`
  font-size: ${theme.typography.fontSize.xs};
  color: ${theme.colors.cadetGray};
  background: ${theme.colors.lightGray};
  padding: 1px 8px;
  border-radius: ${theme.borderRadius.pill};
`;

const CardList = styled.div`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
  padding: 2px;
  min-height: 40px;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: ${theme.colors.silver}; border-radius: 2px; }
`;

const EmptyState = styled.div`
  border: 2px dashed ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  padding: ${theme.spacing.lg};
  text-align: center;
  color: ${theme.colors.cadetGray};
  font-size: ${theme.typography.fontSize.sm};
`;

const QuickAddBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px ${theme.spacing.sm};
  margin-top: ${theme.spacing.sm};
  color: ${theme.colors.cadetGray};
  font-size: ${theme.typography.fontSize.sm};
  background: none;
  border-radius: ${theme.borderRadius.md};
  transition: ${theme.transitions.default};
  flex-shrink: 0;

  &:hover {
    background: ${theme.colors.white};
    color: ${theme.colors.charcoal};
  }

  svg { width: 14px; height: 14px; }
`;

// Swim lane header
const STORY_COLORS = ['#7C3AED', '#2196F3', '#FF9800', '#4CAF50', '#F44336', '#00BCD4', '#E91E63'];
function storyColor(title: string): string {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = title.charCodeAt(i) + ((h << 5) - h);
  return STORY_COLORS[Math.abs(h) % STORY_COLORS.length];
}

const SwimLaneHeader = styled.div<{ $color: string }>`
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 10px; margin: 4px 0;
  background: ${(p) => p.$color}15;
  border-left: 3px solid ${(p) => p.$color};
  border-radius: ${theme.borderRadius.sm};
  font-size: 11px; font-weight: ${theme.typography.fontWeight.semibold};
  color: ${(p) => p.$color};
`;
const SwimProgress = styled.span`font-size: 10px; opacity: 0.7;`;

interface StoryInfo {
  id: string;
  title: string;
  progress: number;
}

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  stories?: StoryInfo[];
  swimLanes?: boolean;
  onTaskClick: (task: Task) => void;
  onQuickAdd?: (status: TaskStatus) => void;
}

export function KanbanColumn({ status, tasks, stories, swimLanes = false, onTaskClick, onQuickAdd }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const color = theme.colors.status[status] || theme.colors.cadetGray;

  // Group tasks by story for swim lanes
  const groupedTasks = swimLanes ? (() => {
    const groups: { story: StoryInfo | null; tasks: Task[] }[] = [];
    const byStory = new Map<string, Task[]>();
    for (const t of tasks) {
      const key = t.story_id || 'none';
      if (!byStory.has(key)) byStory.set(key, []);
      byStory.get(key)!.push(t);
    }
    for (const [storyId, storyTasks] of byStory) {
      const story = stories?.find((s) => s.id === storyId) || null;
      groups.push({ story, tasks: storyTasks });
    }
    return groups;
  })() : null;

  return (
    <Column ref={setNodeRef} $isOver={isOver}>
      <ColumnHeader>
        <StatusDot $color={color} />
        <ColumnTitle>{TASK_STATUS_LABELS[status]}</ColumnTitle>
        <ColumnCount>{tasks.length}</ColumnCount>
      </ColumnHeader>

      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <CardList>
          {tasks.length > 0 ? (
            swimLanes && groupedTasks ? (
              // Flat list with headers injected between groups (no wrapper divs)
              groupedTasks.flatMap((group) => {
                const items: React.ReactNode[] = [];
                if (group.story) {
                  items.push(
                    <SwimLaneHeader key={`lane-${group.story.id}`} $color={storyColor(group.story.title)}>
                      {group.story.title}
                      <SwimProgress>{group.story.progress}%</SwimProgress>
                    </SwimLaneHeader>
                  );
                }
                group.tasks.forEach((task) => {
                  items.push(
                    <SortableTaskCard key={task.id} task={task} onClick={onTaskClick} hideStoryMarker />
                  );
                });
                return items;
              })
            ) : (
              tasks.map((task) => (
                <SortableTaskCard key={task.id} task={task} onClick={onTaskClick} />
              ))
            )
          ) : (
            <EmptyState>No tasks</EmptyState>
          )}
        </CardList>
      </SortableContext>

      {onQuickAdd && (
        <QuickAddBtn onClick={() => onQuickAdd(status)}>
          <FiPlus /> Add task
        </QuickAddBtn>
      )}
    </Column>
  );
}
