import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { User, Team } from '../types';

export function useUsers() {
  return useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/api/v1/users'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTeams() {
  return useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => api.get('/api/v1/teams'),
    staleTime: 5 * 60 * 1000,
  });
}
