import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Comment, EntityType } from '../types';

export function useComments(entityType: EntityType, entityId: string | null) {
  return useQuery<Comment[]>({
    queryKey: ['comments', entityType, entityId],
    queryFn: () => api.get(`/api/v1/${entityType}/${entityId}/comments`),
    enabled: !!entityId,
  });
}

export function useAddComment(entityType: EntityType, entityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      api.post<Comment>(`/api/v1/${entityType}/${entityId}/comments`, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', entityType, entityId] });
    },
  });
}

export function useEditComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api.patch<Comment>(`/api/v1/comments/${id}`, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/comments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}
