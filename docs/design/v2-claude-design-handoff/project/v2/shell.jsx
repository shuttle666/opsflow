// V2 Sidebar — Dark, modern, collapsible

const V2_NAV = [
  { id: 'dashboard', label: 'Dashboard', d: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' },
  { id: 'customers', label: 'Customers', d: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
  { id: 'jobs', label: 'Jobs', d: 'M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { id: 'schedule', label: 'Schedule', d: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id: 'team', label: 'Team', d: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m9 5.197V21' },
  { id: 'agent', label: 'AI Planner', d: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
];

function V2Sidebar({ page, setPage, collapsed, setCollapsed }) {
  const t = useT();
  const w = collapsed ? 64 : 230;

  return React.createElement('aside', {
    style: {
      width: w, minWidth: w, height: '100vh', position: 'fixed', left: 0, top: 0, zIndex: 40,
      display: 'flex', flexDirection: 'column',
      background: t.sidebarGradient, transition: 'width 0.25s ease, min-width 0.25s ease',
      overflow: 'hidden', borderRight: 'none',
    }
  },
    // Logo
    React.createElement('div', {
      style: {
        display: 'flex', alignItems: 'center', gap: 11, padding: collapsed ? '18px 16px' : '18px 20px',
        height: 60, flexShrink: 0,
      }
    },
      React.createElement('div', {
        style: {
          width: 32, height: 32, borderRadius: 10, flexShrink: 0,
          background: t.gradient,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: 15, boxShadow: `0 4px 12px ${t.primaryGlow}`,
        }
      }, 'O'),
      !collapsed && React.createElement('span', {
        style: { fontSize: 17, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', letterSpacing: '-0.02em' }
      }, 'OpsFlow'),
    ),

    // Nav
    React.createElement('nav', {
      style: { flex: 1, padding: collapsed ? '12px 10px' : '12px 12px', display: 'flex', flexDirection: 'column', gap: 2 }
    },
      V2_NAV.map(item => {
        const active = page === item.id;
        return React.createElement('button', {
          key: item.id,
          onClick: () => setPage(item.id),
          title: collapsed ? item.label : undefined,
          style: {
            display: 'flex', alignItems: 'center', gap: 11, position: 'relative',
            padding: collapsed ? '10px 14px' : '9px 14px',
            borderRadius: 10, border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
            background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
            color: active ? '#fff' : 'rgba(255,255,255,0.45)',
            fontWeight: active ? 600 : 500, fontSize: 13,
            transition: 'all 0.15s',
          },
          onMouseEnter: e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }},
          onMouseLeave: e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }},
        },
          // Active indicator bar
          active && React.createElement('div', {
            style: {
              position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
              width: 3, height: 20, borderRadius: 2, background: t.sidebarAccent,
              boxShadow: `0 0 8px ${t.sidebarAccent}60`,
            }
          }),
          React.createElement(V2Icon, { d: item.d, size: 19 }),
          !collapsed && React.createElement('span', { style: { whiteSpace: 'nowrap' } }, item.label),
        );
      }),
    ),

    // Collapse toggle
    React.createElement('div', { style: { padding: '8px 12px' } },
      React.createElement('button', {
        onClick: () => setCollapsed(!collapsed),
        style: {
          display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 10, width: '100%', padding: '8px 14px', borderRadius: 8,
          border: 'none', background: 'transparent', cursor: 'pointer',
          color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 500,
          transition: 'color 0.15s',
        },
        onMouseEnter: e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)',
        onMouseLeave: e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)',
      },
        React.createElement(V2ChevronIcon, { dir: collapsed ? 'right' : 'left' }),
        !collapsed && React.createElement('span', null, 'Collapse'),
      ),
    ),

    // User card
    React.createElement('div', {
      style: {
        padding: collapsed ? '14px 12px' : '14px 16px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 10,
      }
    },
      React.createElement('div', {
        style: {
          width: 34, height: 34, borderRadius: 34, flexShrink: 0,
          background: 'rgba(255,255,255,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 700,
        }
      }, 'AC'),
      !collapsed && React.createElement('div', { style: { minWidth: 0, flex: 1 } },
        React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, 'Alex Chen'),
        React.createElement('div', { style: { fontSize: 11, color: 'rgba(255,255,255,0.35)' } }, 'Owner'),
      ),
    ),
  );
}

function V2TopBar({ title, actions }) {
  const t = useT();
  return React.createElement('header', {
    style: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 56, padding: '0 28px',
      background: 'transparent', position: 'sticky', top: 0, zIndex: 30,
    }
  },
    React.createElement('h1', {
      style: { fontSize: 20, fontWeight: 800, color: t.text, margin: 0, letterSpacing: '-0.03em' }
    }, title),
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
      React.createElement(V2Input, { placeholder: 'Search...', icon: React.createElement(V2SearchIcon), style: { width: 200 } }),
      actions,
      React.createElement('button', {
        style: {
          width: 36, height: 36, borderRadius: 10, border: `1px solid ${t.border}`,
          background: t.surface, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: t.textSecondary, position: 'relative', transition: 'all 0.15s',
        },
        onMouseEnter: e => e.currentTarget.style.borderColor = t.primary + '40',
        onMouseLeave: e => e.currentTarget.style.borderColor = t.border,
      },
        React.createElement(V2BellIcon),
        // notification dot
        React.createElement('div', {
          style: { position: 'absolute', top: 7, right: 8, width: 7, height: 7, borderRadius: 4, background: '#EF4444', border: `2px solid ${t.surface}` }
        }),
      ),
    ),
  );
}

function V2Shell({ page, setPage }) {
  const t = useT();
  const [collapsed, setCollapsed] = React.useState(false);
  const [detailView, setDetailView] = React.useState(null); // { type: 'job'|'customer', data }
  const ml = collapsed ? 64 : 230;

  // Expose navigation for child pages
  const nav = React.useMemo(() => ({
    openJobDetail: (data) => setDetailView({ type: 'job', data }),
    openCustomerDetail: (data) => setDetailView({ type: 'customer', data }),
    back: () => setDetailView(null),
  }), []);

  // Clear detail view on page switch
  React.useEffect(() => { setDetailView(null); }, [page]);

  const pageConfig = {
    dashboard: { title: 'Dashboard', component: V2DashboardPage },
    customers: { title: 'Customers', component: V2CustomersPage },
    jobs: { title: 'Jobs', component: V2JobsPage },
    schedule: { title: 'Schedule', component: V2SchedulePage },
    team: { title: 'Team', component: V2TeamPage },
    agent: { title: 'AI Planner', component: V2AgentPage },
  };
  const cfg = pageConfig[page] || pageConfig.dashboard;
  const PageComp = cfg.component;

  const acts = () => {
    if (detailView) return null;
    if (page === 'customers') return React.createElement(V2Btn, { variant: 'primary' }, React.createElement(V2PlusIcon), 'Add Customer');
    if (page === 'jobs') return React.createElement(V2Btn, { variant: 'primary' }, React.createElement(V2PlusIcon), 'Create Job');
    if (page === 'team') return React.createElement(V2Btn, { variant: 'primary' }, React.createElement(V2PlusIcon), 'Invite');
    return null;
  };

  const title = detailView
    ? (detailView.type === 'job' ? 'Job Detail' : 'Customer Detail')
    : cfg.title;

  const renderContent = () => {
    if (detailView?.type === 'job') return React.createElement(V2JobDetailPage, { job: detailView.data, onBack: nav.back });
    if (detailView?.type === 'customer') return React.createElement(V2CustomerDetailPage, { customer: detailView.data, onBack: nav.back });
    return React.createElement(V2NavContext.Provider, { value: nav }, React.createElement(PageComp));
  };

  return React.createElement('div', {
    style: { minHeight: '100vh', background: t.bg, color: t.text, fontFamily: '"Plus Jakarta Sans", "DM Sans", sans-serif' }
  },
    React.createElement(V2Sidebar, { page, setPage, collapsed, setCollapsed }),
    React.createElement('div', {
      style: { marginLeft: ml, transition: 'margin-left 0.25s ease', minHeight: '100vh', display: 'flex', flexDirection: 'column' }
    },
      React.createElement(V2TopBar, { title, actions: acts() }),
      React.createElement('main', { style: { flex: 1, padding: '4px 28px 28px', maxWidth: 1200, overflowY: 'auto', height: 'calc(100vh - 56px)' } },
        renderContent(),
      ),
    ),
  );
}



Object.assign(window, { V2Sidebar, V2TopBar, V2Shell, V2_NAV, V2NavContext, useV2Nav });
