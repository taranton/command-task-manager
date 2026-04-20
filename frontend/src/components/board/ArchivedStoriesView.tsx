import { useState } from 'react';
import styled from 'styled-components';
import { FiRotateCcw, FiArchive, FiTrash2 } from 'react-icons/fi';
import { theme } from '../../styles/theme';
import { useArchivedStories, useUnarchiveStory } from '../../hooks/useBoardData';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { StoryDetail } from './StoryDetail';

const Wrap = styled.div`
  flex: 1;
  overflow-y: auto;
  background: ${theme.colors.background};
  padding: 24px;
`;

const Inner = styled.div`
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const Title = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: ${theme.typography.fontFamily.primary};
  font-size: 22px;
  font-weight: 700;
  color: ${theme.colors.charcoal};
`;

const Subtitle = styled.div`
  font-size: 13px;
  color: ${theme.colors.cadetGray};
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr 90px 100px 130px 130px 200px;
  gap: 14px;
  align-items: center;
  padding: 12px 14px;
  background: ${theme.colors.white};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  transition: ${theme.transitions.default};
  cursor: pointer;

  &:hover {
    border-color: ${theme.colors.vividOrange}80;
  }

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: 6px;
  }
`;

const Btn = styled.button<{ $danger?: boolean; $primary?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: ${theme.borderRadius.md};
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: ${theme.transitions.default};
  ${(p) =>
    p.$primary
      ? `background: ${theme.colors.vividOrange}; color: white; border: 1px solid ${theme.colors.vividOrange};
         &:hover { background: ${theme.colors.deepOrange}; }`
      : p.$danger
        ? `background: ${theme.colors.errorLight}; color: ${theme.colors.error}; border: 1px solid ${theme.colors.error}30;
           &:hover { background: ${theme.colors.error}; color: white; }`
        : `background: white; border: 1px solid ${theme.colors.border}; color: ${theme.colors.charcoal};
           &:hover { background: ${theme.colors.background}; }`}
`;

const Pill = styled.span<{ $bg: string; $fg: string }>`
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: ${theme.borderRadius.pill};
  font-size: 11px;
  font-weight: 600;
  background: ${(p) => p.$bg};
  color: ${(p) => p.$fg};
  text-transform: capitalize;
`;

const Empty = styled.div`
  padding: 40px;
  text-align: center;
  color: ${theme.colors.cadetGray};
  font-size: 14px;
  background: ${theme.colors.white};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
`;

const statusColor: Record<string, { bg: string; fg: string }> = {
  backlog: { bg: '#F5F5F5', fg: '#9E9E9E' },
  active: { bg: '#FFF3E0', fg: '#FF9800' },
  done: { bg: '#E8F5E9', fg: '#4CAF50' },
  closed: { bg: '#F5F5F5', fg: '#666666' },
};

function defaultRestoreDeadline(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

export function ArchivedStoriesView() {
  const { data, isLoading } = useArchivedStories();
  const unarchive = useUnarchiveStory();
  const qc = useQueryClient();
  const [openStoryId, setOpenStoryId] = useState<string | null>(null);

  const delMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/stories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stories'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });

  const stories = data?.data || [];

  return (
    <Wrap>
      <Inner>
        <div>
          <Title>
            <FiArchive size={20} color={theme.colors.cadetGray} /> Archived stories
          </Title>
          <Subtitle>
            {stories.length} archived · excluded from active views but still visible here. Restore with a new deadline to continue work.
          </Subtitle>
        </div>

        {isLoading && <Empty>Loading…</Empty>}
        {!isLoading && stories.length === 0 && <Empty>No archived stories yet.</Empty>}

        {stories.map((s) => {
          const sc = statusColor[s.status] || statusColor.backlog;
          return (
            <Row key={s.id} onClick={() => setOpenStoryId(s.id)}>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: theme.colors.charcoal,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.title}
                </div>
                <div style={{ fontSize: 11, color: theme.colors.cadetGray, marginTop: 2 }}>
                  {s.task_count} tasks · priority {s.priority}
                  {s.deadline && ` · deadline ${new Date(s.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                </div>
              </div>
              <Pill $bg={sc.bg} $fg={sc.fg}>
                {s.status}
              </Pill>
              <div style={{ fontSize: 11, color: theme.colors.cadetGray }}>
                {s.progress}% progress
              </div>
              <div style={{ fontSize: 11, color: theme.colors.cadetGray }}>
                Archived{' '}
                {s.archived_at
                  ? new Date(s.archived_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : '—'}
              </div>
              <div style={{ fontSize: 11, color: theme.colors.cadetGray }}>
                Created{' '}
                {new Date(s.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                <Btn
                  $primary
                  onClick={() => {
                    const input = window.prompt('Restore with new deadline (YYYY-MM-DD):', defaultRestoreDeadline());
                    if (!input) return;
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
                      alert('Date must be in YYYY-MM-DD format.');
                      return;
                    }
                    unarchive.mutate({ id: s.id, deadline: input });
                  }}
                >
                  <FiRotateCcw size={12} /> Restore
                </Btn>
                <Btn
                  $danger
                  onClick={() => {
                    if (window.confirm(`Permanently delete "${s.title}" and all its tasks?`)) {
                      delMut.mutate(s.id);
                    }
                  }}
                >
                  <FiTrash2 size={12} />
                </Btn>
              </div>
            </Row>
          );
        })}
      </Inner>

      {openStoryId && <StoryDetail storyId={openStoryId} onClose={() => setOpenStoryId(null)} />}
    </Wrap>
  );
}
