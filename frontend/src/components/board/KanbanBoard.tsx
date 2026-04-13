import { useState, useCallback, useRef, useMemo } from 'react';
import styled from 'styled-components';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  MeasuringStrategy,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { theme } from '../../styles/theme';
import { KanbanColumn } from './KanbanColumn';
import { TaskCardComponent } from './TaskCard';
import { TaskDetail } from './TaskDetail';
import { useIsMobile } from '../../hooks/useMediaQuery';
// Integer sort order: place between neighbors or at end
import type { Board, Task, TaskStatus } from '../../types';
import { TASK_STATUS_ORDER, TASK_STATUS_LABELS } from '../../types';

// Styled components
const Wrapper = styled.div`display: flex; flex: 1; overflow: hidden;`;
const DesktopBoard = styled.div`
  flex: 1; overflow-x: auto; overflow-y: hidden;
  padding: ${theme.spacing.md}; display: flex; gap: ${theme.spacing.md};
`;
const MobileBoard = styled.div`display: flex; flex-direction: column; flex: 1; overflow: hidden;`;
const StatusTabs = styled.div`
  display: flex; overflow-x: auto;
  border-bottom: 1px solid ${theme.colors.border};
  background: ${theme.colors.white}; flex-shrink: 0;
  padding: 0 ${theme.spacing.sm};
  &::-webkit-scrollbar { display: none; }
`;
const StatusTab = styled.button<{ $active: boolean; $color: string }>`
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${(p) => (p.$active ? '600' : '400')};
  color: ${(p) => (p.$active ? p.$color : theme.colors.cadetGray)};
  background: none; white-space: nowrap;
  border-bottom: 2px solid ${(p) => (p.$active ? p.$color : 'transparent')};
  transition: ${theme.transitions.default};
  &:hover { color: ${(p) => p.$color}; }
`;
const MobileCardList = styled.div`
  flex: 1; overflow-y: auto; padding: ${theme.spacing.md};
  display: flex; flex-direction: column; gap: ${theme.spacing.sm};
`;

// ---- Types ----
type ItemsMap = Record<string, string[]>;

function buildItemsMap(board: Board): ItemsMap {
  const map: ItemsMap = {};
  for (const col of board.columns) {
    map[col.status] = col.tasks.map((t) => t.id);
  }
  return map;
}

function buildTaskLookup(board: Board): Record<string, Task> {
  const lookup: Record<string, Task> = {};
  for (const col of board.columns) {
    for (const t of col.tasks) lookup[t.id] = t;
  }
  return lookup;
}

// ---- Measuring config: re-measure droppables frequently ----
const measuring = {
  droppable: { strategy: MeasuringStrategy.Always },
};

// ---- Component ----
interface KanbanBoardProps {
  board: Board;
  stories?: Array<{ id: string; title: string; progress: number }>;
  swimLanes?: boolean;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onPositionChange: (taskId: string, sortOrder: number, columnStatus: TaskStatus, reorderedTasks: Task[]) => void;
  onQuickAdd?: (status: TaskStatus) => void;
}

export function KanbanBoard({ board, stories, swimLanes = false, onStatusChange, onPositionChange, onQuickAdd }: KanbanBoardProps) {
  const isMobile = useIsMobile();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<TaskStatus>('in_progress');

  // ---- Core state: items map is THE source of truth for card ordering ----
  // Initialized from board and synced via ref tracking
  const [items, setItems] = useState<ItemsMap>(() => buildItemsMap(board));
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const clonedRef = useRef<ItemsMap | null>(null);

  // Track board version to know when to sync
  const lastBoardRef = useRef(board);
  if (board !== lastBoardRef.current && !activeId) {
    // Board changed and we're not dragging — sync items immediately (synchronous)
    lastBoardRef.current = board;
    // Only update if items actually differ
    const newItems = buildItemsMap(board);
    const needsUpdate = TASK_STATUS_ORDER.some(
      (s) => (newItems[s] || []).join(',') !== (items[s] || []).join(',')
    );
    if (needsUpdate) {
      setItems(newItems);
    }
  }

  const taskLookup = useMemo(() => buildTaskLookup(board), [board]);

  const findContainer = useCallback((id: UniqueIdentifier): string | undefined => {
    if (id in items) return id as string;
    return Object.keys(items).find((key) => items[key].includes(id as string));
  }, [items]);

  // Sensors
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } });
  const sensors = useSensors(pointerSensor, touchSensor);

  // ---- Handlers ----
  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    setActiveId(active.id);
    clonedRef.current = JSON.parse(JSON.stringify(items));
  }, [items]);

  // onDragOver: ONLY cross-column moves
  const handleDragOver = useCallback(({ active, over }: DragOverEvent) => {
    const overId = over?.id;
    if (overId == null || active.id === overId) return;

    const activeContainer = findContainer(active.id);
    const overContainer = findContainer(overId);
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setItems((prev) => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const activeIndex = activeItems.indexOf(active.id as string);
      const overIndex = overItems.indexOf(overId as string);

      const newIndex = overId in prev
        ? overItems.length
        : (overIndex >= 0 ? overIndex : overItems.length);

      return {
        ...prev,
        [activeContainer]: activeItems.filter((id) => id !== active.id),
        [overContainer]: [
          ...overItems.slice(0, newIndex),
          activeItems[activeIndex],
          ...overItems.slice(newIndex),
        ],
      };
    });
  }, [findContainer]);

  // onDragEnd: same-column arrayMove + commit
  const handleDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    const taskId = active.id as string;
    const task = taskLookup[taskId];

    if (!task || !over) {
      setActiveId(null);
      clonedRef.current = null;
      return;
    }

    const activeContainer = findContainer(taskId);
    const overContainer = findContainer(over.id);

    if (!activeContainer || !overContainer) {
      setActiveId(null);
      clonedRef.current = null;
      return;
    }

    // Same column: do arrayMove now (SortableContext only shows visual transforms)
    if (activeContainer === overContainer) {
      const activeIndex = items[overContainer].indexOf(taskId);
      const overIndex = items[overContainer].indexOf(over.id as string);

      if (activeIndex !== overIndex && activeIndex !== -1 && overIndex !== -1) {
        const newOrder = arrayMove(items[overContainer], activeIndex, overIndex);
        setItems((prev) => ({ ...prev, [overContainer]: newOrder }));

        // Commit to server
        const finalIdx = newOrder.indexOf(taskId);
        const colTasks = newOrder.map((id) => taskLookup[id]).filter(Boolean) as Task[];
        const beforeOrder = finalIdx > 0 ? colTasks[finalIdx - 1]?.sort_order : 0;
        const afterOrder = finalIdx < colTasks.length - 1 ? colTasks[finalIdx + 1]?.sort_order : beforeOrder + 2000;
        const newSortOrder = Math.floor((beforeOrder + afterOrder) / 2);
        const reordered = colTasks.map((t) => t.id === taskId ? { ...t, sort_order: newSortOrder } : t);
        onPositionChange(taskId, newSortOrder, overContainer as TaskStatus, reordered);
      }
    } else {
      // Cross column: items already updated by onDragOver, just commit
      const finalOrder = items[overContainer];
      const finalIdx = finalOrder.indexOf(taskId);
      const newStatus = overContainer as TaskStatus;

      const colTasks = finalOrder
        .map((id) => {
          const t = taskLookup[id];
          return t && id === taskId ? { ...t, status: newStatus } : t;
        })
        .filter(Boolean) as Task[];

      const beforeOrder = finalIdx > 0 ? colTasks[finalIdx - 1]?.sort_order : 0;
      const afterOrder = finalIdx < colTasks.length - 1 ? colTasks[finalIdx + 1]?.sort_order : beforeOrder + 2000;
      const newSortOrder = Math.floor((beforeOrder + afterOrder) / 2);
      const reordered = colTasks.map((t) => t.id === taskId ? { ...t, sort_order: newSortOrder, status: newStatus } : t);

      onPositionChange(taskId, newSortOrder, newStatus, reordered);
      onStatusChange(taskId, newStatus);
    }

    setActiveId(null);
    clonedRef.current = null;
  }, [findContainer, items, taskLookup, onStatusChange, onPositionChange]);

  const handleDragCancel = useCallback(() => {
    if (clonedRef.current) setItems(clonedRef.current);
    setActiveId(null);
    clonedRef.current = null;
  }, []);

  const handleTaskClick = useCallback((task: Task) => {
    if (activeId) return;
    setSelectedTaskId((prev) => (prev === task.id ? prev : task.id));
  }, [activeId]);

  const handleCloseDetail = useCallback(() => { setSelectedTaskId(null); }, []);

  const activeTask = activeId ? taskLookup[activeId as string] : null;

  // ---- Mobile ----
  if (isMobile) {
    const currentColumn = board.columns.find((c) => c.status === mobileTab);
    const tasks = currentColumn?.tasks || [];
    return (
      <MobileBoard>
        <StatusTabs>
          {TASK_STATUS_ORDER.map((status) => {
            const col = board.columns.find((c) => c.status === status);
            return (
              <StatusTab key={status} $active={mobileTab === status} $color={theme.colors.status[status]}
                onClick={() => setMobileTab(status)}>
                {TASK_STATUS_LABELS[status]} ({col?.count || 0})
              </StatusTab>
            );
          })}
        </StatusTabs>
        <MobileCardList>
          {tasks.length > 0 ? tasks.map((task) => (
            <TaskCardComponent key={task.id} task={task} onClick={handleTaskClick} />
          )) : (
            <div style={{ textAlign: 'center', color: theme.colors.cadetGray, padding: '32px' }}>
              No tasks in {TASK_STATUS_LABELS[mobileTab]}
            </div>
          )}
        </MobileCardList>
        {selectedTaskId && <TaskDetail taskId={selectedTaskId} onClose={handleCloseDetail} inline={false} />}
      </MobileBoard>
    );
  }

  // ---- Desktop ----
  return (
    <Wrapper>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        measuring={measuring}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <DesktopBoard>
          {TASK_STATUS_ORDER.map((status) => {
            const taskIds = items[status] || [];
            const tasks = taskIds.map((id) => taskLookup[id]).filter(Boolean) as Task[];
            return (
              <KanbanColumn key={status} status={status} tasks={tasks} stories={stories} swimLanes={swimLanes} onTaskClick={handleTaskClick} onQuickAdd={onQuickAdd} />
            );
          })}
        </DesktopBoard>

        <DragOverlay dropAnimation={null}>
          {activeTask ? <TaskCardComponent task={activeTask} onClick={() => {}} isOverlay /> : null}
        </DragOverlay>
      </DndContext>

      {selectedTaskId && <TaskDetail taskId={selectedTaskId} onClose={handleCloseDetail} inline={true} />}
    </Wrapper>
  );
}
