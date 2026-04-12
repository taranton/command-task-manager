import styled from 'styled-components';
import { theme } from '../../styles/theme';
import type { Priority } from '../../types';

const StyledBadge = styled.span<{ $bg: string; $color: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  background: ${(p) => p.$bg};
  color: ${(p) => p.$color};
  border-radius: ${theme.borderRadius.pill};
  font-size: ${theme.typography.fontSize.xs};
  font-weight: ${theme.typography.fontWeight.medium};
  white-space: nowrap;
`;

// Unified status labels for all entity types
const ALL_STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  to_do: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
  closed: 'Closed',
  active: 'Active',
};

export function StatusBadge({ status }: { status: string }) {
  const color = theme.colors.status[status] || theme.colors.cadetGray;
  const bg = theme.colors.statusLight[status] || theme.colors.lightGray;
  return (
    <StyledBadge $bg={bg} $color={color}>
      {ALL_STATUS_LABELS[status] || status}
    </StyledBadge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const color = theme.colors.priority[priority] || theme.colors.cadetGray;
  const bg = color + '18';
  return (
    <StyledBadge $bg={bg} $color={color}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </StyledBadge>
  );
}

export const PriorityDot = styled.div<{ $priority: Priority }>`
  width: 8px;
  height: 8px;
  border-radius: ${theme.borderRadius.round};
  background: ${(p) => theme.colors.priority[p.$priority] || theme.colors.cadetGray};
  flex-shrink: 0;
`;
