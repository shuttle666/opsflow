// Collapsible Sidebar + App Shell

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1' },
  { id: 'customers', label: 'Customers', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'jobs', label: 'Jobs', icon: 'M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { id: 'schedule', label: 'Schedule', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id: 'team', label: 'Team', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m9 5.197V21' },
  { id: 'agent', label: 'AI Planner', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
];

function NavIcon({ d, size }) {
  return React.createElement('svg', {
    width: size || 20, height: size || 20, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
  }, React.createElement('path', { d }));
}

function SearchIcon() {
  return React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
    React.createElement('circle', { cx: 11, cy: 11, r: 8 }),
    React.createElement('path', { d: 'M21 21l-4.35-4.35' })
  );
}

function BellIcon() {
  return React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
    React.createElement('path', { d: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0' })
  );
}

function ChevronIcon({ direction }) {
  const d = direction === 'left' ? 'M15 19l-7-7 7-7' : direction === 'right' ? 'M9 5l7 7-7 7' : 'M19 9l-7 7-7-7';
  return React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
    React.createElement('path', { d })
  );
}

function MenuIcon() {
  return React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
    React.createElement('path', { d: 'M4 6h16M4 12h16M4 18h16' })
  );
}

function PlusIcon() {
  return React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round' },
    React.createElement('path', { d: 'M12 5v14M5 12h14' })
  );
}

function Sidebar({ page, setPage, collapsed, setCollapsed }) {
  const t = useTheme();
  const w = collapsed ? 60 : 220;

  return React.createElement('aside', {
    style: {
      width: w, minWidth: w, height: '100vh', position: 'fixed', left: 0, top: 0, zIndex: 40,
      display: 'flex', flexDirection: 'column',
      background: t.surface, borderRight: `1px solid ${t.border}`,
      transition: 'width 0.2s ease, min-width 0.2s ease', overflow: 'hidden',
    }
  },
    // Logo
    React.createElement('div', {
      style: {
        display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '16px 14px' : '16px 18px',
        height: 56, flexShrink: 0,
      }
    },
      React.createElement('div', {
        style: {
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: `linear-gradient(135deg, ${t.primary}, ${t.primaryHover})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: 14,
        }
      }, 'O'),
      !collapsed && React.createElement('span', {
        style: { fontSize: 16, fontWeight: 700, color: t.text, whiteSpace: 'nowrap' }
      }, 'OpsFlow'),
    ),

    // Nav
    React.createElement('nav', {
      style: { flex: 1, padding: collapsed ? '8px 8px' : '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }
    },
      NAV_ITEMS.map(item => {
        const active = page === item.id;
        return React.createElement('button', {
          key: item.id,
          onClick: () => setPage(item.id),
          title: collapsed ? item.label : undefined,
          style: {
            display: 'flex', alignItems: 'center', gap: 10,
            padding: collapsed ? '10px 12px' : '9px 14px',
            borderRadius: 8, border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
            background: active ? t.primaryMuted : 'transparent',
            color: active ? t.primary : t.textSecondary,
            fontWeight: active ? 600 : 500, fontSize: 13,
            transition: 'all 0.12s',
          },
          onMouseEnter: e => { if (!active) e.currentTarget.style.background = t.surfaceHover; },
          onMouseLeave: e => { if (!active) e.currentTarget.style.background = 'transparent'; },
        },
          React.createElement(NavIcon, { d: item.icon }),
          !collapsed && React.createElement('span', { style: { whiteSpace: 'nowrap' } }, item.label),
        );
      })
    ),

    // Collapse toggle
    React.createElement('div', { style: { padding: collapsed ? '12px 8px' : '12px 10px', borderTop: `1px solid ${t.border}` } },
      React.createElement('button', {
        onClick: () => setCollapsed(!collapsed),
        style: {
          display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 10, width: '100%', padding: '8px 14px', borderRadius: 8,
          border: 'none', background: 'transparent', cursor: 'pointer',
          color: t.textMuted, fontSize: 12, fontWeight: 500,
        },
        onMouseEnter: e => e.currentTarget.style.background = t.surfaceHover,
        onMouseLeave: e => e.currentTarget.style.background = 'transparent',
      },
        React.createElement(ChevronIcon, { direction: collapsed ? 'right' : 'left' }),
        !collapsed && React.createElement('span', null, 'Collapse'),
      ),
    ),

    // User
    React.createElement('div', {
      style: {
        padding: collapsed ? '12px 8px' : '12px 14px', borderTop: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }
    },
      React.createElement(Avatar, { name: 'Alex Chen', size: collapsed ? 32 : 34 }),
      !collapsed && React.createElement('div', { style: { minWidth: 0, flex: 1 } },
        React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, 'Alex Chen'),
        React.createElement('div', { style: { fontSize: 11, color: t.textMuted } }, 'Owner'),
      ),
    ),
  );
}

function TopBar({ title, actions }) {
  const t = useTheme();
  return React.createElement('header', {
    style: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 56, padding: '0 28px', borderBottom: `1px solid ${t.border}`,
      background: t.surface, position: 'sticky', top: 0, zIndex: 30,
    }
  },
    React.createElement('h1', { style: { fontSize: 18, fontWeight: 700, color: t.text, margin: 0 } }, title),
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
      React.createElement(Input, { placeholder: 'Search...', icon: React.createElement(SearchIcon), style: { width: 220 } }),
      actions,
      React.createElement('button', {
        style: {
          width: 36, height: 36, borderRadius: 8, border: `1px solid ${t.border}`,
          background: t.surface, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: t.textSecondary,
        }
      }, React.createElement(BellIcon)),
    ),
  );
}

function AppShell({ page, setPage }) {
  const t = useTheme();
  const [collapsed, setCollapsed] = React.useState(false);
  const ml = collapsed ? 60 : 220;

  const pageConfig = {
    dashboard: { title: 'Dashboard', component: DashboardPage },
    customers: { title: 'Customers', component: CustomersPage },
    jobs: { title: 'Jobs', component: JobsPage },
    schedule: { title: 'Schedule', component: SchedulePage },
    team: { title: 'Team', component: TeamPage },
    agent: { title: 'AI Planner', component: AgentPage },
  };

  const cfg = pageConfig[page] || pageConfig.dashboard;
  const PageComponent = cfg.component;

  const getActions = () => {
    if (page === 'customers') return React.createElement(Button, { variant: 'primary', onClick: () => {} }, React.createElement(PlusIcon), 'Add Customer');
    if (page === 'jobs') return React.createElement(Button, { variant: 'primary', onClick: () => {} }, React.createElement(PlusIcon), 'Create Job');
    if (page === 'team') return React.createElement(Button, { variant: 'primary', onClick: () => {} }, React.createElement(PlusIcon), 'Invite Member');
    return null;
  };

  return React.createElement('div', {
    style: { minHeight: '100vh', background: t.bg, color: t.text, fontFamily: '"DM Sans", sans-serif' }
  },
    React.createElement(Sidebar, { page, setPage, collapsed, setCollapsed }),
    React.createElement('div', {
      style: { marginLeft: ml, transition: 'margin-left 0.2s ease', minHeight: '100vh', display: 'flex', flexDirection: 'column' }
    },
      React.createElement(TopBar, { title: cfg.title, actions: getActions() }),
      React.createElement('main', { style: { flex: 1, padding: 28, maxWidth: 1200 } },
        React.createElement(PageComponent),
      ),
    ),
  );
}

Object.assign(window, { Sidebar, TopBar, AppShell, NavIcon, SearchIcon, BellIcon, ChevronIcon, PlusIcon, MenuIcon, NAV_ITEMS });
