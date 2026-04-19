// Customers, Jobs, Team pages

function CustomersPage() {
  const t = useTheme();
  const [search, setSearch] = React.useState('');
  const [sort, setSort] = React.useState('newest');

  const customers = [
    { name: 'Sarah Jenkins', email: 'sarah@example.com', phone: '(512) 555-0123', jobs: 8, lastJob: '2 days ago', status: 'ACTIVE' },
    { name: 'Mike Ross', email: 'mike@ross.co', phone: '(512) 555-0456', jobs: 12, lastJob: 'Today', status: 'ACTIVE' },
    { name: 'Lisa Park', email: 'lisa.park@email.com', phone: '(512) 555-0789', jobs: 3, lastJob: '1 week ago', status: 'ACTIVE' },
    { name: 'David Kim', email: 'dkim@outlook.com', phone: '(512) 555-0321', jobs: 5, lastJob: '3 days ago', status: 'ACTIVE' },
    { name: 'Emma Wilson', email: 'emma.w@gmail.com', phone: '(512) 555-0654', jobs: 1, lastJob: '2 weeks ago', status: 'ACTIVE' },
    { name: 'James Lee', email: 'jlee@company.io', phone: '(512) 555-0987', jobs: 15, lastJob: 'Yesterday', status: 'ACTIVE' },
  ];

  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
    React.createElement(Card, { style: { padding: 0, overflow: 'hidden' } },
      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: `1px solid ${t.borderLight}` }
      },
        React.createElement(Input, { placeholder: 'Search customers...', value: search, onChange: setSearch, icon: React.createElement(SearchIcon), style: { width: 260 } }),
        React.createElement(Select, {
          value: sort, onChange: setSort,
          options: [
            { value: 'newest', label: 'Newest first' },
            { value: 'name_asc', label: 'Name A-Z' },
            { value: 'name_desc', label: 'Name Z-A' },
          ]
        }),
        React.createElement('span', { style: { fontSize: 13, color: t.textMuted, marginLeft: 'auto' } }, `${filtered.length} customers`),
      ),
      React.createElement(DataTable, {
        columns: [
          { label: 'Name', key: 'name', render: r => React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
            React.createElement(Avatar, { name: r.name, size: 32 }),
            React.createElement('div', null,
              React.createElement('div', { style: { fontWeight: 600 } }, r.name),
              React.createElement('div', { style: { fontSize: 12, color: t.textMuted } }, r.email),
            ),
          )},
          { label: 'Phone', key: 'phone' },
          { label: 'Jobs', key: 'jobs', render: r => React.createElement('span', { style: { fontFamily: '"DM Mono", monospace' } }, r.jobs) },
          { label: 'Last Job', key: 'lastJob' },
          { label: 'Status', key: 'status', render: r => React.createElement(Badge, { status: r.status }) },
        ],
        rows: filtered,
      }),
      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: `1px solid ${t.borderLight}`, fontSize: 13, color: t.textSecondary }
      },
        React.createElement('span', null, 'Page 1 of 1'),
        React.createElement('div', { style: { display: 'flex', gap: 6 } },
          React.createElement(Button, { disabled: true }, 'Previous'),
          React.createElement(Button, { disabled: true }, 'Next'),
        ),
      ),
    ),
  );
}

function JobsPage() {
  const t = useTheme();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');

  const jobs = [
    { title: 'HVAC Maintenance', customer: 'Sarah Jenkins', status: 'SCHEDULED', scheduled: 'Today, 10:00 AM', assignee: 'Mike R.', updated: '2h ago' },
    { title: 'Plumbing Check', customer: 'Mike Ross', status: 'IN_PROGRESS', scheduled: 'Today, 11:30 AM', assignee: 'Tom L.', updated: '30m ago' },
    { title: 'Electrical Repair', customer: 'Lisa Park', status: 'SCHEDULED', scheduled: 'Today, 2:00 PM', assignee: 'Sarah K.', updated: '1h ago' },
    { title: 'AC Installation', customer: 'David Kim', status: 'NEW', scheduled: 'Tomorrow, 9:00 AM', assignee: 'Unassigned', updated: '3h ago' },
    { title: 'Furnace Inspection', customer: 'Emma Wilson', status: 'COMPLETED', scheduled: 'Yesterday', assignee: 'Mike R.', updated: '1 day ago' },
    { title: 'Water Heater Replace', customer: 'James Lee', status: 'PENDING_REVIEW', scheduled: 'Yesterday', assignee: 'Tom L.', updated: '5h ago' },
    { title: 'Duct Cleaning', customer: 'Sarah Jenkins', status: 'CANCELLED', scheduled: 'Last week', assignee: 'Sarah K.', updated: '3 days ago' },
  ];

  const filtered = jobs.filter(j => {
    const matchSearch = j.title.toLowerCase().includes(search.toLowerCase()) || j.customer.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || j.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
    React.createElement(Card, { style: { padding: 0, overflow: 'hidden' } },
      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: `1px solid ${t.borderLight}`, flexWrap: 'wrap' }
      },
        React.createElement(Input, { placeholder: 'Search jobs...', value: search, onChange: setSearch, icon: React.createElement(SearchIcon), style: { width: 240 } }),
        React.createElement(Select, {
          value: statusFilter, onChange: setStatusFilter,
          options: [
            { value: 'all', label: 'All statuses' },
            { value: 'NEW', label: 'New' },
            { value: 'SCHEDULED', label: 'Scheduled' },
            { value: 'IN_PROGRESS', label: 'In Progress' },
            { value: 'PENDING_REVIEW', label: 'Pending Review' },
            { value: 'COMPLETED', label: 'Completed' },
            { value: 'CANCELLED', label: 'Cancelled' },
          ]
        }),
        React.createElement('span', { style: { fontSize: 13, color: t.textMuted, marginLeft: 'auto' } }, `${filtered.length} jobs`),
      ),
      React.createElement(DataTable, {
        columns: [
          { label: 'Title', key: 'title', render: r => React.createElement('span', { style: { color: t.primary, cursor: 'pointer' } }, r.title) },
          { label: 'Customer', key: 'customer' },
          { label: 'Status', key: 'status', render: r => React.createElement(Badge, { status: r.status }) },
          { label: 'Scheduled', key: 'scheduled', render: r => React.createElement('span', { style: { fontFamily: '"DM Mono", monospace', fontSize: 12 } }, r.scheduled) },
          { label: 'Assigned', key: 'assignee' },
          { label: 'Updated', key: 'updated', render: r => React.createElement('span', { style: { fontSize: 12, color: t.textMuted } }, r.updated) },
        ],
        rows: filtered,
      }),
      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: `1px solid ${t.borderLight}`, fontSize: 13, color: t.textSecondary }
      },
        React.createElement('span', null, `Total ${filtered.length}`),
        React.createElement('div', { style: { display: 'flex', gap: 6 } },
          React.createElement(Button, { disabled: true }, 'Previous'),
          React.createElement(Button, { disabled: true }, 'Next'),
        ),
      ),
    ),
  );
}

function TeamPage() {
  const t = useTheme();

  const members = [
    { name: 'Alex Chen', email: 'alex@opsflow.com', role: 'Owner', status: 'Online', jobs: 0 },
    { name: 'Mike Rodriguez', email: 'mike.r@opsflow.com', role: 'Staff', status: 'On Job', jobs: 3 },
    { name: 'Tom Lee', email: 'tom.l@opsflow.com', role: 'Staff', status: 'On Job', jobs: 2 },
    { name: 'Sarah Kim', email: 'sarah.k@opsflow.com', role: 'Staff', status: 'Available', jobs: 1 },
    { name: 'Jenny Park', email: 'jenny.p@opsflow.com', role: 'Manager', status: 'Online', jobs: 0 },
    { name: 'Chris Wu', email: 'chris.w@opsflow.com', role: 'Staff', status: 'Off Duty', jobs: 0 },
  ];

  const statusColor = s => s === 'Online' ? '#15803D' : s === 'On Job' ? '#B45309' : s === 'Available' ? '#0369A1' : t.textMuted;

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
    // Stats row
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 } },
      React.createElement(Card, { style: { padding: '16px 20px' } },
        React.createElement('div', { style: { fontSize: 12, color: t.textMuted, fontWeight: 500, marginBottom: 4 } }, 'Total Members'),
        React.createElement('div', { style: { fontSize: 24, fontWeight: 700, fontFamily: '"DM Mono", monospace' } }, '6'),
      ),
      React.createElement(Card, { style: { padding: '16px 20px' } },
        React.createElement('div', { style: { fontSize: 12, color: t.textMuted, fontWeight: 500, marginBottom: 4 } }, 'Active Now'),
        React.createElement('div', { style: { fontSize: 24, fontWeight: 700, fontFamily: '"DM Mono", monospace', color: '#15803D' } }, '4'),
      ),
      React.createElement(Card, { style: { padding: '16px 20px' } },
        React.createElement('div', { style: { fontSize: 12, color: t.textMuted, fontWeight: 500, marginBottom: 4 } }, 'On Jobs'),
        React.createElement('div', { style: { fontSize: 24, fontWeight: 700, fontFamily: '"DM Mono", monospace', color: '#B45309' } }, '2'),
      ),
    ),

    React.createElement(Card, { style: { padding: 0, overflow: 'hidden' } },
      React.createElement(DataTable, {
        columns: [
          { label: 'Member', key: 'name', render: r => React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
            React.createElement('div', { style: { position: 'relative' } },
              React.createElement(Avatar, { name: r.name, size: 34 }),
              React.createElement('div', { style: { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, background: statusColor(r.status), border: `2px solid ${t.surface}` } }),
            ),
            React.createElement('div', null,
              React.createElement('div', { style: { fontWeight: 600 } }, r.name),
              React.createElement('div', { style: { fontSize: 12, color: t.textMuted } }, r.email),
            ),
          )},
          { label: 'Role', key: 'role', render: r => React.createElement('span', { style: { fontSize: 12, fontWeight: 600, color: r.role === 'Owner' ? t.primary : r.role === 'Manager' ? '#7C3AED' : t.textSecondary } }, r.role) },
          { label: 'Status', key: 'status', render: r => React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
            React.createElement('div', { style: { width: 6, height: 6, borderRadius: 3, background: statusColor(r.status) } }),
            React.createElement('span', null, r.status),
          )},
          { label: 'Active Jobs', key: 'jobs', render: r => React.createElement('span', { style: { fontFamily: '"DM Mono", monospace' } }, r.jobs) },
        ],
        rows: members,
      }),
    ),
  );
}

window.CustomersPage = CustomersPage;
window.JobsPage = JobsPage;
window.TeamPage = TeamPage;
