import styled from 'styled-components';
import { FiMenu, FiSearch, FiBell } from 'react-icons/fi';
import { theme } from '../../styles/theme';
import { useAuth } from '../../hooks/useAuth';

const StyledHeader = styled.header`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: ${theme.layout.headerHeight};
  background: ${theme.colors.charcoal};
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  padding: 0 ${theme.spacing.md};
  z-index: 1001;
  gap: ${theme.spacing.md};
`;

const MenuButton = styled.button`
  background: none;
  color: white;
  padding: ${theme.spacing.sm};
  border-radius: ${theme.borderRadius.sm};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: ${theme.transitions.default};

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  svg {
    width: 20px;
    height: 20px;
  }
`;

const Logo = styled.div`
  font-family: ${theme.typography.fontFamily.primary};
  font-size: ${theme.typography.fontSize.lg};
  font-weight: ${theme.typography.fontWeight.bold};
  color: white;
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};

  span {
    color: ${theme.colors.vividOrange};
  }
`;

const Spacer = styled.div`
  flex: 1;
`;

const IconButton = styled.button`
  background: none;
  color: rgba(255, 255, 255, 0.8);
  padding: ${theme.spacing.sm};
  border-radius: ${theme.borderRadius.sm};
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: ${theme.transitions.default};

  &:hover {
    color: white;
    background: rgba(255, 255, 255, 0.1);
  }

  svg {
    width: 20px;
    height: 20px;
  }
`;

const Avatar = styled.div`
  width: 36px;
  height: 36px;
  border-radius: ${theme.borderRadius.round};
  background: linear-gradient(135deg, ${theme.colors.vividOrange}, ${theme.colors.deepOrange});
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.semibold};
  cursor: pointer;
`;

interface HeaderProps {
  onMenuToggle: () => void;
  isMobile: boolean;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { user } = useAuth();

  const initials = user?.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  return (
    <StyledHeader>
      <MenuButton onClick={onMenuToggle}>
        <FiMenu />
      </MenuButton>

      <Logo>
        <span>Command</span>
      </Logo>

      <Spacer />

      <IconButton title="Search (Cmd+K)">
        <FiSearch />
      </IconButton>

      <IconButton title="Notifications">
        <FiBell />
      </IconButton>

      <Avatar title={user?.full_name || ''}>
        {initials}
      </Avatar>
    </StyledHeader>
  );
}
