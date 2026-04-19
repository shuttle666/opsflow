// V2 Customers, Jobs, Team pages

function V2CustomersPage() {
  const t = useT();
  const nav = useV2Nav();
  const [search, setSearch] = React.useState('');
  const [sort, setSort] = React.useState('newest');

  const customers = [
    { name: 'Sarah Jenkins', email: 'sarah@example.com', phone: '(512) 555-0123', jobs: 8, revenue: '$12,400', lastJob: '2 days ago', status: 'ACTIVE' },
    { name: 'Mike Ross', email: 'mike@ross.co', phone: '(512) 555-0456', jobs: 12, revenue: '$24,800', lastJob: 'Today', status: 'ACTIVE' },
    { name: 'Lisa Park', email: 'lisa.park@email.com', phone: '(512) 555-0789', jobs: 3, revenue: '$4,200', lastJob: '1 week ago', status: 'ACTIVE' },
    { name: 'David Kim', email: 'dkim@outlook.com', phone: '(512) 555-0321', jobs: 5, revenue: '$8,100', lastJob: '3 days ago', status: 'ACTIVE' },
    { name: 'Emma Wilson', email: 'emma.w@gmail.com', phone: '(512) 555-0654', jobs: 1, revenue: '$950', lastJob: '2 weeks ago', status: 'ACTIVE' },
    { name: 'James Lee', email: 'jlee@company.io', phone: '(512) 555-0987', jobs: 15, revenue: '$31,200', lastJob: 'Yesterday', status: 'ACTIVE' },
  ];
  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return React.createElement(V2Card, { style: { padding: 0, overflow: 'hidden' } },
    React.createElement('div', {
      style: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderBottom: `1px solid ${t.borderLight}` }
    },
      React.createElement(V2Input, { placeholder: 'Search customers...', value: search, onChange: setSearch, icon: React.createElement(V2SearchIcon), style: { width: 240 } }),
      React.createElement(V2Select, { value: sort, onChange: setSort, options: [
        { value: 'newest', label: 'Newest first' }, { value: 'name_asc', label: 'Name A-Z' }, { value: 'revenue', label: 'Top revenue' },
      ]}),
      React.createElement('span', { style: { fontSize: 12, color: t.textMuted, marginLeft: 'auto' } }, `${filtered.length} customers`),
    ),
    React.createElement(V2Table, {
      columns: [
        { label: 'Customer', key: 'name', render: r => React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
          React.createElement(V2Avatar, { name: r.name, size: 32, ring: true }),
          React.createElement('div', null,
            React.createElement('div', { style: { fontWeight: 600, color: t.text } }, r.name),
            React.createElement('div', { style: { fontSize: 12, color: t.textMuted } }, r.email),
          ),
        )},
        { label: 'Phone', key: 'phone', render: r => React.createElement('span', { style: { fontFamily: '"DM Mono", monospace', fontSize: 12 } }, r.phone) },
        { label: 'Jobs', key: 'jobs', render: r => React.createElement('span', { style: { fontWeight: 600 } }, r.jobs) },
        { label: 'Revenue', key: 'revenue', render: r => React.createElement('span', { style: { fontWeight: 600, color: '#16A34A' } }, r.revenue) },
        { label: 'Last Job', key: 'lastJob' },
        { label: 'Status', key: 'status', render: r => React.createElement(V2Badge, { status: r.status }) },
      ],
      rows: filtered,
      onRowClick: r => nav.openCustomerDetail({ name: r.name, email: r.email, phone: r.phone, totalJobs: r.jobs, totalRevenue: r.revenue }),
    }),
    React.createElement('div', {
      style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', borderTop: `1px solid ${t.borderLight}`, fontSize: 12, color: t.textMuted }
    },
      React.createElement('span', null, `Showing ${filtered.length} of ${customers.length}`),
      React.createElement('div', { style: { display: 'flex', gap: 4 } },
        React.createElement(V2Btn, { disabled: true, style: { height: 28, fontSize: 12 } }, 'Prev'),
        React.createElement(V2Btn, { disabled: true, style: { height: 28, fontSize: 12 } }, 'Next'),
      ),
    ),
  );
}

function V2JobsPage() {
  const t = useT();
  const nav = useV2Nav();
  const [search, setSearch] = React.useState('');
  const [sf, setSf] = React.useState('all');

  const jobs = [
    { title: 'HVAC Maintenance', customer: 'Sarah Jenkins', status: 'SCHEDULED', scheduled: 'Today, 10:00 AM', assignee: 'Mike R.', priority: 'Normal', updated: '2h ago' },
    { title: 'Plumbing Check', customer: 'Mike Ross', status: 'IN_PROGRESS', scheduled: 'Today, 11:30 AM', assignee: 'Tom L.', priority: 'High', updated: '30m ago' },
    { title: 'Electrical Repair', customer: 'Lisa Park', status: 'SCHEDULED', scheduled: 'Today, 2:00 PM', assignee: 'Sarah K.', priority: 'Normal', updated: '1h ago' },
    { title: 'AC Installation', customer: 'David Kim', status: 'NEW', scheduled: 'Tomorrow, 9 AM', assignee: 'Unassigned', priority: 'High', updated: '3h ago' },
    { title: 'Furnace Inspection', customer: 'Emma Wilson', status: 'COMPLETED', scheduled: 'Yesterday', assignee: 'Mike R.', priority: 'Normal', updated: '1d ago' },
    { title: 'Water Heater Replace', customer: 'James Lee', status: 'PENDING_REVIEW', scheduled: 'Yesterday', assignee: 'Tom L.', priority: 'Urgent', updated: '5h ago' },
    { title: 'Duct Cleaning', customer: 'Sarah Jenkins', status: 'CANCELLED', scheduled: 'Last week', assignee: 'Sarah K.', priority: 'Low', updated: '3d ago' },
  ];
  const filtered = jobs.filter(j => {
    const ms = j.title.toLowerCase().includes(search.toLowerCase()) || j.customer.toLowerCase().includes(search.toLowerCase());
    return ms && (sf === 'all' || j.status === sf);
  });

  const priorityColor = p => p === 'Urgent' ? '#DC2626' : p === 'High' ? '#F59E0B' : p === 'Low' ? t.textMuted : t.textSecondary;

  return React.createElement(V2Card, { style: { padding: 0, overflow: 'hidden' } },
    React.createElement('div', {
      style: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderBottom: `1px solid ${t.borderLight}`, flexWrap: 'wrap' }
    },
      React.createElement(V2Input, { placeholder: 'Search jobs...', value: search, onChange: setSearch, icon: React.createElement(V2SearchIcon), style: { width: 220 } }),
      React.createElement(V2Select, { value: sf, onChange: setSf, options: [
        { value: 'all', label: 'All statuses' }, { value: 'NEW', label: 'New' }, { value: 'SCHEDULED', label: 'Scheduled' },
        { value: 'IN_PROGRESS', label: 'In Progress' }, { value: 'PENDING_REVIEW', label: 'Pending Review' },
        { value: 'COMPLETED', label: 'Completed' }, { value: 'CANCELLED', label: 'Cancelled' },
      ]}),
      React.createElement('span', { style: { fontSize: 12, color: t.textMuted, marginLeft: 'auto' } }, `${filtered.length} jobs`),
    ),
    React.createElement(V2Table, {
      columns: [
        { label: 'Job', key: 'title', render: r => React.createElement('span', { style: { color: t.primary, fontWeight: 600, cursor: 'pointer' } }, r.title) },
        { label: 'Customer', key: 'customer' },
        { label: 'Status', key: 'status', render: r => React.createElement(V2Badge, { status: r.status }) },
        { label: 'Priority', key: 'priority', render: r => React.createElement('span', { style: { fontSize: 12, fontWeight: 600, color: priorityColor(r.priority) } }, r.priority) },
        { label: 'Scheduled', key: 'scheduled', render: r => React.createElement('span', { style: { fontFamily: '"DM Mono", monospace', fontSize: 12 } }, r.scheduled) },
        { label: 'Assigned', key: 'assignee', render: r => React.createElement('span', {
          style: { color: r.assignee === 'Unassigned' ? t.accent : undefined, fontWeight: r.assignee === 'Unassigned' ? 600 : 400 }
        }, r.assignee) },
      ],
      rows: filtered,
      onRowClick: r => nav.openJobDetail({ title: r.title, status: r.status, priority: r.priority, customer: { name: r.customer }, assignee: { name: r.assignee } }),
    }),
    React.createElement('div', {
      style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', borderTop: `1px solid ${t.borderLight}`, fontSize: 12, color: t.textMuted }
    },
      React.createElement('span', null, `${filtered.length} total`),
      React.createElement('div', { style: { display: 'flex', gap: 4 } },
        React.createElement(V2Btn, { disabled: true, style: { height: 28, fontSize: 12 } }, 'Prev'),
        React.createElement(V2Btn, { disabled: true, style: { height: 28, fontSize: 12 } }, 'Next'),
      ),
    ),
  );
}

function V2TeamPage() {
  const t = useT();
  const members = [
    { name: 'Alex Chen', email: 'alex@opsflow.com', role: 'Owner', status: 'Online', jobs: 0 },
    { name: 'Mike Rodriguez', email: 'mike.r@opsflow.com', role: 'Staff', status: 'On Job', jobs: 3 },
    { name: 'Tom Lee', email: 'tom.l@opsflow.com', role: 'Staff', status: 'On Job', jobs: 2 },
    { name: 'Sarah Kim', email: 'sarah.k@opsflow.com', role: 'Staff', status: 'Available', jobs: 1 },
    { name: 'Jenny Park', email: 'jenny.p@opsflow.com', role: 'Manager', status: 'Online', jobs: 0 },
    { name: 'Chris Wu', email: 'chris.w@opsflow.com', role: 'Staff', status: 'Off Duty', jobs: 0 },
  ];
  const sc = s => s === 'Online' ? '#16A34A' : s === 'On Job' ? '#F59E0B' : s === 'Available' ? '#0EA5E9' : t.textMuted;

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
    // Quick stats
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 } },
      [
        { l: 'Total', v: '6', c: t.text },
        { l: 'Online', v: '4', c: '#16A34A' },
        { l: 'On Jobs', v: '2', c: '#F59E0B' },
        { l: 'Off Duty', v: '1', c: t.textMuted },
      ].map((s, i) => React.createElement(V2Card, { key: i, style: { padding: '14px 18px' } },
        React.createElement('div', { style: { fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' } }, s.l),
        React.createElement('div', { style: { fontSize: 26, fontWeight: 800, color: s.c, letterSpacing: '-0.04em', marginTop: 4 } }, s.v),
      )),
    ),
    // Members grid
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 } },
      members.map((m, i) => React.createElement(V2Card, { key: i, glow: true, style: { padding: '18px 20px' } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 } },
          React.createElement('div', { style: { position: 'relative' } },
            React.createElement(V2Avatar, { name: m.name, size: 40, ring: true }),
            React.createElement('div', { style: { position: 'absolute', bottom: 0, right: -1, width: 12, height: 12, borderRadius: 6, background: sc(m.status), border: `2.5px solid ${t.surface}` } }),
          ),
          React.createElement('div', null,
            React.createElement('div', { style: { fontSize: 14, fontWeight: 700, color: t.text } }, m.name),
            React.createElement('div', { style: { fontSize: 12, color: t.textMuted } }, m.email),
          ),
        ),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 5 } },
            React.createElement('div', { style: { width: 6, height: 6, borderRadius: 3, background: sc(m.status) } }),
            React.createElement('span', { style: { fontSize: 12, fontWeight: 500, color: t.textSecondary } }, m.status),
          ),
          React.createElement('span', {
            style: {
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
              background: m.role === 'Owner' ? t.primaryMuted : m.role === 'Manager' ? '#8B5CF610' : t.surfaceAlt,
              color: m.role === 'Owner' ? t.primary : m.role === 'Manager' ? '#8B5CF6' : t.textMuted,
            }
          }, m.role),
        ),
        m.jobs > 0 && React.createElement('div', {
          style: { marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.borderLight}`, fontSize: 12, color: t.textSecondary }
        }, `${m.jobs} active job${m.jobs > 1 ? 's' : ''}`),
      )),
    ),
  );
}

Object.assign(window, { V2CustomersPage, V2JobsPage, V2TeamPage });
