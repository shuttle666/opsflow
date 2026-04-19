// Dashboard Page

function DashboardPage() {
  const t = useTheme();

  const stats = [
    { label: 'Active Jobs', value: '24', icon: '📋', trend: 8, trendLabel: '+3 new today', color: t.primary },
    { label: 'Revenue', value: '$48.2k', icon: '💰', trend: 12, trendLabel: '+12% vs last month', color: '#15803D' },
    { label: 'Avg. Time', value: '2h 15m', icon: '⏱', trend: -5, trendLabel: '5% faster', color: '#B45309' },
    { label: 'Active Crew', value: '12/15', icon: '👥', trend: 0, trendLabel: 'All deployed', color: '#7C3AED' },
  ];

  const schedule = [
    { id: 1, customer: 'Sarah Jenkins', address: '12 Ridge Rd, Austin', type: 'HVAC Maintenance', status: 'SCHEDULED', time: '10:00 AM', assignee: 'Mike R.' },
    { id: 2, customer: 'Mike Ross', address: '8805 Bee Caves Rd', type: 'Plumbing Check', status: 'IN_PROGRESS', time: '11:30 AM', assignee: 'Tom L.' },
    { id: 3, customer: 'Lisa Park', address: '221 Congress Ave', type: 'Electrical Repair', status: 'SCHEDULED', time: '2:00 PM', assignee: 'Sarah K.' },
    { id: 4, customer: 'David Kim', address: '45 Lamar Blvd', type: 'AC Installation', status: 'NEW', time: '4:30 PM', assignee: 'Unassigned' },
  ];

  const activities = [
    { id: 1, title: 'Job #2045 completed', desc: 'by Mike Ross', time: '2m ago', color: '#15803D' },
    { id: 2, title: 'New invoice sent', desc: 'to Sarah Jenkins — $1,240', time: '15m ago', color: t.primary },
    { id: 3, title: 'New job request', desc: 'from Alex Chen', time: '1h ago', color: '#B45309' },
    { id: 4, title: 'Staff check-in', desc: 'Tom Lee clocked in', time: '2h ago', color: '#7C3AED' },
  ];

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
    // Stats
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 } },
      stats.map((s, i) => React.createElement(StatCard, { key: i, ...s }))
    ),

    // Main content
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 } },
      // Today's Schedule
      React.createElement(Card, { style: { padding: 0, overflow: 'hidden' } },
        React.createElement('div', {
          style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${t.borderLight}` }
        },
          React.createElement('h2', { style: { fontSize: 15, fontWeight: 700, color: t.text, margin: 0 } }, "Today's Schedule"),
          React.createElement(Button, { variant: 'ghost' }, 'View All'),
        ),
        React.createElement(DataTable, {
          columns: [
            { label: 'Customer', key: 'customer', render: r => React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
              React.createElement(Avatar, { name: r.customer, size: 30 }),
              React.createElement('div', null,
                React.createElement('div', { style: { fontWeight: 600 } }, r.customer),
                React.createElement('div', { style: { fontSize: 11, color: t.textMuted } }, r.address),
              )
            )},
            { label: 'Job Type', key: 'type' },
            { label: 'Status', key: 'status', render: r => React.createElement(Badge, { status: r.status }) },
            { label: 'Time', key: 'time', render: r => React.createElement('span', { style: { fontFamily: '"DM Mono", monospace', fontSize: 12, color: t.textSecondary } }, r.time) },
            { label: 'Assigned', key: 'assignee' },
          ],
          rows: schedule,
        }),
      ),

      // Recent Activity
      React.createElement(Card, { style: { padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' } },
        React.createElement('div', {
          style: { padding: '16px 20px', borderBottom: `1px solid ${t.borderLight}` }
        },
          React.createElement('h2', { style: { fontSize: 15, fontWeight: 700, color: t.text, margin: 0 } }, 'Recent Activity'),
        ),
        React.createElement('div', { style: { flex: 1, padding: '8px 12px' } },
          activities.map(a => React.createElement('div', {
            key: a.id,
            style: {
              display: 'flex', gap: 12, padding: '12px 8px', borderRadius: 8,
              cursor: 'pointer', transition: 'background 0.1s',
            },
            onMouseEnter: e => e.currentTarget.style.background = t.surfaceHover,
            onMouseLeave: e => e.currentTarget.style.background = 'transparent',
          },
            React.createElement('div', {
              style: {
                width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0,
                background: a.color,
              }
            }),
            React.createElement('div', { style: { flex: 1, minWidth: 0 } },
              React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: t.text } }, a.title),
              React.createElement('div', { style: { fontSize: 12, color: t.textSecondary, marginTop: 2 } }, a.desc),
            ),
            React.createElement('span', { style: { fontSize: 11, color: t.textMuted, fontFamily: '"DM Mono", monospace', whiteSpace: 'nowrap', flexShrink: 0 } }, a.time),
          ))
        ),
        React.createElement('div', { style: { padding: '12px 20px', borderTop: `1px solid ${t.borderLight}` } },
          React.createElement(Button, { variant: 'ghost', style: { width: '100%', justifyContent: 'center' } }, 'View All Activity'),
        ),
      ),
    ),
  );
}

window.DashboardPage = DashboardPage;
