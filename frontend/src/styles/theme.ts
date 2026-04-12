export const theme = {
  colors: {
    // Primary
    charcoal: '#282928',
    vividOrange: '#FF8D00',
    deepOrange: '#d67000',
    lightGray: '#F0F1F3',

    // Secondary
    davysGray: '#535352',
    cadetGray: '#999FA0',
    silver: '#B2B8B8',
    mediumGray: '#666666',

    // Status colors (all entity statuses)
    status: {
      backlog: '#9E9E9E',
      to_do: '#2196F3',
      in_progress: '#FF9800',
      in_review: '#9C27B0',
      done: '#4CAF50',
      closed: '#666666',
      active: '#FF9800',    // Story status
      // Legacy aliases
      todo: '#2196F3',
    } as Record<string, string>,

    // Status light backgrounds
    statusLight: {
      backlog: '#F5F5F5',
      to_do: '#E3F2FD',
      in_progress: '#FFF3E0',
      in_review: '#F3E5F5',
      done: '#E8F5E9',
      closed: '#F5F5F5',
      active: '#FFF3E0',
      // Legacy aliases
      todo: '#E3F2FD',
    } as Record<string, string>,

    // Priority colors
    priority: {
      critical: '#F44336',
      high: '#FF9800',
      medium: '#2196F3',
      low: '#4CAF50',
    },

    // UI
    white: '#FFFFFF',
    border: '#E5E7EB',
    background: '#F9FAFB',
    error: '#F44336',
    errorLight: '#FFEBEE',
    success: '#4CAF50',
    successLight: '#E8F5E9',
    warning: '#FF9800',
    warningLight: '#FFF3E0',
    info: '#2196F3',
    infoLight: '#E3F2FD',
  },

  typography: {
    fontFamily: {
      primary: '"Barlow", sans-serif',
      secondary: '"Inter", "Helvetica", sans-serif',
    },
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      md: '1rem',       // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '2rem',    // 32px
    },
    fontWeight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
  },

  spacing: {
    xs: '0.25rem',  // 4px
    sm: '0.5rem',   // 8px
    md: '1rem',     // 16px
    lg: '1.5rem',   // 24px
    xl: '2rem',     // 32px
    '2xl': '3rem',  // 48px
  },

  shadows: {
    sm: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
    md: '0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)',
    lg: '0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23)',
    xl: '0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22)',
    card: '0 2px 10px rgba(12, 23, 41, 0.08)',
    cardHover: '0 6px 18px rgba(12, 23, 41, 0.12)',
    fab: '0 4px 12px rgba(255, 141, 0, 0.4)',
  },

  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    round: '50%',
    pill: '20px',
  },

  breakpoints: {
    xs: '480px',
    sm: '768px',
    md: '1024px',
    lg: '1200px',
    xl: '1440px',
  },

  layout: {
    headerHeight: '56px',
    sidebarWidth: '260px',
    sidebarCollapsed: '70px',
    bottomNavHeight: '56px',
    detailPanelWidth: '480px',
    kanbanColumnWidth: '280px',
  },

  transitions: {
    default: 'all 0.2s ease',
    fast: 'all 0.15s ease',
    sidebar: 'width 0.3s ease',
  },
} as const;

export type Theme = typeof theme;
