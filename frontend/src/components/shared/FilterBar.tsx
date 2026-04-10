import { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { FiFilter, FiX } from 'react-icons/fi';
import { theme } from '../../styles/theme';
import { Avatar } from '../ui/Avatar';
import { useUsers, useTeams } from '../../hooks/useUsers';
import { useAuth } from '../../hooks/useAuth';
import type { Priority, BoardFilter } from '../../types';
import { PRIORITY_LABELS } from '../../types';

const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  flex-wrap: wrap;
`;

const Chip = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: ${(p) => (p.$active ? theme.colors.vividOrange + '15' : theme.colors.white)};
  color: ${(p) => (p.$active ? theme.colors.vividOrange : theme.colors.davysGray)};
  border: 1px solid ${(p) => (p.$active ? theme.colors.vividOrange : theme.colors.border)};
  border-radius: ${theme.borderRadius.pill};
  font-size: ${theme.typography.fontSize.xs};
  font-weight: ${theme.typography.fontWeight.medium};
  transition: ${theme.transitions.default};
  white-space: nowrap;

  &:hover {
    border-color: ${theme.colors.vividOrange};
    color: ${theme.colors.vividOrange};
  }

  svg {
    width: 12px;
    height: 12px;
  }
`;

const ChipWrapper = styled.div`
  position: relative;
`;

const Dropdown = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  background: ${theme.colors.white};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  box-shadow: ${theme.shadows.md};
  z-index: 100;
  min-width: 180px;
  max-height: 240px;
  overflow-y: auto;
`;

const DropdownItem = styled.button<{ $active: boolean }>`
  width: 100%;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  text-align: left;
  font-size: ${theme.typography.fontSize.sm};
  color: ${theme.colors.charcoal};
  background: ${(p) => (p.$active ? theme.colors.background : 'transparent')};
  transition: ${theme.transitions.default};
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};

  &:hover {
    background: ${theme.colors.background};
  }
`;

interface FilterBarProps {
  filter: BoardFilter;
  onFilterChange: (filter: BoardFilter) => void;
}

export function FilterBar({ filter, onFilterChange }: FilterBarProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const { data: users } = useUsers();
  const { data: teams } = useTeams();
  const { user: currentUser } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const priorities: Priority[] = ['critical', 'high', 'medium', 'low'];

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedUser = users?.find((u) => u.id === filter.assignee_id);

  return (
    <Bar ref={ref}>
      <FiFilter size={14} color={theme.colors.cadetGray} />

      {/* My Tasks quick filter */}
      <Chip
        $active={filter.assignee_id === currentUser?.id}
        onClick={() => {
          if (filter.assignee_id === currentUser?.id) {
            onFilterChange({ ...filter, assignee_id: undefined });
          } else {
            onFilterChange({ ...filter, assignee_id: currentUser?.id });
          }
        }}
      >
        My Tasks
      </Chip>

      {/* Team filter */}
      {teams && teams.length > 0 && (
        <ChipWrapper>
          <Chip
            $active={!!filter.team_id}
            onClick={() => setOpenDropdown(openDropdown === 'team' ? null : 'team')}
          >
            {filter.team_id
              ? teams.find((t) => t.id === filter.team_id)?.name || 'Team'
              : 'Team'}
            {filter.team_id && (
              <FiX
                onClick={(e) => {
                  e.stopPropagation();
                  onFilterChange({ ...filter, team_id: undefined });
                  setOpenDropdown(null);
                }}
              />
            )}
          </Chip>
          {openDropdown === 'team' && (
            <Dropdown>
              {teams.map((t) => (
                <DropdownItem
                  key={t.id}
                  $active={filter.team_id === t.id}
                  onClick={() => {
                    onFilterChange({ ...filter, team_id: t.id });
                    setOpenDropdown(null);
                  }}
                >
                  {t.name} {t.office && `(${t.office})`}
                </DropdownItem>
              ))}
            </Dropdown>
          )}
        </ChipWrapper>
      )}

      {/* Assignee filter */}
      <ChipWrapper>
        <Chip
          $active={!!filter.assignee_id && filter.assignee_id !== currentUser?.id}
          onClick={() => setOpenDropdown(openDropdown === 'assignee' ? null : 'assignee')}
        >
          {selectedUser && filter.assignee_id !== currentUser?.id
            ? selectedUser.full_name
            : 'Assignee'}
          {filter.assignee_id && filter.assignee_id !== currentUser?.id && (
            <FiX
              onClick={(e) => {
                e.stopPropagation();
                onFilterChange({ ...filter, assignee_id: undefined });
                setOpenDropdown(null);
              }}
            />
          )}
        </Chip>
        {openDropdown === 'assignee' && users && (
          <Dropdown>
            {users.map((u) => (
              <DropdownItem
                key={u.id}
                $active={filter.assignee_id === u.id}
                onClick={() => {
                  onFilterChange({ ...filter, assignee_id: u.id });
                  setOpenDropdown(null);
                }}
              >
                <Avatar name={u.full_name} size={20} />
                {u.full_name}
              </DropdownItem>
            ))}
          </Dropdown>
        )}
      </ChipWrapper>

      {/* Priority filter */}
      <ChipWrapper>
        <Chip
          $active={!!filter.priority}
          onClick={() => setOpenDropdown(openDropdown === 'priority' ? null : 'priority')}
        >
          {filter.priority ? PRIORITY_LABELS[filter.priority] : 'Priority'}
          {filter.priority && (
            <FiX
              onClick={(e) => {
                e.stopPropagation();
                onFilterChange({ ...filter, priority: undefined });
                setOpenDropdown(null);
              }}
            />
          )}
        </Chip>
        {openDropdown === 'priority' && (
          <Dropdown>
            {priorities.map((p) => (
              <DropdownItem
                key={p}
                $active={filter.priority === p}
                onClick={() => {
                  onFilterChange({ ...filter, priority: p });
                  setOpenDropdown(null);
                }}
              >
                {PRIORITY_LABELS[p]}
              </DropdownItem>
            ))}
          </Dropdown>
        )}
      </ChipWrapper>
    </Bar>
  );
}
