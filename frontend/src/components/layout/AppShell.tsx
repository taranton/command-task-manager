import { type ReactNode } from 'react';
import styled from 'styled-components';
import { theme } from '../../styles/theme';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { usePersistedState } from '../../hooks/usePersistedState';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
`;

const Body = styled.div`
  display: flex;
  flex: 1;
  padding-top: ${theme.layout.headerHeight};
`;

const MainContent = styled.main<{ $sidebarCollapsed: boolean; $isMobile: boolean }>`
  flex: 1;
  margin-left: ${(p) =>
    p.$isMobile ? '0' : p.$sidebarCollapsed ? theme.layout.sidebarCollapsed : theme.layout.sidebarWidth};
  margin-bottom: ${(p) => (p.$isMobile ? theme.layout.bottomNavHeight : '0')};
  transition: margin-left 0.3s ease;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: calc(100vh - ${theme.layout.headerHeight});
`;

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistedState<boolean>('app:sidebarCollapsed', false);

  return (
    <Layout>
      <Header
        onMenuToggle={() => setSidebarCollapsed((v) => !v)}
        isMobile={isMobile}
      />
      <Body>
        {!isMobile && (
          <Sidebar
            collapsed={sidebarCollapsed}
            onCollapse={setSidebarCollapsed}
          />
        )}
        <MainContent $sidebarCollapsed={sidebarCollapsed} $isMobile={isMobile}>
          {children}
        </MainContent>
      </Body>
      {isMobile && <MobileNav />}
    </Layout>
  );
}
