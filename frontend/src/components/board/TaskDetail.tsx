import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { FiX, FiCalendar, FiUser, FiPlus } from 'react-icons/fi';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { theme } from '../../styles/theme';
import { api } from '../../lib/api';
import { useTask } from '../../hooks/useBoardData';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { StatusBadge, PriorityBadge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import type { Subtask, Status } from '../../types';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 2000;
  display: flex;
  justify-content: flex-end;
`;

const InlinePanel = styled.div`
  width: ${theme.layout.detailPanelWidth};
  min-width: ${theme.layout.detailPanelWidth};
  height: 100%;
  background: ${theme.colors.white};
  border-left: 1px solid ${theme.colors.border};
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const OverlayPanel = styled.div`
  width: 100%;
  height: 100%;
  background: ${theme.colors.white};
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.spacing.md} ${theme.spacing.lg};
  border-bottom: 1px solid ${theme.colors.border};
  flex-shrink: 0;
`;

const CloseButton = styled.button`
  background: none;
  color: ${theme.colors.mediumGray};
  padding: ${theme.spacing.xs};
  border-radius: ${theme.borderRadius.sm};
  display: flex;
  align-items: center;
  transition: ${theme.transitions.default};

  &:hover {
    background: ${theme.colors.lightGray};
    color: ${theme.colors.charcoal};
  }

  svg {
    width: 20px;
    height: 20px;
  }
`;

const PanelBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${theme.spacing.lg};
`;

const Title = styled.h2`
  font-family: ${theme.typography.fontFamily.primary};
  font-size: ${theme.typography.fontSize.xl};
  font-weight: ${theme.typography.fontWeight.bold};
  color: ${theme.colors.charcoal};
  margin-bottom: ${theme.spacing.md};
  line-height: 1.3;
`;

const MetaGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${theme.spacing.md};
  margin-bottom: ${theme.spacing.lg};
`;

const MetaItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const MetaLabel = styled.span`
  font-size: ${theme.typography.fontSize.xs};
  color: ${theme.colors.cadetGray};
  text-transform: uppercase;
  font-weight: ${theme.typography.fontWeight.medium};
`;

const MetaValue = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  font-size: ${theme.typography.fontSize.sm};
  color: ${theme.colors.charcoal};
`;

const Separator = styled.hr`
  border: none;
  height: 1px;
  background: ${theme.colors.border};
  margin: ${theme.spacing.lg} 0;
`;

const SectionTitle = styled.h3`
  font-family: ${theme.typography.fontFamily.primary};
  font-size: ${theme.typography.fontSize.md};
  font-weight: ${theme.typography.fontWeight.semibold};
  color: ${theme.colors.charcoal};
  margin-bottom: ${theme.spacing.sm};
`;

const Description = styled.div`
  font-size: ${theme.typography.fontSize.sm};
  color: ${theme.colors.davysGray};
  line-height: 1.7;
  white-space: pre-wrap;
`;

const DescriptionPlaceholder = styled.div`
  font-size: ${theme.typography.fontSize.sm};
  color: ${theme.colors.cadetGray};
  font-style: italic;
`;

const SubtaskList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xs};
`;

const SubtaskItem = styled.label`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.sm};
  border-radius: ${theme.borderRadius.sm};
  cursor: pointer;
  transition: ${theme.transitions.default};

  &:hover {
    background: ${theme.colors.background};
  }
`;

const Checkbox = styled.div<{ $checked: boolean }>`
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 2px solid ${(p) => (p.$checked ? theme.colors.success : theme.colors.silver)};
  background: ${(p) => (p.$checked ? theme.colors.success : 'transparent')};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: ${theme.transitions.default};

  &::after {
    content: '${(p: { $checked: boolean }) => (p.$checked ? '✓' : '')}';
    color: white;
    font-size: 12px;
    font-weight: bold;
  }
`;

const SubtaskTitle = styled.span<{ $done: boolean }>`
  font-size: ${theme.typography.fontSize.sm};
  color: ${(p) => (p.$done ? theme.colors.cadetGray : theme.colors.charcoal)};
  text-decoration: ${(p) => (p.$done ? 'line-through' : 'none')};
`;

const ProgressContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  margin-bottom: ${theme.spacing.sm};
`;

const ProgressBarFull = styled.div`
  flex: 1;
  height: 6px;
  background: ${theme.colors.lightGray};
  border-radius: 3px;
  overflow: hidden;
`;

const ProgressFill = styled.div<{ $percent: number }>`
  height: 100%;
  width: ${(p) => p.$percent}%;
  background: ${(p) => (p.$percent === 100 ? theme.colors.success : theme.colors.vividOrange)};
  border-radius: 3px;
  transition: width 0.3s ease;
`;

const ProgressText = styled.span`
  font-size: ${theme.typography.fontSize.xs};
  color: ${theme.colors.cadetGray};
  white-space: nowrap;
`;

const Loading = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${theme.spacing['2xl']};
  color: ${theme.colors.cadetGray};
`;

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface TaskDetailProps {
  taskId: string;
  onClose: () => void;
  inline?: boolean;
}

export function TaskDetail({ taskId, onClose, inline = false }: TaskDetailProps) {
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const { data: task, isLoading } = useTask(taskId);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showAddSubtask, setShowAddSubtask] = useState(false);

  // Toggle subtask status
  const toggleSubtask = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) =>
      api.patch(`/api/v1/subtasks/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      qc.invalidateQueries({ queryKey: ['board'] });
    },
  });

  // Create subtask
  const createSubtask = useMutation({
    mutationFn: (title: string) =>
      api.post(`/api/v1/tasks/${taskId}/subtasks`, { title }),
    onSuccess: () => {
      setNewSubtaskTitle('');
      setShowAddSubtask(false);
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      qc.invalidateQueries({ queryKey: ['board'] });
    },
  });

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const subtasks: Subtask[] = task?.subtasks || [];
  const doneCount = subtasks.filter((s) => s.status === 'done').length;
  const percent = subtasks.length > 0 ? Math.round((doneCount / subtasks.length) * 100) : 0;

  const handleToggleSubtask = (sub: Subtask) => {
    const newStatus: Status = sub.status === 'done' ? 'todo' : 'done';
    toggleSubtask.mutate({ id: sub.id, status: newStatus });
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    createSubtask.mutate(newSubtaskTitle.trim());
  };

  const panelContent = (
    <>
      <PanelHeader>
        <span style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.cadetGray }}>
          Task Details
        </span>
        <CloseButton onClick={onClose}>
          <FiX />
        </CloseButton>
      </PanelHeader>

      <PanelBody>
        {isLoading ? (
            <Loading>Loading...</Loading>
          ) : task ? (
            <>
              <Title>{task.title}</Title>

              <MetaGrid>
                <MetaItem>
                  <MetaLabel>Status</MetaLabel>
                  <MetaValue>
                    <StatusBadge status={task.status} />
                  </MetaValue>
                </MetaItem>
                <MetaItem>
                  <MetaLabel>Priority</MetaLabel>
                  <MetaValue>
                    <PriorityBadge priority={task.priority} />
                  </MetaValue>
                </MetaItem>
                <MetaItem>
                  <MetaLabel>Assignee</MetaLabel>
                  <MetaValue>
                    {task.assignee ? (
                      <>
                        <Avatar name={task.assignee.full_name} size={22} />
                        {task.assignee.full_name}
                      </>
                    ) : (
                      <>
                        <FiUser size={14} color={theme.colors.cadetGray} />
                        <span style={{ color: theme.colors.cadetGray }}>Unassigned</span>
                      </>
                    )}
                  </MetaValue>
                </MetaItem>
                <MetaItem>
                  <MetaLabel>Deadline</MetaLabel>
                  <MetaValue>
                    {task.deadline ? (
                      <>
                        <FiCalendar size={14} />
                        {formatDate(task.deadline)}
                      </>
                    ) : (
                      <span style={{ color: theme.colors.cadetGray }}>No deadline</span>
                    )}
                  </MetaValue>
                </MetaItem>
              </MetaGrid>

              {task.story_title && (
                <div style={{ marginBottom: theme.spacing.md }}>
                  <MetaLabel>Story</MetaLabel>
                  <div style={{ fontSize: theme.typography.fontSize.sm, marginTop: '4px' }}>
                    {task.story_title}
                  </div>
                </div>
              )}

              <Separator />

              <SectionTitle>Description</SectionTitle>
              {task.description ? (
                <Description>{task.description}</Description>
              ) : (
                <DescriptionPlaceholder>No description provided</DescriptionPlaceholder>
              )}

              <Separator />

              <SectionTitle>
                Subtasks {subtasks.length > 0 && `(${doneCount}/${subtasks.length})`}
              </SectionTitle>
              {subtasks.length > 0 && (
                <ProgressContainer>
                  <ProgressBarFull>
                    <ProgressFill $percent={percent} />
                  </ProgressBarFull>
                  <ProgressText>{percent}%</ProgressText>
                </ProgressContainer>
              )}
              <SubtaskList>
                {subtasks.length > 0 ? (
                  subtasks.map((sub) => (
                    <SubtaskItem key={sub.id} onClick={() => handleToggleSubtask(sub)}>
                      <Checkbox $checked={sub.status === 'done'} />
                      <SubtaskTitle $done={sub.status === 'done'}>
                        {sub.title}
                      </SubtaskTitle>
                    </SubtaskItem>
                  ))
                ) : (
                  <DescriptionPlaceholder>No subtasks yet</DescriptionPlaceholder>
                )}
              </SubtaskList>

              {showAddSubtask ? (
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <input
                    autoFocus
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddSubtask();
                      if (e.key === 'Escape') { setShowAddSubtask(false); setNewSubtaskTitle(''); }
                    }}
                    placeholder="Subtask title..."
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.borderRadius.md,
                      fontSize: theme.typography.fontSize.sm,
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleAddSubtask}
                    disabled={!newSubtaskTitle.trim()}
                    style={{
                      padding: '8px 16px',
                      background: theme.colors.vividOrange,
                      color: 'white',
                      border: 'none',
                      borderRadius: theme.borderRadius.md,
                      fontSize: theme.typography.fontSize.sm,
                      fontWeight: 600,
                      cursor: 'pointer',
                      opacity: newSubtaskTitle.trim() ? 1 : 0.5,
                    }}
                  >
                    Add
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddSubtask(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '8px',
                    padding: '8px 12px',
                    background: 'none',
                    border: `1px dashed ${theme.colors.border}`,
                    borderRadius: theme.borderRadius.md,
                    color: theme.colors.cadetGray,
                    fontSize: theme.typography.fontSize.sm,
                    cursor: 'pointer',
                    width: '100%',
                    transition: theme.transitions.default,
                  }}
                >
                  <FiPlus size={14} /> Add subtask
                </button>
              )}
            </>
          ) : (
            <Loading>Task not found</Loading>
          )}
      </PanelBody>
    </>
  );

  // Inline mode: side panel without overlay, sits beside the board
  if (inline && !isMobile) {
    return <InlinePanel>{panelContent}</InlinePanel>;
  }

  // Mobile / non-inline: full-screen overlay
  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <OverlayPanel>{panelContent}</OverlayPanel>
    </Overlay>
  );
}
