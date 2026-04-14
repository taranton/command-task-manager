import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Region } from '../types';

export function useRegions() {
  return useQuery<Region[]>({
    queryKey: ['regions'],
    queryFn: () => api.get('/api/v1/regions'),
    staleTime: 10 * 60 * 1000, // 10 min
  });
}
