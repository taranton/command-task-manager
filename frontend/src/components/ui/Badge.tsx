import styled from 'styled-components';
import { theme } from '../../styles/theme';
import type { Status, Priority } from '../../types';

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

export function StatusBadge({ status }: { status: Status }) {
  const color = theme.colors.status[status] || theme.colors.cadetGray;
  const bg = theme.colors.statusLight[status] || theme.colors.lightGray;
  const labels: Record<string, string> = {
    backlog: 'Backlog',
    todo: 'To Do',
    in_progress: 'In Progress',
    in_review: 'In Review',
    done: 'Done',
    closed: 'Closed',
  };
  return (
    <StyledBadge $bg={bg} $color={color}>
      {labels[status] || status}
    </StyledBadge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const color = theme.colors.priority[priority] || theme.colors.cadetGray;
  const bg = color + '18';
  const labels: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };
  return (
    <StyledBadge $bg={bg} $color={color}>
      {labels[priority] || priority}
    </StyledBadge>
  );
}

// Priority dot indicator (4px colored circle)
export const PriorityDot = styled.div<{ $priority: Priority }>`
  width: 8px;
  height: 8px;
  border-radius: ${theme.borderRadius.round};
  background: ${(p) => theme.colors.priority[p.$priority] || theme.colors.cadetGray};
  flex-shrink: 0;
`;
