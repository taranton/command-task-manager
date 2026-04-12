import { useState } from 'react';
import styled from 'styled-components';
import { FiX } from 'react-icons/fi';
import { theme } from '../../styles/theme';
import type { Priority, CreateStoryInput } from '../../types';

const Overlay = styled.div`
  position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 2000;
  display: flex; align-items: center; justify-content: center;
`;
const Modal = styled.div`
  background: white; border-radius: ${theme.borderRadius.xl};
  box-shadow: ${theme.shadows.xl}; width: 90%; max-width: 520px; max-height: 90vh; overflow-y: auto;
`;
const ModalHeader = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  padding: ${theme.spacing.lg} ${theme.spacing.xl}; border-bottom: 1px solid ${theme.colors.border};
`;
const ModalTitle = styled.h3`
  font-family: ${theme.typography.fontFamily.primary};
  font-size: ${theme.typography.fontSize.lg}; font-weight: ${theme.typography.fontWeight.semibold};
`;
const CloseBtn = styled.button`
  background: none; color: ${theme.colors.mediumGray}; padding: ${theme.spacing.xs};
  border-radius: ${theme.borderRadius.sm}; display: flex;
  &:hover { background: ${theme.colors.lightGray}; }
`;
const ModalBody = styled.div`
  padding: ${theme.spacing.lg} ${theme.spacing.xl};
  display: flex; flex-direction: column; gap: ${theme.spacing.md};
`;
const FormGroup = styled.div`display: flex; flex-direction: column; gap: ${theme.spacing.sm};`;
const Label = styled.label`
  font-size: ${theme.typography.fontSize.sm}; font-weight: ${theme.typography.fontWeight.medium};
  color: ${theme.colors.mediumGray};
`;
const Input = styled.input`
  padding: 10px 16px; border: 1px solid ${theme.colors.border}; border-radius: ${theme.borderRadius.md};
  font-size: ${theme.typography.fontSize.sm}; transition: ${theme.transitions.default};
  &:focus { border-color: ${theme.colors.vividOrange}; outline: none; }
`;
const Textarea = styled.textarea`
  padding: 10px 16px; border: 1px solid ${theme.colors.border}; border-radius: ${theme.borderRadius.md};
  font-size: ${theme.typography.fontSize.sm}; min-height: 80px; resize: vertical; font-family: inherit;
  &:focus { border-color: ${theme.colors.vividOrange}; outline: none; }
`;
const Select = styled.select`
  padding: 10px 16px; border: 1px solid ${theme.colors.border}; border-radius: ${theme.borderRadius.md};
  font-size: ${theme.typography.fontSize.sm}; background: white;
  &:focus { border-color: ${theme.colors.vividOrange}; outline: none; }
`;
const Row = styled.div`display: flex; gap: ${theme.spacing.md}; & > * { flex: 1; }`;
const ModalFooter = styled.div`
  display: flex; justify-content: flex-end; gap: ${theme.spacing.sm};
  padding: ${theme.spacing.md} ${theme.spacing.xl} ${theme.spacing.lg};
  border-top: 1px solid ${theme.colors.border};
`;
const Button = styled.button<{ $primary?: boolean }>`
  padding: 10px 24px; border-radius: ${theme.borderRadius.md};
  font-size: ${theme.typography.fontSize.sm}; font-weight: ${theme.typography.fontWeight.semibold};
  transition: ${theme.transitions.default};
  ${(p) => p.$primary
    ? `background: ${theme.colors.vividOrange}; color: white; &:hover:not(:disabled) { background: ${theme.colors.deepOrange}; } &:disabled { opacity: 0.7; cursor: not-allowed; }`
    : `background: white; border: 1px solid ${theme.colors.border}; color: ${theme.colors.charcoal}; &:hover { background: ${theme.colors.lightGray}; }`}
`;

interface Props {
  onClose: () => void;
  onSubmit: (input: CreateStoryInput) => void;
  isLoading: boolean;
}

export function CreateStoryModal({ onClose, onSubmit, isLoading }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [deadline, setDeadline] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description || undefined,
      priority,
      deadline: deadline || undefined,
    });
  };

  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <Modal>
        <form onSubmit={handleSubmit}>
          <ModalHeader>
            <ModalTitle>New Story</ModalTitle>
            <CloseBtn type="button" onClick={onClose}><FiX size={20} /></CloseBtn>
          </ModalHeader>
          <ModalBody>
            <FormGroup>
              <Label>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Story title" autoFocus required />
            </FormGroup>
            <FormGroup>
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this story about..." />
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
                <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </FormGroup>
            </Row>
          </ModalBody>
          <ModalFooter>
            <Button type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" $primary disabled={!title.trim() || isLoading}>
              {isLoading ? 'Creating...' : 'Create Story'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </Overlay>
  );
}
