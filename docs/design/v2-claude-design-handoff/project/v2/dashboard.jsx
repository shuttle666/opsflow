// V2 Dashboard — Bold, visual, modern

function V2DashboardPage() {
  const t = useT();

  // Greeting based on time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const stats = [
    { label: 'Active Jobs', value: '24', icon: '📋', trend: 8, trendLabel: '+3 today', color: t.primary },
    { label: 'Revenue', value: '$48.2k', icon: '💰', trend: 12, trendLabel: '+12% vs last mo.', color: '#16A34A' },
    { label: 'Avg. Duration', value: '2h 15m', icon: '⏱', trend: -5, trendLabel: '5% faster', color: '#F59E0B' },
    { label: 'Active Crew', value: '12/15', icon: '👥', trend: 0, trendLabel: 'All deployed', color: '#8B5CF6' },
  ];

  const schedule = [
    { id: 1, customer: 'Sarah Jenkins', address: '12 Ridge Rd, Austin', type: 'HVAC Maintenance', status: 'SCHEDULED', time: '10:00 AM', assignee: 'Mike R.' },
    { id: 2, customer: 'Mike Ross', address: '8805 Bee Caves Rd', type: 'Plumbing Check', status: 'IN_PROGRESS', time: '11:30 AM', assignee: 'Tom L.' },
    { id: 3, customer: 'Lisa Park', address: '221 Congress Ave', type: 'Electrical Repair', status: 'SCHEDULED', time: '2:00 PM', assignee: 'Sarah K.' },
    { id: 4, customer: 'David Kim', address: '45 Lamar Blvd', type: 'AC Installation', status: 'NEW', time: '4:30 PM', assignee: 'Unassigned' },
  ];

  const activities = [
    { id: 1, title: 'Job #2045 completed', desc: 'by Mike Ross', time: '2m ago', color: '#16A34A', icon: '✓' },
    { id: 2, title: 'Invoice #1087 sent', desc: 'Sarah Jenkins — $1,240', time: '15m ago', color: t.primary, icon: '→' },
    { id: 3, title: 'New job request', desc: 'from Alex Chen', time: '1h ago', color: '#F59E0B', icon: '+' },
    { id: 4, title: 'Staff check-in', desc: 'Tom Lee clocked in', time: '2h ago', color: '#8B5CF6', icon: '•' },
    { id: 5, title: 'Schedule updated', desc: 'Tomorrow, 3 changes', time: '3h ago', color: '#0EA5E9', icon: '↻' },
  ];

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 20 } },
    // Welcome banner
    React.createElement('div', {
      style: {
        padding: '24px 28px', borderRadius: 14, position: 'relative', overflow: 'hidden',
        background: t.gradient, color: '#fff',
      }
    },
      // Decorative circles
      React.createElement('div', { style: { position: 'absolute', top: -30, right: -20, width: 120, height: 120, borderRadius: 60, background: 'rgba(255,255,255,0.08)' } }),
      React.createElement('div', { style: { position: 'absolute', bottom: -40, right: 60, width: 80, height: 80, borderRadius: 40, background: 'rgba(255,255,255,0.05)' } }),
      React.createElement('div', { style: { position: 'relative' } },
        React.createElement('div', { style: { fontSize: 14, fontWeight: 500, opacity: 0.8, marginBottom: 4 } }, greeting + ', Alex'),
        React.createElement('div', { style: { fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' } }, 'You have 6 jobs scheduled today'),
        React.createElement('div', { style: { fontSize: 13, opacity: 0.7, marginTop: 6 } }, '4 assigned · 2 pending review · All crew on track'),
      ),
    ),

    // Stats grid
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 } },
      stats.map((s, i) => React.createElement(V2StatCard, { key: i, ...s }))
    ),

    // Main content: Schedule + Activity
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14 } },
      // Today's Schedule
      React.createElement(V2Card, { style: { padding: 0, overflow: 'hidden' } },
        React.createElement('div', {
          style: {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px', borderBottom: `1px solid ${t.borderLight}`,
          }
        },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            React.createElement('h2', { style: { fontSize: 15, fontWeight: 700, color: t.text, margin: 0 } }, "Today's Schedule"),
            React.createElement('span', {
              style: {
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: t.primaryMuted, color: t.primary,
              }
            }, schedule.length),
          ),
          React.createElement(V2Btn, { variant: 'ghost' }, 'View all'),
        ),
        React.createElement(V2Table, {
          columns: [
            { label: 'Customer', key: 'customer', render: r => React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
              React.createElement(V2Avatar, { name: r.customer, size: 30 }),
              React.createElement('div', null,
                React.createElement('div', { style: { fontWeight: 600, color: t.text } }, r.customer),
                React.createElement('div', { style: { fontSize: 11, color: t.textMuted } }, r.address),
              )
            )},
            { label: 'Job', key: 'type', render: r => React.createElement('span', { style: { color: t.textSecondary } }, r.type) },
            { label: 'Status', key: 'status', render: r => React.createElement(V2Badge, { status: r.status }) },
            { label: 'Time', key: 'time', render: r => React.createElement('span', {
              style: { fontFamily: '"DM Mono", monospace', fontSize: 12, fontWeight: 500, color: t.textSecondary }
            }, r.time) },
            { label: 'Crew', key: 'assignee', render: r => React.createElement('span', {
              style: { color: r.assignee === 'Unassigned' ? t.accent : t.textSecondary, fontWeight: r.assignee === 'Unassigned' ? 600 : 400 }
            }, r.assignee) },
          ],
          rows: schedule,
        }),
      ),

      // Activity feed
      React.createElement(V2Card, { style: { padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' } },
        React.createElement('div', {
          style: { padding: '14px 18px', borderBottom: `1px solid ${t.borderLight}` }
        },
          React.createElement('h2', { style: { fontSize: 15, fontWeight: 700, color: t.text, margin: 0 } }, 'Activity'),
        ),
        React.createElement('div', { style: { flex: 1, padding: '4px 6px' } },
          activities.map(a => React.createElement('div', {
            key: a.id,
            style: {
              display: 'flex', gap: 12, padding: '11px 12px', borderRadius: 8,
              cursor: 'pointer', transition: 'background 0.1s',
            },
            onMouseEnter: e => e.currentTarget.style.background = t.surfaceHover,
            onMouseLeave: e => e.currentTarget.style.background = 'transparent',
          },
            React.createElement('div', {
              style: {
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: a.color + '14', color: a.color, fontSize: 12, fontWeight: 700,
              }
            }, a.icon),
            React.createElement('div', { style: { flex: 1, minWidth: 0 } },
              React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: t.text, lineHeight: 1.3 } }, a.title),
              React.createElement('div', { style: { fontSize: 12, color: t.textMuted, marginTop: 2 } }, a.desc),
            ),
            React.createElement('span', {
              style: { fontSize: 11, color: t.textMuted, fontFamily: '"DM Mono", monospace', whiteSpace: 'nowrap', flexShrink: 0, marginTop: 2 }
            }, a.time),
          ))
        ),
        React.createElement('div', { style: { padding: '10px 18px', borderTop: `1px solid ${t.borderLight}` } },
          React.createElement(V2Btn, { variant: 'ghost', style: { width: '100%', justifyContent: 'center', fontSize: 12 } }, 'View all activity'),
        ),
      ),
    ),
  );
}

window.V2DashboardPage = V2DashboardPage;
