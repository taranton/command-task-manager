import { useState } from 'react';
import styled from 'styled-components';
import { FiChevronsRight, FiX, FiTrash2, FiCheckSquare } from 'react-icons/fi';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { theme } from '../../styles/theme';
import { api } from '../../lib/api';
import { Avatar } from '../ui/Avatar';
import { useUsers } from '../../hooks/useUsers';
import { useIsMobile } from '../../hooks/useMediaQuery';
import type { Story, Task } from '../../types';
import { STORY_STATUS_LABELS, PRIORITY_LABELS } from '../../types';

// Reuse layout from TaskDetail
const InlinePanel = styled.div`
  width: ${theme.layout.detailPanelWidth}; min-width: ${theme.layout.detailPanelWidth};
  height: 100%; background: ${theme.colors.white}; border-left: 1px solid ${theme.colors.border};
  display: flex; flex-direction: row; overflow: visible; position: relative;
`;
const CollapseBtn = styled.button`
  position: absolute; left: -14px; top: 16px; width: 28px; height: 28px;
  border-radius: ${theme.borderRadius.round}; background: ${theme.colors.white};
  border: 1px solid ${theme.colors.border}; color: ${theme.colors.cadetGray};
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 1px 4px rgba(0,0,0,0.1); z-index: 10;
  &:hover { background: ${theme.colors.lightGray}; color: ${theme.colors.charcoal}; }
  svg { width: 14px; height: 14px; }
`;
const PanelContent = styled.div`flex: 1; display: flex; flex-direction: column; overflow: hidden;`;
const PanelHeader = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  padding: ${theme.spacing.md} ${theme.spacing.lg}; border-bottom: 1px solid ${theme.colors.border};
`;
const PanelBody = styled.div`flex: 1; overflow-y: auto; padding: ${theme.spacing.lg};`;
const Overlay = styled.div`
  position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 2000;
  display: flex; justify-content: flex-end;
`;
const OverlayPanel = styled.div`
  width: 100%; height: 100%; background: white; display: flex; flex-direction: column; overflow: hidden;
`;
const CloseButton = styled.button`
  background: none; color: ${theme.colors.mediumGray}; padding: 4px; border-radius: 4px; display: flex;
  &:hover { background: ${theme.colors.lightGray}; } svg { width: 20px; height: 20px; }
`;

const Title = styled.h2`
  font-family: ${theme.typography.fontFamily.primary}; font-size: ${theme.typography.fontSize.xl};
  font-weight: ${theme.typography.fontWeight.bold}; margin-bottom: ${theme.spacing.md}; line-height: 1.3;
`;
const MetaGrid = styled.div`display: grid; grid-template-columns: 1fr 1fr; gap: ${theme.spacing.md}; margin-bottom: ${theme.spacing.lg};`;
const MetaItem = styled.div`display: flex; flex-direction: column; gap: 4px;`;
const MetaLabel = styled.span`
  font-size: ${theme.typography.fontSize.xs}; color: ${theme.colors.cadetGray};
  text-transform: uppercase; font-weight: ${theme.typography.fontWeight.medium};
`;
const InlineSelect = styled.select`
  padding: 4px 8px; border: 1px solid ${theme.colors.border}; border-radius: 4px;
  font-size: ${theme.typography.fontSize.sm}; background: white; cursor: pointer;
  &:focus { border-color: ${theme.colors.vividOrange}; outline: none; }
`;
const InlineInput = styled.input`
  width: 100%; padding: 4px 8px; border: 1px solid ${theme.colors.vividOrange};
  border-radius: 4px; font-size: inherit; outline: none;
`;
const EditableField = styled.div`
  cursor: pointer; padding: 2px 4px; margin: -2px -4px; border-radius: 4px;
  &:hover { background: ${theme.colors.background}; }
`;
const Separator = styled.hr`border: none; height: 1px; background: ${theme.colors.border}; margin: ${theme.spacing.lg} 0;`;
const SectionTitle = styled.h3`
  font-family: ${theme.typography.fontFamily.primary}; font-size: ${theme.typography.fontSize.md};
  font-weight: ${theme.typography.fontWeight.semibold}; margin-bottom: ${theme.spacing.sm};
  display: flex; align-items: center; gap: 8px;
`;
const TaskRow = styled.div`
  display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 6px; cursor: pointer;
  &:hover { background: ${theme.colors.background}; }
`;
const TaskStatus = styled.span<{ $color: string }>`
  font-size: 10px; padding: 2px 8px; border-radius: 10px;
  background: ${(p) => p.$color}20; color: ${(p) => p.$color};
`;
const ProgressBar = styled.div`
  width: 100%; height: 6px; background: ${theme.colors.lightGray}; border-radius: 3px; margin-top: 4px;
`;
const ProgressFill = styled.div<{ $pct: number }>`
  height: 100%; width: ${(p) => p.$pct}%; border-radius: 3px;
  background: ${(p) => p.$pct === 100 ? theme.colors.success : theme.colors.vividOrange};
`;
const DeleteBtn = styled.button`
  display: flex; align-items: center; gap: 6px; padding: 8px 16px;
  background: ${theme.colors.errorLight}; color: ${theme.colors.error};
  border-radius: 8px; font-size: 14px; font-weight: 500;
  &:hover { background: ${theme.colors.error}; color: white; }
`;

interface Props {
  storyId: string;
  onClose: () => void;
  onTaskClick?: (taskId: string) => void;
  inline?: boolean;
}

export function StoryDetail({ storyId, onClose, onTaskClick, inline = false }: Props) {
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const { data: users } = useUsers();
  const [editingField, setEditingField] = useState<string | null>(null);

  const { data: story, isLoading } = useQuery<Story>({
    queryKey: ['story', storyId],
    queryFn: () => api.get(`/api/v1/stories/${storyId}`),
    enabled: !!storyId,
  });

  // Tasks for this story (from board data or fetch)
  const { data: tasks } = useQuery<Task[]>({
    queryKey: ['story-tasks', storyId],
    queryFn: () => api.get(`/api/v1/stories/${storyId}/tasks`),
    enabled: !!storyId,
  });

  const updateStory = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.patch(`/api/v1/stories/${storyId}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['story', storyId] });
      qc.invalidateQueries({ queryKey: ['stories'] });
      qc.invalidateQueries({ queryKey: ['board'] });
    },
  });

  const deleteStory = useMutation({
    mutationFn: () => api.delete(`/api/v1/stories/${storyId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stories'] });
      qc.invalidateQueries({ queryKey: ['board'] });
      onClose();
    },
  });

  const saveField = (field: string, value: unknown) => {
    updateStory.mutate({ [field]: value });
    setEditingField(null);
  };

  const statusColors: Record<string, string> = {
    backlog: '#9E9E9E', active: '#FF9800', done: '#4CAF50', closed: '#666666',
  };

  const content = (showClose: boolean) => (
    <>
      <PanelHeader>
        <span style={{ fontSize: 14, color: theme.colors.cadetGray }}>Story Details</span>
        {showClose && <CloseButton onClick={onClose}><FiX /></CloseButton>}
      </PanelHeader>
      <PanelBody>
        {isLoading ? <div style={{ color: theme.colors.cadetGray, padding: 24 }}>Loading...</div> :
         !story ? <div style={{ color: theme.colors.cadetGray, padding: 24 }}>Story not found</div> : (
          <>
            {editingField === 'title' ? (
              <InlineInput autoFocus defaultValue={story.title}
                onBlur={(e) => saveField('title', e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveField('title', (e.target as HTMLInputElement).value); if (e.key === 'Escape') setEditingField(null); }}
              />
            ) : (
              <EditableField onClick={() => setEditingField('title')}><Title>{story.title}</Title></EditableField>
            )}

            <MetaGrid>
              <MetaItem>
                <MetaLabel>Status</MetaLabel>
                <InlineSelect value={story.status} onChange={(e) => saveField('status', e.target.value)}>
                  {Object.entries(STORY_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </InlineSelect>
              </MetaItem>
              <MetaItem>
                <MetaLabel>Priority</MetaLabel>
                <InlineSelect value={story.priority} onChange={(e) => saveField('priority', e.target.value)}>
                  {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </InlineSelect>
              </MetaItem>
              <MetaItem>
                <MetaLabel>Assigned Lead</MetaLabel>
                <InlineSelect value={story.assigned_lead || ''} onChange={(e) => saveField('assigned_lead', e.target.value || null)}>
                  <option value="">Unassigned</option>
                  {users?.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </InlineSelect>
              </MetaItem>
              <MetaItem>
                <MetaLabel>Deadline</MetaLabel>
                <input type="date" value={story.deadline ? story.deadline.split('T')[0] : ''}
                  onChange={(e) => saveField('deadline', e.target.value || null)}
                  style={{ padding: '4px 8px', border: `1px solid ${theme.colors.border}`, borderRadius: 4, fontSize: 14 }}
                />
              </MetaItem>
              <MetaItem>
                <MetaLabel>Start Date</MetaLabel>
                <input type="date" value={story.start_date ? story.start_date.split('T')[0] : ''}
                  onChange={(e) => saveField('start_date', e.target.value || null)}
                  style={{ padding: '4px 8px', border: `1px solid ${theme.colors.border}`, borderRadius: 4, fontSize: 14 }}
                />
              </MetaItem>
              <MetaItem>
                <MetaLabel>Progress</MetaLabel>
                <div>
                  <ProgressBar><ProgressFill $pct={story.progress} /></ProgressBar>
                  <span style={{ fontSize: 12, color: theme.colors.cadetGray }}>{story.progress}%</span>
                </div>
              </MetaItem>
            </MetaGrid>

            <Separator />

            <SectionTitle><FiCheckSquare size={16} /> Tasks ({tasks?.length || 0})</SectionTitle>
            {tasks && tasks.length > 0 ? tasks.map((t) => (
              <TaskRow key={t.id} onClick={() => onTaskClick?.(t.id)}>
                <TaskStatus $color={statusColors[t.status] || '#999'}>{t.status.replace('_', ' ')}</TaskStatus>
                <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                {t.assignee && <Avatar name={t.assignee.full_name} size={20} />}
              </TaskRow>
            )) : (
              <div style={{ color: theme.colors.cadetGray, fontSize: 13, padding: 8 }}>No tasks yet</div>
            )}

            <Separator />
            <DeleteBtn onClick={() => { if (window.confirm('Delete this story and all its tasks?')) deleteStory.mutate(); }}>
              <FiTrash2 size={14} /> Delete Story
            </DeleteBtn>
          </>
        )}
      </PanelBody>
    </>
  );

  if (inline && !isMobile) {
    return (
      <InlinePanel>
        <CollapseBtn onClick={onClose}><FiChevronsRight /></CollapseBtn>
        <PanelContent>{content(false)}</PanelContent>
      </InlinePanel>
    );
  }

  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <OverlayPanel>{content(true)}</OverlayPanel>
    </Overlay>
  );
}
