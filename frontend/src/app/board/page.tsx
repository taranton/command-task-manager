import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePersistedState } from '../../hooks/usePersistedState';
import styled from 'styled-components';
import { FiPlus, FiFilter, FiX, FiChevronDown, FiArrowLeft, FiSettings } from 'react-icons/fi';
import { theme } from '../../styles/theme';
import { api } from '../../lib/api';
import { BoardSettings } from '../../components/board/BoardSettings';
import { useBoardsOverview } from '../../hooks/useBoardsOverview';
import { KanbanBoard } from '../../components/board/KanbanBoard';
import { BacklogTable } from '../../components/board/BacklogTable';
import { TimelineView } from '../../components/board/TimelineView';
import { ArchivedStoriesView } from '../../components/board/ArchivedStoriesView';
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
import { useRegions } from '../../hooks/useRegions';
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

const HeaderLeft = styled.div`display: flex; flex-direction: column; gap: 8px; align-items: flex-start; min-width: 0; flex: 1;`;

const TitleRow = styled.div`display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-width: 0;`;

const BackBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  background: ${theme.colors.background};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.pill};
  font-size: 12px;
  font-weight: 600;
  color: ${theme.colors.davysGray};
  cursor: pointer;
  transition: ${theme.transitions.default};
  flex-shrink: 0;

  &:hover {
    background: ${theme.colors.lightGray};
    color: ${theme.colors.charcoal};
  }

  svg { width: 12px; height: 12px; }
`;

const PageTitle = styled.h1`
  font-family: ${theme.typography.fontFamily.primary};
  font-size: ${theme.typography.fontSize['2xl']};
  font-weight: ${theme.typography.fontWeight.bold};
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  @media (max-width: ${theme.breakpoints.sm}) { font-size: ${theme.typography.fontSize.lg}; }
`;

const BoardMetaLine = styled.div`
  font-size: 11px;
  color: ${theme.colors.cadetGray};
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
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

const SettingsBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: ${theme.colors.background};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  color: ${theme.colors.davysGray};
  cursor: pointer;
  transition: ${theme.transitions.default};

  &:hover {
    background: ${theme.colors.lightGray};
    color: ${theme.colors.charcoal};
  }

  svg { width: 16px; height: 16px; }
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
  const [viewMode, setViewMode] = usePersistedState<'kanban' | 'backlog' | 'timeline' | 'archive'>(
    'board:viewMode',
    'kanban',
  );
  const { teamId: teamIdParam, regionId: regionIdParam } = useParams<{
    teamId?: string;
    regionId?: string;
  }>();
  const navigate = useNavigate();
  // URL modes:
  //   /board/:teamId          → filter locked to that board
  //   /board/region/:regionId → filter locked to that region (aggregated view across boards)
  //   /my-tasks               → free browsing
  const [filter, setFilter] = useState<BoardFilter>(() =>
    teamIdParam
      ? { team_id: teamIdParam }
      : regionIdParam
        ? { region_id: regionIdParam }
        : {},
  );
  // Keep filter in sync when URL params change (e.g., user switches boards inline)
  useEffect(() => {
    if (teamIdParam && filter.team_id !== teamIdParam) {
      setFilter({ team_id: teamIdParam });
    } else if (regionIdParam && filter.region_id !== regionIdParam) {
      setFilter({ region_id: regionIdParam });
    } else if (!teamIdParam && !regionIdParam && (filter.team_id || filter.region_id)) {
      setFilter({});
    }
  }, [teamIdParam, regionIdParam, filter.team_id, filter.region_id]);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [createTaskStoryId, setCreateTaskStoryId] = useState<string>('');
  const [openDrop, setOpenDrop] = useState<string | null>(null);
  const filtersRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) {
        setOpenDrop(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { data: board, isLoading, error } = useBoardData(filter);
  const { data: storiesData } = useStories();
  const { data: allUsers } = useUsers();
  const { data: allTeams } = useTeams();
  const { data: allRegions } = useRegions();
  const { data: overview } = useBoardsOverview();
  const currentBoard = teamIdParam ? allTeams?.find((t) => t.id === teamIdParam) : undefined;
  const currentRegion = regionIdParam ? allRegions?.find((r) => r.id === regionIdParam) : undefined;
  const overviewEntry = teamIdParam ? overview?.find((o) => o.id === teamIdParam) : undefined;
  const myBoardRole = overviewEntry?.my_role || null;
  const isCLevel = me?.role === 'clevel';
  const canOpenSettings = !!teamIdParam && (isCLevel || myBoardRole !== null);
  // Scope stories for Backlog/Timeline. /api/v1/stories is unscoped, so filter client-side.
  const boardsInRegion = regionIdParam
    ? new Set((allTeams || []).filter((t) => t.region_id === regionIdParam).map((t) => t.id))
    : null;
  const scopedStories = teamIdParam
    ? (storiesData?.data || []).filter((s) => s.team_id === teamIdParam)
    : regionIdParam && boardsInRegion
      ? (storiesData?.data || []).filter((s) => !!s.team_id && boardsInRegion.has(s.team_id))
      : null;
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
    return <Container><Header><HeaderLeft><TitleRow><PageTitle>Board</PageTitle></TitleRow></HeaderLeft></Header><CenterMsg $error>Failed to load board</CenterMsg></Container>;
  }

  return (
    <Container>
      {/* ---- Header ---- */}
      <Header>
        <HeaderLeft>
          <TitleRow>
            {teamIdParam ? (
              <>
                <BackBtn onClick={() => navigate('/board')} title="Back to boards">
                  <FiArrowLeft /> Boards
                </BackBtn>
                {(() => {
                  const current = allTeams?.find((t) => t.id === teamIdParam);
                  const region = allRegions?.find((r) => r.id === current?.region_id);
                  if (!current) return <PageTitle>Loading…</PageTitle>;
                  return (
                    <div style={{ minWidth: 0 }}>
                      <PageTitle>{current.name}</PageTitle>
                      {(region || current.office) && (
                        <BoardMetaLine>
                          {region ? (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/board/region/${region.id}`);
                              }}
                              title="Open region board"
                              style={{
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                textDecorationStyle: 'dotted',
                                textUnderlineOffset: 2,
                              }}
                            >
                              {region.code}
                            </span>
                          ) : (
                            '—'
                          )}
                          {current.office ? ` · ${current.office}` : ''}
                        </BoardMetaLine>
                      )}
                    </div>
                  );
                })()}
              </>
            ) : regionIdParam ? (
              <>
                <BackBtn onClick={() => navigate('/board')} title="Back to boards">
                  <FiArrowLeft /> Boards
                </BackBtn>
                <div style={{ minWidth: 0 }}>
                  <PageTitle>
                    {currentRegion
                      ? `${currentRegion.code} — ${currentRegion.name}`
                      : 'Region'}
                  </PageTitle>
                  <BoardMetaLine>
                    All boards in region · {boardsInRegion?.size || 0} boards
                  </BoardMetaLine>
                </div>
              </>
            ) : (
              <PageTitle>My Tasks</PageTitle>
            )}
          </TitleRow>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ViewSwitcher>
              <ViewBtn $active={viewMode === 'kanban'} onClick={() => setViewMode('kanban')}>Kanban</ViewBtn>
              <ViewBtn $active={viewMode === 'backlog'} onClick={() => setViewMode('backlog')}>Backlog</ViewBtn>
              <ViewBtn $active={viewMode === 'timeline'} onClick={() => setViewMode('timeline')}>Timeline</ViewBtn>
              <ViewBtn $active={viewMode === 'archive'} onClick={() => setViewMode('archive')}>Archive</ViewBtn>
            </ViewSwitcher>
            {canOpenSettings && (
              <SettingsBtn
                onClick={() => setShowSettings(true)}
                title={isCLevel || myBoardRole === 'team_lead' ? 'Board settings' : 'View board info'}
              >
                <FiSettings />
              </SettingsBtn>
            )}
          </div>
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
      <Filters ref={filtersRef}>
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

        {/* Board — on /board/:teamId, picks become navigation; on /my-tasks, it's a filter */}
        {allTeams && allTeams.length > 0 && (
          <ChipWrap data-dropdown>
            <Chip $active={!!filter.team_id} onClick={() => toggleDrop('team')}>
              {filter.team_id ? allTeams.find((t) => t.id === filter.team_id)?.name || 'Board' : 'Board'}
              {filter.team_id ? (
                <FiX
                  onClick={(e) => {
                    e.stopPropagation();
                    if (teamIdParam) {
                      // On a specific board page — "clear" means leave this board
                      navigate('/board');
                    } else {
                      setFilter((f) => ({ ...f, team_id: undefined }));
                    }
                  }}
                />
              ) : (
                <FiChevronDown />
              )}
            </Chip>
            {openDrop === 'team' && (
              <Dropdown>
                {(() => {
                  // Scope the dropdown to the most meaningful set:
                  // - region view: boards in that region
                  // - specific board: sibling boards in THIS board's region (context stays sticky
                  //   when you switch to another board from here)
                  // - /my-tasks: all boards
                  let list = allTeams;
                  if (regionIdParam && boardsInRegion) {
                    list = allTeams.filter((t) => boardsInRegion.has(t.id));
                  } else if (teamIdParam && currentBoard?.region_id) {
                    list = allTeams.filter((t) => t.region_id === currentBoard.region_id);
                  }
                  return list;
                })().map((t) => (
                  <DropItem
                    key={t.id}
                    $active={filter.team_id === t.id}
                    onClick={() => {
                      if (teamIdParam || regionIdParam) {
                        // In locked mode, switch to that board by URL
                        navigate(`/board/${t.id}`);
                      } else {
                        setFilter((f) => ({ ...f, team_id: t.id }));
                      }
                      setOpenDrop(null);
                    }}
                  >
                    {t.name}{' '}
                    {t.office && (
                      <span style={{ color: theme.colors.cadetGray, fontSize: '12px' }}>({t.office})</span>
                    )}
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
        <KanbanBoard
          board={board}
          onStatusChange={handleStatusChange}
          onPositionChange={handlePositionChange}
          onQuickAdd={() => setShowCreateTask(true)}
          resolveBoardLabel={
            regionIdParam
              ? (task) => allTeams?.find((t) => t.id === task.team_id)?.name
              : undefined
          }
        />
      ) : viewMode === 'backlog' ? (
        <BacklogTable
          stories={scopedStories ?? stories}
          allTasks={board.columns.flatMap((c) => c.tasks)}
        />
      ) : viewMode === 'archive' ? (
        <ArchivedStoriesView />
      ) : (
        <TimelineView
          stories={scopedStories ?? stories}
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

      {showSettings && currentBoard && (
        <BoardSettings
          board={currentBoard}
          myRole={myBoardRole}
          isCLevel={isCLevel}
          onClose={() => setShowSettings(false)}
        />
      )}
    </Container>
  );
}
