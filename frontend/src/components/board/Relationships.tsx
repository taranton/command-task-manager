import styled from 'styled-components';
import { FiArrowRight, FiAlertOctagon, FiCornerUpLeft } from 'react-icons/fi';
import { theme } from '../../styles/theme';
import { useStoryDeps, useBlockers, type MinimalTask, useTasksByStory } from '../../hooks/useEntities';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Story } from '../../types';

// Small row for a single linked item
const RelationRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  background: ${theme.colors.background};
  border: 1px solid ${theme.colors.border};
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: ${theme.transitions.default};

  &:hover {
    border-color: ${theme.colors.vividOrange}60;
    background: ${theme.colors.lightGray};
  }
`;

const Header = styled.div`
  font-size: 10px;
  font-weight: 700;
  color: ${theme.colors.cadetGray};
  text-transform: uppercase;
  letter-spacing: 0.4px;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 12px 0 6px;
`;

const Muted = styled.div`
  font-size: 12px;
  color: ${theme.colors.cadetGray};
  padding: 6px 10px;
  font-style: italic;
`;

const Badge = styled.span<{ $fg: string; $bg: string }>`
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 10px;
  background: ${(p) => p.$bg};
  color: ${(p) => p.$fg};
  text-transform: uppercase;
  letter-spacing: 0.3px;
  flex-shrink: 0;
`;

// Minimal story shape used for linked cards — fetched per-id via the small
// `useStoryLookup` helper below. Keeps this component independent of parent.
interface StoryRef {
  id: string;
  title: string;
}

function useStoryLookup(ids: string[]) {
  return useQuery<Map<string, StoryRef>>({
    queryKey: ['story-lookup', ids.sort().join(',')],
    enabled: ids.length > 0,
    queryFn: async () => {
      const fetched = await Promise.all(
        ids.map(async (id) => {
          try {
            const s = await api.get<Story>(`/api/v1/stories/${id}`);
            return { id, title: s.title };
          } catch {
            return { id, title: '(deleted)' };
          }
        }),
      );
      const m = new Map<string, StoryRef>();
      fetched.forEach((f) => m.set(f.id, f));
      return m;
    },
    staleTime: 60_000,
  });
}

// ============================================================================
// StoryRelationships — shown inside StoryDetail. Lists:
//   • Depends on (out-deps from this story)
//   • Blockers on this story
//   • Blocks (in-deps to this story) — "downstream" work waiting on it
// ============================================================================
export function StoryRelationships({
  storyId,
  onOpenStory,
  onOpenTask,
}: {
  storyId: string;
  onOpenStory?: (id: string) => void;
  onOpenTask?: (id: string) => void;
}) {
  const { data: allDeps } = useStoryDeps('all');
  const { data: allBlockers } = useBlockers('all', false);

  const deps = allDeps || [];
  const blockers = allBlockers || [];

  const outDeps = deps.filter((d) => d.from_story === storyId);
  const inDeps = deps.filter((d) => d.to_story === storyId);
  const storyBlockers = blockers.filter((b) => b.story_id === storyId && !b.resolved_at);

  // Collect story IDs referenced (for name lookup)
  const storyIds = new Set<string>();
  outDeps.forEach((d) => storyIds.add(d.to_story));
  inDeps.forEach((d) => storyIds.add(d.from_story));
  const { data: storyLookup } = useStoryLookup(Array.from(storyIds));

  const hasAny = outDeps.length > 0 || inDeps.length > 0 || storyBlockers.length > 0;
  if (!hasAny) return null;

  return (
    <div>
      {outDeps.length > 0 && (
        <>
          <Header>
            <FiArrowRight size={12} /> Depends on ({outDeps.length})
          </Header>
          {outDeps.map((d) => {
            const target = storyLookup?.get(d.to_story);
            return (
              <RelationRow
                key={d.id}
                onClick={() => {
                  if (d.to_task && onOpenTask) onOpenTask(d.to_task);
                  else if (onOpenStory) onOpenStory(d.to_story);
                }}
                title={d.reason || 'depends on'}
              >
                <Badge $bg={theme.colors.vividOrange + '18'} $fg={theme.colors.vividOrange}>
                  dep
                </Badge>
                <span style={{ color: theme.colors.charcoal, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {target?.title || '(loading…)'}
                </span>
                {d.to_task && (
                  <Badge $bg={theme.colors.info + '18'} $fg={theme.colors.info}>
                    task-linked
                  </Badge>
                )}
                {d.reason && (
                  <span style={{ color: theme.colors.cadetGray, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                    {d.reason}
                  </span>
                )}
              </RelationRow>
            );
          })}
        </>
      )}

      {storyBlockers.length > 0 && (
        <>
          <Header>
            <FiAlertOctagon size={12} color={theme.colors.error} /> Blockers ({storyBlockers.length})
          </Header>
          {storyBlockers.map((b) => {
            const sevCol =
              b.severity === 'critical'
                ? theme.colors.error
                : b.severity === 'high'
                  ? theme.colors.warning
                  : theme.colors.info;
            return (
              <RelationRow
                key={b.id}
                onClick={() => {
                  if (b.blocking_task_id && onOpenTask) onOpenTask(b.blocking_task_id);
                }}
                title={b.blocking_task_id ? 'Click to open the blocking task' : 'External blocker — manual resolve'}
              >
                <Badge $bg={sevCol + '18'} $fg={sevCol}>
                  {b.severity}
                </Badge>
                <Badge
                  $bg={b.blocking_task_id ? theme.colors.info + '18' : theme.colors.lightGray}
                  $fg={b.blocking_task_id ? theme.colors.info : theme.colors.davysGray}
                >
                  {b.blocking_task_id ? 'task-linked' : 'external'}
                </Badge>
                <span style={{ color: theme.colors.davysGray, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {b.blocker_description || (b.blocking_task_id ? 'Waiting for internal task' : '—')}
                </span>
              </RelationRow>
            );
          })}
        </>
      )}

      {inDeps.length > 0 && (
        <>
          <Header>
            <FiCornerUpLeft size={12} /> Blocks ({inDeps.length})
          </Header>
          {inDeps.map((d) => {
            const target = storyLookup?.get(d.from_story);
            return (
              <RelationRow
                key={d.id}
                onClick={() => onOpenStory && onOpenStory(d.from_story)}
                title="Downstream story waiting on this one"
              >
                <Badge $bg={theme.colors.lightGray} $fg={theme.colors.davysGray}>
                  blocks
                </Badge>
                <span style={{ color: theme.colors.charcoal, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {target?.title || '(loading…)'}
                </span>
                {d.reason && (
                  <span style={{ color: theme.colors.cadetGray, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                    {d.reason}
                  </span>
                )}
              </RelationRow>
            );
          })}
        </>
      )}
    </div>
  );
}

// ============================================================================
// TaskRelationships — shown inside TaskDetail. Lists stories that depend on
// this task (via to_task) and stories this task is blocking (via blocking_task_id).
// When the task goes done, both auto-resolve.
// ============================================================================
export function TaskRelationships({
  taskId,
  storyId,
  onOpenStory,
}: {
  taskId: string;
  // storyId of the task's own story — used to fetch sibling tasks for context,
  // currently just passed through to help the caller if needed.
  storyId?: string;
  onOpenStory?: (id: string) => void;
}) {
  const { data: allDeps } = useStoryDeps('all');
  const { data: allBlockers } = useBlockers('all', false);
  // suppress unused-var lint when storyId not needed internally
  void storyId;

  const deps = allDeps || [];
  const blockers = allBlockers || [];

  const depsOn = deps.filter((d) => d.to_task === taskId);
  const blockingOn = blockers.filter((b) => b.blocking_task_id === taskId && !b.resolved_at);

  const storyIds = new Set<string>();
  depsOn.forEach((d) => storyIds.add(d.from_story));
  blockingOn.forEach((b) => storyIds.add(b.story_id));
  const { data: storyLookup } = useStoryLookup(Array.from(storyIds));

  const totalLinks = depsOn.length + blockingOn.length;
  if (totalLinks === 0) return null;

  return (
    <div>
      <Header>
        <FiCornerUpLeft size={12} /> This task unblocks ({totalLinks})
      </Header>
      <Muted style={{ padding: '0 0 8px', fontSize: 11 }}>
        When this task is marked <b>done</b>, these relationships auto-resolve.
      </Muted>

      {depsOn.map((d) => {
        const target = storyLookup?.get(d.from_story);
        return (
          <RelationRow
            key={`dep-${d.id}`}
            onClick={() => onOpenStory && onOpenStory(d.from_story)}
            title={d.reason || 'Story depending on this task'}
          >
            <Badge $bg={theme.colors.vividOrange + '18'} $fg={theme.colors.vividOrange}>
              dep
            </Badge>
            <span style={{ color: theme.colors.charcoal, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {target?.title || '(loading…)'}
            </span>
            {d.reason && (
              <span style={{ color: theme.colors.cadetGray, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                {d.reason}
              </span>
            )}
          </RelationRow>
        );
      })}
      {blockingOn.map((b) => {
        const target = storyLookup?.get(b.story_id);
        const sevCol =
          b.severity === 'critical'
            ? theme.colors.error
            : b.severity === 'high'
              ? theme.colors.warning
              : theme.colors.info;
        return (
          <RelationRow
            key={`blk-${b.id}`}
            onClick={() => onOpenStory && onOpenStory(b.story_id)}
            title="Story blocked by this task"
          >
            <Badge $bg={sevCol + '18'} $fg={sevCol}>
              blocker · {b.severity}
            </Badge>
            <span style={{ color: theme.colors.charcoal, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {target?.title || '(loading…)'}
            </span>
            {b.blocker_description && (
              <span style={{ color: theme.colors.cadetGray, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                {b.blocker_description}
              </span>
            )}
          </RelationRow>
        );
      })}
    </div>
  );
}

// Re-export tasks-by-story hook for callers that want to display siblings
export { useTasksByStory };
export type { MinimalTask };
