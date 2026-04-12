import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { FiCheckSquare, FiColumns, FiMoreHorizontal } from 'react-icons/fi';
import { theme } from '../../styles/theme';

const NavBar = styled.nav`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: ${theme.layout.bottomNavHeight};
  background: ${theme.colors.white};
  border-top: 1px solid ${theme.colors.border};
  display: flex;
  align-items: center;
  justify-content: space-around;
  z-index: 1001;
  padding-bottom: env(safe-area-inset-bottom);
`;

const NavTab = styled.button<{ $active: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  background: none;
  color: ${(p) => (p.$active ? theme.colors.vividOrange : theme.colors.cadetGray)};
  transition: ${theme.transitions.default};

  svg {
    width: 22px;
    height: 22px;
  }

  span {
    font-size: 11px;
    font-weight: ${theme.typography.fontWeight.medium};
  }
`;

const tabs = [
  { path: '/my-tasks', icon: FiCheckSquare, label: 'Tasks' },
  { path: '/board', icon: FiColumns, label: 'Board' },
  { path: '/more', icon: FiMoreHorizontal, label: 'More' },
];

export function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <NavBar>
      {tabs.map((tab) => (
        <NavTab
          key={tab.path}
          $active={location.pathname === tab.path}
          onClick={() => navigate(tab.path)}
        >
          <tab.icon />
          <span>{tab.label}</span>
        </NavTab>
      ))}
    </NavBar>
  );
}
