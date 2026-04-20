import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface BoardOverview {
  id: string;
  name: string;
  description: string | null;
  office: string | null;
  region_id: string | null;
  region_code: string | null;
  region_name: string | null;
  my_role: 'team_lead' | 'member' | 'trainee' | null;
  member_count: number;
  stories_count: number;
  tasks_count: number;
  done_tasks_count: number;
  overdue_count: number;
  progress_pct: number;
  last_activity_at: string | null;
  members_preview: string[];
  is_active: boolean;
}

export function useBoardsOverview() {
  return useQuery<BoardOverview[]>({
    queryKey: ['boards-overview'],
    queryFn: () => api.get('/api/v1/boards/overview'),
    staleTime: 30_000,
  });
}
