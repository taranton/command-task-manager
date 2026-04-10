import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { FiCheckSquare, FiColumns, FiBookOpen, FiSettings, FiLogOut } from 'react-icons/fi';
import { theme } from '../../styles/theme';
import { useAuth } from '../../hooks/useAuth';

const StyledSidebar = styled.aside<{ $collapsed: boolean }>`
  position: fixed;
  top: ${theme.layout.headerHeight};
  left: 0;
  bottom: 0;
  width: ${(p) => (p.$collapsed ? theme.layout.sidebarCollapsed : theme.layout.sidebarWidth)};
  background: ${theme.colors.charcoal};
  transition: ${theme.transitions.sidebar};
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;

  /* Custom scrollbar matching QRT portal */
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
    &:hover {
      background: rgba(255, 255, 255, 0.3);
    }
  }
`;

const Nav = styled.nav`
  flex: 1;
  padding: ${theme.spacing.sm} 0;
`;

const NavItem = styled.button<{ $active: boolean; $collapsed: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
  padding: ${theme.spacing.md} ${theme.spacing.lg};
  background: ${(p) => (p.$active ? 'rgba(255, 141, 0, 0.15)' : 'transparent')};
  color: ${(p) => (p.$active ? theme.colors.vividOrange : 'rgba(255, 255, 255, 0.8)')};
  border-left: 3px solid ${(p) => (p.$active ? theme.colors.vividOrange : 'transparent')};
  font-family: ${theme.typography.fontFamily.secondary};
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  transition: ${theme.transitions.default};
  white-space: nowrap;
  overflow: hidden;

  &:hover {
    background: ${(p) => (p.$active ? 'rgba(255, 141, 0, 0.15)' : 'rgba(255, 255, 255, 0.1)')};
    color: ${(p) => (p.$active ? theme.colors.vividOrange : 'white')};
  }

  svg {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  span {
    opacity: ${(p) => (p.$collapsed ? 0 : 1)};
    transition: opacity 0.2s ease;
  }
`;

const Separator = styled.div`
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: ${theme.spacing.sm} ${theme.spacing.md};
`;

const BottomSection = styled.div`
  padding: ${theme.spacing.sm} 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
`;

const navItems = [
  { path: '/my-tasks', icon: FiCheckSquare, label: 'My Tasks' },
  { path: '/board', icon: FiColumns, label: 'Board' },
  { path: '/stories', icon: FiBookOpen, label: 'Stories' },
];

interface SidebarProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const showAdmin = user?.role === 'clevel' || user?.role === 'team_lead';
  const { logout } = useAuth();

  return (
    <StyledSidebar $collapsed={collapsed}>
      <Nav>
        {navItems.map((item) => (
          <NavItem
            key={item.path}
            $active={location.pathname === item.path}
            $collapsed={collapsed}
            onClick={() => navigate(item.path)}
          >
            <item.icon />
            <span>{item.label}</span>
          </NavItem>
        ))}
        {showAdmin && (
          <>
            <Separator />
            <NavItem
              $active={location.pathname === '/admin'}
              $collapsed={collapsed}
              onClick={() => navigate('/admin')}
            >
              <FiSettings />
              <span>Teams</span>
            </NavItem>
          </>
        )}
      </Nav>

      <Separator />

      <BottomSection>
        <NavItem
          $active={false}
          $collapsed={collapsed}
          onClick={logout}
        >
          <FiLogOut />
          <span>Sign Out</span>
        </NavItem>
      </BottomSection>
    </StyledSidebar>
  );
}
