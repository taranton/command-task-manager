import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Region } from '../types';

export function useRegions() {
  return useQuery<Region[]>({
    queryKey: ['regions'],
    queryFn: () => api.get('/api/v1/regions'),
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateRegion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; code: string; description?: string }) =>
      api.post<Region>('/api/v1/regions', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['regions'] }),
  });
}

export function useUpdateRegion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...rest
    }: {
      id: string;
      name?: string;
      code?: string;
      description?: string;
      is_active?: boolean;
      offices?: string[];
    }) => api.patch<Region>(`/api/v1/regions/${id}`, rest),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['regions'] }),
  });
}

export interface RegionArchiveSummary {
  id: string;
  original_id: string;
  name: string;
  code: string;
  description: string | null;
  counts: Record<string, number>;
  archived_at: string;
  archived_by: string | null;
}

export interface RegionArchiveDetail extends RegionArchiveSummary {
  payload: {
    region: Record<string, unknown>;
    users: Record<string, unknown>[];
    teams: Record<string, unknown>[];
    stories: Record<string, unknown>[];
    tasks: Record<string, unknown>[];
    releases: Record<string, unknown>[];
    events: Record<string, unknown>[];
    snapshots_counted: number;
  };
}

export function useRegionArchives() {
  return useQuery<RegionArchiveSummary[]>({
    queryKey: ['region-archives'],
    queryFn: () => api.get('/api/v1/region-archives'),
    staleTime: 60_000,
  });
}

export function useRegionArchive(id: string | null) {
  return useQuery<RegionArchiveDetail>({
    queryKey: ['region-archive', id],
    queryFn: () => api.get(`/api/v1/region-archives/${id}`),
    enabled: !!id,
  });
}

export function useDeleteRegion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/regions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['regions'] }),
  });
}
