import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { FiX, FiPlus, FiMessageCircle, FiEdit2, FiTrash2, FiSend, FiChevronsRight } from 'react-icons/fi';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { theme } from '../../styles/theme';
import { api } from '../../lib/api';
import { useTask, useUpdateTask, useDeleteTask } from '../../hooks/useBoardData';
import { useComments, useAddComment, useEditComment, useDeleteComment } from '../../hooks/useComments';
import { useUsers } from '../../hooks/useUsers';
import { useAuth } from '../../hooks/useAuth';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { Avatar } from '../ui/Avatar';
import type { Subtask, SubtaskStatus } from '../../types';
import { TASK_STATUS_LABELS, PRIORITY_LABELS } from '../../types';

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
  flex-direction: row;
  overflow: visible;
  position: relative;
`;

const CollapseBtn = styled.button`
  position: absolute;
  left: -14px;
  top: 16px;
  width: 28px;
  height: 28px;
  border-radius: ${theme.borderRadius.round};
  background: ${theme.colors.white};
  border: 1px solid ${theme.colors.border};
  color: ${theme.colors.cadetGray};
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  z-index: 10;
  transition: ${theme.transitions.default};

  &:hover {
    background: ${theme.colors.lightGray};
    color: ${theme.colors.charcoal};
  }

  svg { width: 14px; height: 14px; }
`;

const InlinePanelContent = styled.div`
  flex: 1;
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

// Editable field wrappers
const EditableField = styled.div`
  cursor: pointer;
  padding: 2px 4px;
  margin: -2px -4px;
  border-radius: ${theme.borderRadius.sm};
  transition: ${theme.transitions.default};
  &:hover { background: ${theme.colors.background}; }
`;

const InlineInput = styled.input`
  width: 100%;
  padding: 4px 8px;
  border: 1px solid ${theme.colors.vividOrange};
  border-radius: ${theme.borderRadius.sm};
  font-size: inherit;
  font-family: inherit;
  outline: none;
`;

const InlineTextarea = styled.textarea`
  width: 100%;
  padding: 8px;
  border: 1px solid ${theme.colors.vividOrange};
  border-radius: ${theme.borderRadius.sm};
  font-size: ${theme.typography.fontSize.sm};
  font-family: inherit;
  min-height: 80px;
  resize: vertical;
  outline: none;
  line-height: 1.6;
`;

const InlineSelect = styled.select`
  padding: 4px 8px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.sm};
  font-size: ${theme.typography.fontSize.sm};
  background: white;
  cursor: pointer;
  &:focus { border-color: ${theme.colors.vividOrange}; outline: none; }
`;

const DeleteBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: ${theme.colors.errorLight};
  color: ${theme.colors.error};
  border-radius: ${theme.borderRadius.md};
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  transition: ${theme.transitions.default};
  &:hover { background: ${theme.colors.error}; color: white; }
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

// formatDate removed — using native date input

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
    mutationFn: ({ id, status }: { id: string; status: SubtaskStatus }) =>
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
    const newStatus: SubtaskStatus = sub.status === 'done' ? 'to_do' : 'done';
    toggleSubtask.mutate({ id: sub.id, status: newStatus });
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    createSubtask.mutate(newSubtaskTitle.trim());
  };

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { data: users } = useUsers();
  const [editingField, setEditingField] = useState<string | null>(null);

  const saveField = (field: string, value: unknown) => {
    updateTask.mutate({ id: taskId, [field]: value });
    setEditingField(null);
  };

  const handleDelete = () => {
    if (window.confirm('Delete this task and all its subtasks?')) {
      deleteTask.mutate(taskId, { onSuccess: onClose });
    }
  };

  const panelContent = (showClose: boolean) => (
    <>
      <PanelHeader>
        <span style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.cadetGray }}>
          Task Details
        </span>
        {showClose && (
          <CloseButton onClick={onClose}>
            <FiX />
          </CloseButton>
        )}
      </PanelHeader>

      <PanelBody>
        {isLoading ? (
            <Loading>Loading...</Loading>
          ) : task ? (
            <>
              {/* Title — editable */}
              {editingField === 'title' ? (
                <div style={{ marginBottom: theme.spacing.md }}>
                  <InlineInput
                    autoFocus
                    defaultValue={task.title}
                    onBlur={(e) => saveField('title', e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveField('title', (e.target as HTMLInputElement).value); if (e.key === 'Escape') setEditingField(null); }}
                  />
                </div>
              ) : (
                <EditableField onClick={() => setEditingField('title')}>
                  <Title>{task.title}</Title>
                </EditableField>
              )}

              <MetaGrid>
                {/* Status — dropdown */}
                <MetaItem>
                  <MetaLabel>Status</MetaLabel>
                  <MetaValue>
                    <InlineSelect
                      value={task.status}
                      onChange={(e) => saveField('status', e.target.value)}
                    >
                      {Object.entries(TASK_STATUS_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </InlineSelect>
                  </MetaValue>
                </MetaItem>

                {/* Priority — dropdown */}
                <MetaItem>
                  <MetaLabel>Priority</MetaLabel>
                  <MetaValue>
                    <InlineSelect
                      value={task.priority}
                      onChange={(e) => saveField('priority', e.target.value)}
                    >
                      {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </InlineSelect>
                  </MetaValue>
                </MetaItem>

                {/* Assignee — dropdown */}
                <MetaItem>
                  <MetaLabel>Assignee</MetaLabel>
                  <MetaValue>
                    <InlineSelect
                      value={task.assignee_id || ''}
                      onChange={(e) => saveField('assignee_id', e.target.value || null)}
                    >
                      <option value="">Unassigned</option>
                      {users?.map((u) => (
                        <option key={u.id} value={u.id}>{u.full_name}</option>
                      ))}
                    </InlineSelect>
                  </MetaValue>
                </MetaItem>

                {/* Deadline — date picker */}
                <MetaItem>
                  <MetaLabel>Deadline</MetaLabel>
                  <MetaValue>
                    <input
                      type="date"
                      value={task.deadline ? task.deadline.split('T')[0] : ''}
                      onChange={(e) => saveField('deadline', e.target.value || null)}
                      style={{
                        padding: '4px 8px',
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.borderRadius.sm,
                        fontSize: theme.typography.fontSize.sm,
                        cursor: 'pointer',
                      }}
                    />
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

              {/* Description — editable */}
              <SectionTitle>Description</SectionTitle>
              {editingField === 'description' ? (
                <div>
                  <InlineTextarea
                    autoFocus
                    defaultValue={task.description || ''}
                    onBlur={(e) => saveField('description', e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setEditingField(null); }}
                  />
                  <div style={{ fontSize: '11px', color: theme.colors.cadetGray, marginTop: '4px' }}>
                    Click outside or press Escape to save
                  </div>
                </div>
              ) : (
                <EditableField onClick={() => setEditingField('description')}>
                  {task.description ? (
                    <Description>{task.description}</Description>
                  ) : (
                    <DescriptionPlaceholder>Click to add description...</DescriptionPlaceholder>
                  )}
                </EditableField>
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

              {/* ---- Comments ---- */}
              <Separator />
              <CommentsSection taskId={taskId} />

              {/* Delete action */}
              <Separator />
              <DeleteBtn onClick={handleDelete}>
                <FiTrash2 size={14} /> Delete Task
              </DeleteBtn>
            </>
          ) : (
            <Loading>Task not found</Loading>
          )}
      </PanelBody>
    </>
  );

  // Inline mode: side panel without overlay, sits beside the board
  if (inline && !isMobile) {
    return (
      <InlinePanel>
        <CollapseBtn onClick={onClose} title="Collapse panel">
          <FiChevronsRight />
        </CollapseBtn>
        <InlinePanelContent>{panelContent(false)}</InlinePanelContent>
      </InlinePanel>
    );
  }

  // Mobile / non-inline: full-screen overlay
  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <OverlayPanel>{panelContent(true)}</OverlayPanel>
    </Overlay>
  );
}

// ---- Comments Section ----
const CommentsList = styled.div`display: flex; flex-direction: column; gap: ${theme.spacing.md};`;
const CommentItem = styled.div`display: flex; gap: ${theme.spacing.sm};`;
const CommentBody = styled.div`flex: 1;`;
const CommentHeader = styled.div`
  display: flex; align-items: center; gap: ${theme.spacing.sm}; margin-bottom: 4px;
`;
const CommentAuthor = styled.span`
  font-size: ${theme.typography.fontSize.sm}; font-weight: ${theme.typography.fontWeight.semibold};
`;
const CommentTime = styled.span`
  font-size: ${theme.typography.fontSize.xs}; color: ${theme.colors.cadetGray};
`;
const CommentText = styled.div`
  font-size: ${theme.typography.fontSize.sm}; color: ${theme.colors.davysGray};
  line-height: 1.6; white-space: pre-wrap;
`;
const CommentActions = styled.div`
  display: flex; gap: ${theme.spacing.sm}; margin-top: 4px;
`;
const CommentActionBtn = styled.button`
  background: none; color: ${theme.colors.cadetGray}; font-size: ${theme.typography.fontSize.xs};
  display: flex; align-items: center; gap: 4px; padding: 2px 4px;
  &:hover { color: ${theme.colors.charcoal}; }
`;
const CommentInput = styled.div`
  display: flex; gap: ${theme.spacing.sm}; align-items: flex-start; margin-top: ${theme.spacing.sm};
`;
const CommentTextarea = styled.textarea`
  flex: 1; padding: 8px 12px; border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md}; font-size: ${theme.typography.fontSize.sm};
  font-family: inherit; min-height: 40px; resize: none; line-height: 1.5;
  &:focus { border-color: ${theme.colors.vividOrange}; outline: none; min-height: 60px; }
`;
const SendBtn = styled.button<{ $active: boolean }>`
  padding: 8px; border-radius: ${theme.borderRadius.md};
  background: ${(p) => p.$active ? theme.colors.vividOrange : theme.colors.lightGray};
  color: ${(p) => p.$active ? 'white' : theme.colors.cadetGray};
  display: flex; align-items: center; transition: ${theme.transitions.default};
  &:hover { ${(p) => p.$active && `background: ${theme.colors.deepOrange};`} }
`;
const EditedBadge = styled.span`
  font-size: 10px; color: ${theme.colors.cadetGray}; font-style: italic;
`;

function CommentsSection({ taskId }: { taskId: string }) {
  const { user: me } = useAuth();
  const { data: comments, isLoading } = useComments('task', taskId);
  const addComment = useAddComment('task', taskId);
  const editComment = useEditComment();
  const deleteComment = useDeleteComment();
  const [newBody, setNewBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');

  const handleSubmit = () => {
    if (!newBody.trim()) return;
    addComment.mutate(newBody.trim(), { onSuccess: () => setNewBody('') });
  };

  const handleEdit = (id: string) => {
    if (!editBody.trim()) return;
    editComment.mutate({ id, body: editBody.trim() }, { onSuccess: () => setEditingId(null) });
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <>
      <SectionTitle>
        <FiMessageCircle size={16} /> Comments {comments && comments.length > 0 && `(${comments.length})`}
      </SectionTitle>

      {isLoading ? (
        <div style={{ color: theme.colors.cadetGray, fontSize: theme.typography.fontSize.sm }}>Loading...</div>
      ) : (
        <CommentsList>
          {comments?.map((c) => (
            <CommentItem key={c.id}>
              <Avatar name={c.author_name || 'User'} url={c.author_avatar || undefined} size={28} />
              <CommentBody>
                <CommentHeader>
                  <CommentAuthor>{c.author_name || 'User'}</CommentAuthor>
                  <CommentTime>{formatTime(c.created_at)}</CommentTime>
                  {c.is_edited && <EditedBadge>(edited)</EditedBadge>}
                </CommentHeader>
                {editingId === c.id ? (
                  <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                    <CommentTextarea value={editBody} onChange={(e) => setEditBody(e.target.value)} autoFocus />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleEdit(c.id)}
                        style={{ padding: '4px 12px', background: theme.colors.vividOrange, color: 'white', borderRadius: theme.borderRadius.sm, fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                        Save
                      </button>
                      <button onClick={() => setEditingId(null)}
                        style={{ padding: '4px 12px', background: theme.colors.lightGray, borderRadius: theme.borderRadius.sm, fontSize: '12px', border: 'none', cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <CommentText>{c.body}</CommentText>
                    {me?.id === c.author_id && (
                      <CommentActions>
                        <CommentActionBtn onClick={() => { setEditingId(c.id); setEditBody(c.body); }}>
                          <FiEdit2 size={12} /> Edit
                        </CommentActionBtn>
                        <CommentActionBtn onClick={() => deleteComment.mutate(c.id)}>
                          <FiTrash2 size={12} /> Delete
                        </CommentActionBtn>
                      </CommentActions>
                    )}
                  </>
                )}
              </CommentBody>
            </CommentItem>
          ))}
        </CommentsList>
      )}

      <CommentInput>
        <Avatar name={me?.full_name || '?'} size={28} />
        <CommentTextarea
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          placeholder="Write a comment..."
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
        />
        <SendBtn $active={!!newBody.trim()} onClick={handleSubmit}>
          <FiSend size={16} />
        </SendBtn>
      </CommentInput>
    </>
  );
}
