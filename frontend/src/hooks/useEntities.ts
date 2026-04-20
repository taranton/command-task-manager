import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface MinimalTask {
  id: string;
  title: string;
  status: string;
}

export function useTasksByStory(storyID: string | null) {
  return useQuery<MinimalTask[]>({
    queryKey: ['story-tasks', storyID],
    queryFn: () => api.get(`/api/v1/stories/${storyID}/tasks`),
    enabled: !!storyID,
    staleTime: 30_000,
  });
}

// ---------- Releases ----------

export interface Release {
  id: string;
  release_date: string;
  label: string;
  release_type: 'major' | 'minor' | 'patch';
  region_id: string | null;
  office: string | null;
  description: string | null;
  story_ids: string[];
}

export function useReleases(region: string) {
  return useQuery<Release[]>({
    queryKey: ['releases', region],
    queryFn: () => api.get(`/api/v1/releases?region=${region}`),
    staleTime: 60_000,
  });
}

export function useCreateRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      release_date: string;
      label: string;
      release_type: 'major' | 'minor' | 'patch';
      region_id?: string | null;
      office?: string | null;
      description?: string | null;
      story_ids?: string[];
    }) => api.post<Release>('/api/v1/releases', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['releases'] }),
  });
}

export function useDeleteRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/releases/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['releases'] }),
  });
}

// ---------- Story dependencies ----------

export interface StoryDep {
  id: string;
  from_story: string;
  to_story: string;
  to_task: string | null;
  reason: string | null;
}

export function useStoryDeps(region: string) {
  return useQuery<StoryDep[]>({
    queryKey: ['story-deps', region],
    queryFn: () => api.get(`/api/v1/story-deps?region=${region}`),
    staleTime: 60_000,
  });
}

export function useCreateDep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { from_story: string; to_story: string; to_task?: string | null; reason?: string | null }) =>
      api.post<StoryDep>('/api/v1/story-deps', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['story-deps'] }),
  });
}

export function useDeleteDep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/story-deps/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['story-deps'] }),
  });
}

// ---------- External blockers ----------

export interface Blocker {
  id: string;
  story_id: string;
  blocking_task_id: string | null;
  blocker_description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  since_date: string;
  resolved_at: string | null;
}

export function useBlockers(region: string, onlyUnresolved = true) {
  return useQuery<Blocker[]>({
    queryKey: ['blockers', region, onlyUnresolved],
    queryFn: () =>
      api.get(`/api/v1/blockers?region=${region}&unresolved=${onlyUnresolved ? 'true' : 'false'}`),
    staleTime: 60_000,
  });
}

export function useCreateBlocker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      story_id: string;
      blocking_task_id?: string | null;
      blocker_description: string;
      severity?: string;
      since_date?: string;
    }) => api.post<Blocker>('/api/v1/blockers', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blockers'] }),
  });
}

export function useResolveBlocker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/blockers/${id}/resolve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blockers'] }),
  });
}

export function useDeleteBlocker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/blockers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blockers'] }),
  });
}

// ---------- Timeline events ----------

export interface TimelineEvent {
  id: string;
  event_date: string;
  kind: 'release' | 'incident' | 'hire' | 'launch' | 'milestone';
  label: string;
  affected_kpis: string[];
  region_id: string | null;
  description: string | null;
}

export function useEvents(region: string) {
  return useQuery<TimelineEvent[]>({
    queryKey: ['events', region],
    queryFn: () => api.get(`/api/v1/events?region=${region}`),
    staleTime: 60_000,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      event_date: string;
      kind: 'release' | 'incident' | 'hire' | 'launch' | 'milestone';
      label: string;
      affected_kpis?: string[];
      region_id?: string | null;
      description?: string | null;
    }) => api.post<TimelineEvent>('/api/v1/events', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/events/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}
