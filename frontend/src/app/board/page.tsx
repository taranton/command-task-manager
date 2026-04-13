import { useState, useCallback } from 'react';
import styled from 'styled-components';
import { FiPlus, FiFilter, FiX, FiChevronDown } from 'react-icons/fi';
import { theme } from '../../styles/theme';
import { api } from '../../lib/api';
import { KanbanBoard } from '../../components/board/KanbanBoard';
import { BacklogTable } from '../../components/board/BacklogTable';
import { CreateTaskModal } from '../../components/forms/CreateTask';
import { CreateStoryModal } from '../../components/forms/CreateStory';
import { Avatar } from '../../components/ui/Avatar';
import {
  useBoardData,
  useStories,
  useUpdateTaskStatus,
  useUpdateTaskPosition,
  useCreateStory,
} from '../../hooks/useBoardData';
import { useUsers, useTeams } from '../../hooks/useUsers';
import { useAuth } from '../../hooks/useAuth';
import { useIsMobile } from '../../hooks/useMediaQuery';
import type { BoardFilter, TaskStatus, Task, Priority } from '../../types';

// ---- Layout ----
const Container = styled.div`height: 100%; display: flex; flex-direction: column;`;

const Header = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  padding: ${theme.spacing.md} ${theme.spacing.lg};
  background: ${theme.colors.white};
  border-bottom: 1px solid ${theme.colors.border};
  flex-shrink: 0;
  @media (max-width: ${theme.breakpoints.sm}) { padding: ${theme.spacing.sm} ${theme.spacing.md}; }
`;

const HeaderLeft = styled.div`display: flex; align-items: center; gap: ${theme.spacing.md};`;

const PageTitle = styled.h1`
  font-family: ${theme.typography.fontFamily.primary};
  font-size: ${theme.typography.fontSize['2xl']};
  font-weight: ${theme.typography.fontWeight.bold};
  @media (max-width: ${theme.breakpoints.sm}) { font-size: ${theme.typography.fontSize.lg}; }
`;

const ViewSwitcher = styled.div`
  display: flex; background: ${theme.colors.background};
  border-radius: ${theme.borderRadius.md}; padding: 2px;
`;
const ViewBtn = styled.button<{ $active: boolean }>`
  padding: 6px 14px; border-radius: ${theme.borderRadius.sm};
  font-size: ${theme.typography.fontSize.xs}; font-weight: ${theme.typography.fontWeight.medium};
  background: ${(p) => p.$active ? theme.colors.white : 'transparent'};
  color: ${(p) => p.$active ? theme.colors.charcoal : theme.colors.cadetGray};
  box-shadow: ${(p) => p.$active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'};
  transition: ${theme.transitions.default};
`;

const AddBtn = styled.button`
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 18px; background: ${theme.colors.vividOrange}; color: white;
  border-radius: ${theme.borderRadius.md};
  font-size: ${theme.typography.fontSize.sm}; font-weight: ${theme.typography.fontWeight.semibold};
  transition: ${theme.transitions.default};
  &:hover { background: ${theme.colors.deepOrange}; transform: translateY(-1px); box-shadow: 0 4px 8px rgba(255, 141, 0, 0.3); }
  svg { width: 16px; height: 16px; }
`;

// ---- Filter Bar ----
const Filters = styled.div`
  display: flex; align-items: center; gap: 6px;
  padding: 8px ${theme.spacing.lg}; background: ${theme.colors.white};
  border-bottom: 1px solid ${theme.colors.border}; flex-shrink: 0;
  overflow: visible; position: relative; z-index: 100;
  @media (max-width: ${theme.breakpoints.sm}) { padding: 8px ${theme.spacing.md}; overflow-x: auto; }
`;

const FilterIcon = styled.div`
  display: flex; align-items: center; color: ${theme.colors.cadetGray};
  margin-right: 4px; flex-shrink: 0;
`;

const Chip = styled.button<{ $active: boolean; $highlight?: boolean }>`
  display: inline-flex; align-items: center; gap: 4px;
  padding: 5px 12px; white-space: nowrap;
  border-radius: ${theme.borderRadius.pill};
  font-size: ${theme.typography.fontSize.xs}; font-weight: ${theme.typography.fontWeight.medium};
  transition: ${theme.transitions.default};
  background: ${(p) => p.$active ? (p.$highlight ? theme.colors.vividOrange : theme.colors.charcoal) : theme.colors.white};
  color: ${(p) => p.$active ? 'white' : theme.colors.davysGray};
  border: 1px solid ${(p) => p.$active ? 'transparent' : theme.colors.border};
  &:hover { border-color: ${theme.colors.charcoal}; }
  svg { width: 12px; height: 12px; }
`;

const ChipWrap = styled.div`position: relative; flex-shrink: 0;`;

const Dropdown = styled.div`
  position: absolute; top: calc(100% + 4px); left: 0; z-index: 200;
  background: white; border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md}; box-shadow: ${theme.shadows.md};
  min-width: 200px; max-height: 280px; overflow-y: auto;
`;
const DropItem = styled.button<{ $active?: boolean }>`
  width: 100%; text-align: left; padding: 8px 14px;
  font-size: ${theme.typography.fontSize.sm}; display: flex; align-items: center; gap: 8px;
  background: ${(p) => p.$active ? theme.colors.background : 'transparent'};
  color: ${theme.colors.charcoal}; transition: ${theme.transitions.default};
  &:hover { background: ${theme.colors.background}; }
`;
const ActiveFilters = styled.div`
  display: flex; align-items: center; gap: 6px; margin-left: auto; flex-shrink: 0;
`;
const ClearBtn = styled.button`
  font-size: ${theme.typography.fontSize.xs}; color: ${theme.colors.cadetGray};
  background: none; text-decoration: underline; &:hover { color: ${theme.colors.charcoal}; }
`;

// ---- States ----
const CenterMsg = styled.div<{ $error?: boolean }>`
  flex: 1; display: flex; align-items: center; justify-content: center;
  color: ${(p) => p.$error ? theme.colors.error : theme.colors.cadetGray};
`;

// ---- FAB ----
const Fab = styled.button`
  position: fixed; bottom: calc(${theme.layout.bottomNavHeight} + 16px); right: 16px;
  width: 56px; height: 56px; border-radius: ${theme.borderRadius.round};
  background: ${theme.colors.vividOrange}; color: white;
  display: flex; align-items: center; justify-content: center;
  box-shadow: ${theme.shadows.fab}; z-index: 999; transition: ${theme.transitions.default};
  &:hover { transform: scale(1.05); }
  &:active { transform: scale(0.95); }
  svg { width: 24px; height: 24px; }
`;

// ---- Helpers ----
const PRIORITY_LABELS: Record<string, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
const PRIORITY_COLORS: Record<string, string> = {
  critical: theme.colors.priority.critical, high: theme.colors.priority.high,
  medium: theme.colors.priority.medium, low: theme.colors.priority.low,
};

export default function BoardPage() {
  const isMobile = useIsMobile();
  const { user: me } = useAuth();
  const [viewMode, setViewMode] = useState<'kanban' | 'backlog'>('kanban');
  const [filter, setFilter] = useState<BoardFilter>({});
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [createTaskStoryId, setCreateTaskStoryId] = useState<string>('');
  const [openDrop, setOpenDrop] = useState<string | null>(null);

  const { data: board, isLoading, error } = useBoardData(filter);
  const { data: storiesData } = useStories();
  const { data: allUsers } = useUsers();
  const { data: allTeams } = useTeams();
  const stories = storiesData?.data || [];

  const updateStatus = useUpdateTaskStatus();
  const updatePosition = useUpdateTaskPosition();
  const createStory = useCreateStory();
  const firstStory = stories[0];

  const handleStatusChange = useCallback(
    (taskId: string, newStatus: TaskStatus) => { updateStatus.mutate({ id: taskId, status: newStatus }); },
    [updateStatus]
  );
  const handlePositionChange = useCallback(
    (taskId: string, sortOrder: number, columnStatus: TaskStatus, reorderedTasks: Task[]) => {
      updatePosition.mutate({ id: taskId, sort_order: sortOrder, reorderedColumn: { status: columnStatus, tasks: reorderedTasks } });
    },
    [updatePosition]
  );

  const activeFilterCount = [filter.story_id, filter.assignee_id, filter.team_id, filter.priority].filter(Boolean).length;
  const clearFilters = () => setFilter({});

  const toggleDrop = (name: string) => setOpenDrop((prev) => prev === name ? null : name);

  if (error) {
    return <Container><Header><HeaderLeft><PageTitle>Board</PageTitle></HeaderLeft></Header><CenterMsg $error>Failed to load board</CenterMsg></Container>;
  }

  return (
    <Container>
      {/* ---- Header ---- */}
      <Header>
        <HeaderLeft>
          <PageTitle>Board</PageTitle>
          <ViewSwitcher>
            <ViewBtn $active={viewMode === 'kanban'} onClick={() => setViewMode('kanban')}>Kanban</ViewBtn>
            <ViewBtn $active={viewMode === 'backlog'} onClick={() => setViewMode('backlog')}>Backlog</ViewBtn>
          </ViewSwitcher>
        </HeaderLeft>
        {!isMobile && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <AddBtn onClick={() => setShowCreateStory(true)} style={{ background: '#7C3AED' }}>
              <FiPlus /> New Story
            </AddBtn>
            <AddBtn onClick={() => setShowCreateTask(true)}>
              <FiPlus /> New Task
            </AddBtn>
          </div>
        )}
      </Header>

      {/* ---- Filters ---- */}
      <Filters onClick={(e) => { if ((e.target as HTMLElement).closest('[data-dropdown]') === null) setOpenDrop(null); }}>
        <FilterIcon><FiFilter size={14} /></FilterIcon>

        {/* My Tasks */}
        <Chip
          $active={filter.assignee_id === me?.id}
          $highlight
          onClick={() => setFilter((f) => ({
            ...f,
            assignee_id: f.assignee_id === me?.id ? undefined : me?.id,
          }))}
        >
          My Tasks
        </Chip>

        {/* Story */}
        <ChipWrap data-dropdown>
          <Chip $active={!!filter.story_id} onClick={() => toggleDrop('story')}>
            {filter.story_id ? stories.find((s) => s.id === filter.story_id)?.title?.slice(0, 20) || 'Story' : 'Story'}
            {filter.story_id ? <FiX onClick={(e) => { e.stopPropagation(); setFilter((f) => ({ ...f, story_id: undefined })); }} /> : <FiChevronDown />}
          </Chip>
          {openDrop === 'story' && (
            <Dropdown>
              {stories.map((s) => (
                <DropItem key={s.id} $active={filter.story_id === s.id}
                  onClick={() => { setFilter((f) => ({ ...f, story_id: s.id })); setOpenDrop(null); }}>
                  {s.title}
                </DropItem>
              ))}
            </Dropdown>
          )}
        </ChipWrap>

        {/* Team */}
        {allTeams && allTeams.length > 0 && (
          <ChipWrap data-dropdown>
            <Chip $active={!!filter.team_id} onClick={() => toggleDrop('team')}>
              {filter.team_id ? allTeams.find((t) => t.id === filter.team_id)?.name || 'Team' : 'Team'}
              {filter.team_id ? <FiX onClick={(e) => { e.stopPropagation(); setFilter((f) => ({ ...f, team_id: undefined })); }} /> : <FiChevronDown />}
            </Chip>
            {openDrop === 'team' && (
              <Dropdown>
                {allTeams.map((t) => (
                  <DropItem key={t.id} $active={filter.team_id === t.id}
                    onClick={() => { setFilter((f) => ({ ...f, team_id: t.id })); setOpenDrop(null); }}>
                    {t.name} {t.office && <span style={{ color: theme.colors.cadetGray, fontSize: '12px' }}>({t.office})</span>}
                  </DropItem>
                ))}
              </Dropdown>
            )}
          </ChipWrap>
        )}

        {/* Assignee */}
        <ChipWrap data-dropdown>
          <Chip $active={!!filter.assignee_id && filter.assignee_id !== me?.id} onClick={() => toggleDrop('assignee')}>
            {filter.assignee_id && filter.assignee_id !== me?.id
              ? allUsers?.find((u) => u.id === filter.assignee_id)?.full_name || 'Assignee'
              : 'Assignee'}
            {filter.assignee_id && filter.assignee_id !== me?.id
              ? <FiX onClick={(e) => { e.stopPropagation(); setFilter((f) => ({ ...f, assignee_id: undefined })); }} />
              : <FiChevronDown />}
          </Chip>
          {openDrop === 'assignee' && (
            <Dropdown>
              {allUsers?.map((u) => (
                <DropItem key={u.id} $active={filter.assignee_id === u.id}
                  onClick={() => { setFilter((f) => ({ ...f, assignee_id: u.id })); setOpenDrop(null); }}>
                  <Avatar name={u.full_name} size={20} /> {u.full_name}
                </DropItem>
              ))}
            </Dropdown>
          )}
        </ChipWrap>

        {/* Priority */}
        <ChipWrap data-dropdown>
          <Chip $active={!!filter.priority} onClick={() => toggleDrop('priority')}>
            {filter.priority
              ? <><span style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_COLORS[filter.priority], display: 'inline-block' }} /> {PRIORITY_LABELS[filter.priority]}</>
              : 'Priority'}
            {filter.priority
              ? <FiX onClick={(e) => { e.stopPropagation(); setFilter((f) => ({ ...f, priority: undefined })); }} />
              : <FiChevronDown />}
          </Chip>
          {openDrop === 'priority' && (
            <Dropdown>
              {(['critical', 'high', 'medium', 'low'] as Priority[]).map((p) => (
                <DropItem key={p} $active={filter.priority === p}
                  onClick={() => { setFilter((f) => ({ ...f, priority: p })); setOpenDrop(null); }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_COLORS[p] }} />
                  {PRIORITY_LABELS[p]}
                </DropItem>
              ))}
            </Dropdown>
          )}
        </ChipWrap>

        {activeFilterCount > 0 && (
          <ActiveFilters>
            <ClearBtn onClick={clearFilters}>Clear all ({activeFilterCount})</ClearBtn>
          </ActiveFilters>
        )}
      </Filters>

      {/* ---- Board ---- */}
      {isLoading || !board ? (
        <CenterMsg>Loading board...</CenterMsg>
      ) : viewMode === 'kanban' ? (
        <KanbanBoard board={board} onStatusChange={handleStatusChange} onPositionChange={handlePositionChange} onQuickAdd={() => setShowCreateTask(true)} />
      ) : (
        <BacklogTable
          stories={stories}
          allTasks={board.columns.flatMap((c) => c.tasks)}
        />
      )}

      {isMobile && <Fab onClick={() => setShowCreateTask(true)}><FiPlus /></Fab>}

      {showCreateTask && (createTaskStoryId || filter.story_id || firstStory?.id) && (
        <CreateTaskModal
          storyId={createTaskStoryId || filter.story_id || firstStory?.id || ''}
          storyTitle={stories.find((s) => s.id === (createTaskStoryId || filter.story_id || firstStory?.id))?.title || 'Story'}
          stories={stories.map((s) => ({ id: s.id, title: s.title }))}
          onStoryChange={setCreateTaskStoryId}
          onClose={() => { setShowCreateTask(false); setCreateTaskStoryId(''); }}
          onSubmit={(input, subtaskTitles) => {
            const sid = createTaskStoryId || filter.story_id || firstStory?.id || '';
            api.post(`/api/v1/stories/${sid}/tasks`, input).then(async (task: any) => {
              for (const st of subtaskTitles) {
                try { await api.post(`/api/v1/tasks/${task.id}/subtasks`, { title: st }); } catch { /* continue */ }
              }
              setShowCreateTask(false);
              setCreateTaskStoryId('');
              // Refresh board
              window.location.reload();
            }).catch(() => {});
          }}
          isLoading={false}
        />
      )}

      {showCreateStory && (
        <CreateStoryModal
          onClose={() => setShowCreateStory(false)}
          onSubmit={(input) => {
            createStory.mutate(input, {
              onSuccess: () => setShowCreateStory(false),
            });
          }}
          isLoading={createStory.isPending}
        />
      )}
    </Container>
  );
}
