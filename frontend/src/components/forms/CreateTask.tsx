import { useState } from 'react';
import styled from 'styled-components';
import { FiX, FiPlus, FiTrash2 } from 'react-icons/fi';
import { theme } from '../../styles/theme';
import type { Priority, CreateTaskInput } from '../../types';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Modal = styled.div`
  background: ${theme.colors.white};
  border-radius: ${theme.borderRadius.xl};
  box-shadow: ${theme.shadows.xl};
  width: 90%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.spacing.lg} ${theme.spacing.xl};
  border-bottom: 1px solid ${theme.colors.border};
`;

const ModalTitle = styled.h3`
  font-family: ${theme.typography.fontFamily.primary};
  font-size: ${theme.typography.fontSize.lg};
  font-weight: ${theme.typography.fontWeight.semibold};
`;

const CloseBtn = styled.button`
  background: none;
  color: ${theme.colors.mediumGray};
  padding: ${theme.spacing.xs};
  border-radius: ${theme.borderRadius.sm};
  display: flex;
  &:hover {
    background: ${theme.colors.lightGray};
  }
`;

const ModalBody = styled.div`
  padding: ${theme.spacing.lg} ${theme.spacing.xl};
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md};
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
`;

const Label = styled.label`
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  color: ${theme.colors.mediumGray};
`;

const Input = styled.input`
  padding: 10px 16px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  font-size: ${theme.typography.fontSize.sm};
  transition: ${theme.transitions.default};
  &:focus {
    border-color: ${theme.colors.vividOrange};
  }
`;

const Textarea = styled.textarea`
  padding: 10px 16px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  font-size: ${theme.typography.fontSize.sm};
  min-height: 80px;
  resize: vertical;
  font-family: inherit;
  transition: ${theme.transitions.default};
  &:focus {
    border-color: ${theme.colors.vividOrange};
  }
`;

const Select = styled.select`
  padding: 10px 16px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  font-size: ${theme.typography.fontSize.sm};
  background: ${theme.colors.white};
  transition: ${theme.transitions.default};
  &:focus {
    border-color: ${theme.colors.vividOrange};
  }
`;

const Row = styled.div`
  display: flex;
  gap: ${theme.spacing.md};

  & > * {
    flex: 1;
  }
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.md} ${theme.spacing.xl} ${theme.spacing.lg};
  border-top: 1px solid ${theme.colors.border};
`;

const Button = styled.button<{ $primary?: boolean }>`
  padding: 10px 24px;
  border-radius: ${theme.borderRadius.md};
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.semibold};
  transition: ${theme.transitions.default};

  ${(p) =>
    p.$primary
      ? `
    background: ${theme.colors.vividOrange};
    color: ${theme.colors.white};
    &:hover:not(:disabled) { background: ${theme.colors.deepOrange}; transform: translateY(-1px); }
    &:disabled { opacity: 0.7; cursor: not-allowed; }
  `
      : `
    background: ${theme.colors.white};
    border: 1px solid ${theme.colors.border};
    color: ${theme.colors.charcoal};
    &:hover { background: ${theme.colors.lightGray}; }
  `}
`;

interface StoryOption {
  id: string;
  title: string;
}

interface CreateTaskModalProps {
  storyId: string;
  storyTitle: string;
  stories?: StoryOption[];
  onStoryChange?: (storyId: string) => void;
  onClose: () => void;
  onSubmit: (input: CreateTaskInput, subtaskTitles: string[]) => void;
  isLoading: boolean;
}

export function CreateTaskModal({
  storyId,
  storyTitle,
  stories,
  onStoryChange,
  onClose,
  onSubmit,
  isLoading,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [deadline, setDeadline] = useState('');
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [newSubtask, setNewSubtask] = useState('');

  const addSubtask = () => {
    const val = newSubtask.trim();
    if (!val) return;
    setSubtasks((prev) => [...prev, val]);
    setNewSubtask('');
  };

  const removeSubtask = (index: number) => {
    setSubtasks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit(
      {
        title: title.trim(),
        description: description || undefined,
        priority,
        deadline: deadline || undefined,
      },
      subtasks
    );
  };

  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <Modal>
        <form onSubmit={handleSubmit}>
          <ModalHeader>
            <ModalTitle>New Task</ModalTitle>
            <CloseBtn type="button" onClick={onClose}>
              <FiX size={20} />
            </CloseBtn>
          </ModalHeader>

          <ModalBody>
            <FormGroup>
              <Label>Story</Label>
              {stories && stories.length > 0 && onStoryChange ? (
                <Select value={storyId} onChange={(e) => onStoryChange(e.target.value)}>
                  {stories.map((s) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </Select>
              ) : (
                <div style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.davysGray }}>
                  {storyTitle}
                </div>
              )}
            </FormGroup>

            <FormGroup>
              <Label>Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                autoFocus
                required
              />
            </FormGroup>

            <FormGroup>
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add description..."
              />
            </FormGroup>

            <Row>
              <FormGroup>
                <Label>Priority</Label>
                <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </Select>
              </FormGroup>
              <FormGroup>
                <Label>Deadline</Label>
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </FormGroup>
            </Row>

            <FormGroup>
              <Label>Subtasks</Label>
              {subtasks.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                  {subtasks.map((st, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 12px',
                      background: theme.colors.background,
                      borderRadius: theme.borderRadius.sm,
                      fontSize: theme.typography.fontSize.sm,
                    }}>
                      <span style={{ flex: 1 }}>{st}</span>
                      <button
                        type="button"
                        onClick={() => removeSubtask(i)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: theme.colors.cadetGray, display: 'flex', padding: '2px',
                        }}
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <Input
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
                  placeholder="Add a subtask..."
                  style={{ flex: 1 }}
                />
                <Button
                  type="button"
                  onClick={addSubtask}
                  disabled={!newSubtask.trim()}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px' }}
                >
                  <FiPlus size={14} /> Add
                </Button>
              </div>
            </FormGroup>
          </ModalBody>

          <ModalFooter>
            <Button type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" $primary disabled={!title.trim() || isLoading}>
              {isLoading ? 'Creating...' : 'Create Task'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </Overlay>
  );
}
