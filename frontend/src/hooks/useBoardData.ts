import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type {
  Board,
  BoardFilter,
  Task,
  CreateTaskInput,
  Story,
  CreateStoryInput,
} from '../types';

// Stable serialization for query key
function boardKey(filter: BoardFilter) {
  return ['board', filter.story_id || '', filter.assignee_id || '', filter.team_id || '', filter.priority || ''] as const;
}

let currentBoardKey: readonly string[] = boardKey({});

export function useBoardData(filter: BoardFilter = {}) {
  const params = new URLSearchParams();
  if (filter.story_id) params.set('story', filter.story_id);
  if (filter.assignee_id) params.set('assignee', filter.assignee_id);
  if (filter.team_id) params.set('team', filter.team_id);
  if (filter.priority) params.set('priority', filter.priority);
  // Pass active region if set (C-Level switching)
  const activeRegion = localStorage.getItem('active_region');
  if (activeRegion) params.set('region', activeRegion);

  const qs = params.toString();
  const path = `/api/v1/board${qs ? `?${qs}` : ''}`;

  const key = boardKey(filter);
  currentBoardKey = key;

  return useQuery<Board>({
    queryKey: key,
    queryFn: () => api.get<Board>(path),
  });
}

export function useStories() {
  return useQuery<{ data: Story[]; total: number }>({
    queryKey: ['stories'],
    queryFn: () => api.get('/api/v1/stories'),
  });
}

export function useMyTasks() {
  return useQuery<Task[]>({
    queryKey: ['my-tasks'],
    queryFn: () => api.get('/api/v1/tasks/my'),
  });
}

export function useTask(id: string | null) {
  return useQuery<Task>({
    queryKey: ['task', id],
    queryFn: () => api.get(`/api/v1/tasks/${id}`),
    enabled: !!id,
  });
}

export function useCreateTask(storyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) =>
      api.post<Task>(`/api/v1/stories/${storyId}/tasks`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['board'] });
      qc.invalidateQueries({ queryKey: ['stories'] });
    },
  });
}

export function useCreateStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStoryInput) =>
      api.post<Story>('/api/v1/stories', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stories'] });
    },
  });
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/v1/tasks/${id}/status`, { status }),
    // No optimistic update here — KanbanBoard manages local state during drag,
    // and onPositionChange handles the optimistic cache update with correct ordering.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['board'] });
    },
  });
}

export function useUpdateTaskPosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      sort_order,
      status,
    }: {
      id: string;
      sort_order: number;
      status?: string;
      reorderedColumn?: { status: string; tasks: Task[] };
    }) => api.patch(`/api/v1/tasks/${id}/reorder`, { sort_order, status }),
    onMutate: async (vars) => {
      const key = [...currentBoardKey];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Board>(key);

      // Optimistic: apply the reordered column + remove task from other columns
      if (previous && vars.reorderedColumn) {
        const taskId = vars.id;
        const targetStatus = vars.reorderedColumn.status;
        const newColumns = previous.columns.map((col) => {
          if (col.status === targetStatus) {
            // Target column: use the provided reordered tasks
            return {
              ...col,
              tasks: vars.reorderedColumn!.tasks,
              count: vars.reorderedColumn!.tasks.length,
            };
          }
          // Other columns: remove the task if it exists (cross-column move)
          const filtered = col.tasks.filter((t) => t.id !== taskId);
          return {
            ...col,
            tasks: filtered,
            count: filtered.length,
          };
        });
        qc.setQueryData(key, { columns: newColumns });
      }

      return { previous, key };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous && context?.key) {
        qc.setQueryData(context.key, context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['board'] });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      api.patch<Task>(`/api/v1/tasks/${id}`, input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['board'] });
      qc.invalidateQueries({ queryKey: ['task', vars.id] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/tasks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['board'] });
    },
  });
}
