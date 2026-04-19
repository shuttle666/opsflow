// V2 Detail Pages — Job Detail, Customer Detail

// -- Shared detail layout helpers --

function DetailSection({ label, children, style }) {
  const t = useT();
  return React.createElement('div', { style: { marginBottom: 0, ...style } },
    label && React.createElement('div', {
      style: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: t.textMuted, marginBottom: 10 }
    }, label),
    children,
  );
}

function InfoRow({ label, value, color, mono }) {
  const t = useT();
  return React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${t.borderLight}` } },
    React.createElement('span', { style: { fontSize: 13, color: t.textSecondary } }, label),
    React.createElement('span', { style: { fontSize: 13, fontWeight: 600, color: color || t.text, fontFamily: mono ? '"DM Mono", monospace' : 'inherit' } }, value || '—'),
  );
}

function TimelineStep({ label, time, desc, state, isLast, status }) {
  const t = useT();
  const colors = {
    completed: { dot: '#16A34A', line: '#BBF7D0', bg: '#F0FDF4' },
    current: { dot: t.primary, line: t.primary + '30', bg: t.primaryLight },
    upcoming: { dot: t.border, line: t.borderLight, bg: t.surfaceAlt },
    cancelled: { dot: '#DC2626', line: '#FECACA', bg: '#FEF2F2' },
  };
  const c = colors[status === 'CANCELLED' ? 'cancelled' : state] || colors.upcoming;

  return React.createElement('div', { style: { display: 'flex', gap: 14 } },
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 } },
      React.createElement('div', {
        style: {
          width: 32, height: 32, borderRadius: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: c.bg, border: `2px solid ${c.dot}`, position: 'relative',
        }
      },
        state === 'completed' && React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: c.dot, strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' },
          React.createElement('path', { d: 'M20 6L9 17l-5-5' })),
        state === 'current' && React.createElement('div', { style: { width: 10, height: 10, borderRadius: 5, background: c.dot } }),
        state === 'upcoming' && React.createElement('div', { style: { width: 8, height: 8, borderRadius: 4, background: c.dot } }),
      ),
      !isLast && React.createElement('div', { style: { width: 2, flex: 1, minHeight: 24, background: c.line, marginTop: 4 } }),
    ),
    React.createElement('div', { style: { flex: 1, paddingBottom: isLast ? 0 : 20 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 } },
        React.createElement('span', { style: { fontSize: 13, fontWeight: 700, color: state === 'upcoming' ? t.textMuted : t.text } }, label),
        React.createElement('span', { style: { fontSize: 11, color: t.textMuted, fontFamily: '"DM Mono", monospace' } }, time || 'Pending'),
      ),
      desc && React.createElement('div', { style: { fontSize: 12, color: t.textSecondary, marginTop: 4, lineHeight: 1.5 } }, desc),
    ),
  );
}

// -- Job Detail Page --

function V2JobDetailPage({ job: jobProp, onBack }) {
  const t = useT();

  const jobDefaults = {
    id: 'j-2045',
    title: 'HVAC Maintenance',
    description: 'Annual maintenance check for central HVAC system. Replace filters, check refrigerant levels, inspect ductwork, and test thermostat calibration.',
    status: 'IN_PROGRESS',
    priority: 'High',
    customer: { name: 'Sarah Jenkins', phone: '(512) 555-0123', email: 'sarah@example.com', address: '12 Ridge Rd, Austin, TX 78701' },
    assignee: { name: 'Mike Rodriguez', email: 'mike.r@opsflow.com', role: 'Staff' },
    scheduledStart: 'Apr 19, 2026 — 10:00 AM',
    scheduledEnd: 'Apr 19, 2026 — 12:00 PM',
    createdAt: 'Apr 17, 2026 — 3:15 PM',
    createdBy: 'Alex Chen',
  };
  const job = { ...jobDefaults, ...jobProp, customer: { ...jobDefaults.customer, ...(jobProp?.customer || {}) }, assignee: { ...jobDefaults.assignee, ...(jobProp?.assignee || {}) } };

  const timeline = [
    { label: 'New', time: 'Apr 17, 3:15 PM', desc: 'Job created by Alex Chen.', state: 'completed' },
    { label: 'Scheduled', time: 'Apr 17, 4:00 PM', desc: 'Visit window set, Mike Rodriguez assigned.', state: 'completed' },
    { label: 'In Progress', time: 'Apr 19, 10:05 AM', desc: 'Mike Rodriguez started field work.', state: 'current' },
    { label: 'Pending Review', time: null, desc: null, state: 'upcoming' },
    { label: 'Completed', time: null, desc: null, state: 'upcoming' },
  ];

  const evidence = [
    { name: 'site-photo-1.jpg', type: 'Site Photo', size: '2.4 MB', time: '10:12 AM', by: 'Mike R.' },
    { name: 'filter-replaced.jpg', type: 'Completion Proof', size: '1.8 MB', time: '11:30 AM', by: 'Mike R.' },
  ];

  const activity = [
    { text: 'Mike Rodriguez started work', time: '10:05 AM', color: '#F59E0B' },
    { text: 'Site photo uploaded', time: '10:12 AM', color: t.primary },
    { text: 'Filter replacement documented', time: '11:30 AM', color: '#16A34A' },
  ];

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 20 } },
    // Back + header
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
      React.createElement('button', {
        onClick: onBack,
        style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface, cursor: 'pointer', color: t.textSecondary },
      }, React.createElement(V2ChevronIcon, { dir: 'left' })),
      React.createElement('div', { style: { flex: 1 } },
        React.createElement('div', { style: { fontSize: 12, color: t.textMuted, marginBottom: 2 } }, 'Job #2045'),
        React.createElement('div', { style: { fontSize: 20, fontWeight: 800, color: t.text, letterSpacing: '-0.03em' } }, job.title),
      ),
      React.createElement('div', { style: { display: 'flex', gap: 8 } },
        React.createElement(V2Badge, { status: job.status }),
        React.createElement(V2Btn, { variant: 'primary' }, 'Edit Job'),
      ),
    ),

    // Main 2-col layout
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' } },
      // Left column
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
        // Overview cards row
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 } },
          [
            { l: 'Status', v: job.status.replace(/_/g, ' '), c: statusColors2[job.status]?.text },
            { l: 'Priority', v: job.priority, c: job.priority === 'High' ? '#F59E0B' : t.text },
            { l: 'Assigned', v: job.assignee?.name || 'Unassigned', c: job.assignee ? t.text : t.accent },
          ].map((s, i) => React.createElement(V2Card, { key: i, style: { padding: '14px 18px' } },
            React.createElement('div', { style: { fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' } }, s.l),
            React.createElement('div', { style: { fontSize: 16, fontWeight: 700, color: s.c, marginTop: 4 } }, s.v),
          )),
        ),

        // Description
        React.createElement(V2Card, { style: { padding: '20px 22px' } },
          React.createElement(DetailSection, { label: 'Description' },
            React.createElement('p', { style: { fontSize: 13, lineHeight: 1.7, color: t.textSecondary } }, job.description),
          ),
        ),

        // Schedule + Customer info
        React.createElement(V2Card, { style: { padding: '20px 22px' } },
          React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 } },
            React.createElement(DetailSection, { label: 'Schedule' },
              React.createElement(InfoRow, { label: 'Start', value: job.scheduledStart, mono: true }),
              React.createElement(InfoRow, { label: 'End', value: job.scheduledEnd, mono: true }),
              React.createElement(InfoRow, { label: 'Created', value: job.createdAt, mono: true }),
            ),
            React.createElement(DetailSection, { label: 'Customer' },
              React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 } },
                React.createElement(V2Avatar, { name: job.customer.name, size: 36, ring: true }),
                React.createElement('div', null,
                  React.createElement('div', { style: { fontSize: 14, fontWeight: 700, color: t.text } }, job.customer.name),
                  React.createElement('div', { style: { fontSize: 12, color: t.textMuted } }, job.customer.email),
                ),
              ),
              React.createElement(InfoRow, { label: 'Phone', value: job.customer.phone }),
              React.createElement(InfoRow, { label: 'Address', value: job.customer.address }),
            ),
          ),
        ),

        // Workflow timeline
        React.createElement(V2Card, { style: { padding: '20px 22px' } },
          React.createElement(DetailSection, { label: 'Job Lifecycle' },
            React.createElement('div', { style: { marginTop: 4 } },
              timeline.map((step, i) => React.createElement(TimelineStep, {
                key: i, ...step, isLast: i === timeline.length - 1, status: step.label === 'Cancelled' ? 'CANCELLED' : undefined,
              })),
            ),
          ),
          // Transition actions
          React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${t.borderLight}` } },
            React.createElement(V2Btn, { variant: 'primary' }, 'Send to Review'),
            React.createElement(V2Btn, null, 'Cancel Job'),
          ),
        ),
      ),

      // Right sidebar
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
        // Assignment card
        React.createElement(V2Card, { style: { padding: '18px 20px' } },
          React.createElement(DetailSection, { label: 'Assignment' },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 } },
              React.createElement(V2Avatar, { name: job.assignee.name, size: 40, ring: true }),
              React.createElement('div', null,
                React.createElement('div', { style: { fontSize: 14, fontWeight: 700, color: t.text } }, job.assignee.name),
                React.createElement('div', { style: { fontSize: 12, color: t.textMuted } }, job.assignee.email),
                React.createElement('span', {
                  style: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: t.surfaceAlt, color: t.textMuted, marginTop: 4, display: 'inline-block' }
                }, job.assignee.role),
              ),
            ),
            React.createElement(V2Btn, { style: { width: '100%' } }, 'Reassign'),
          ),
        ),

        // Evidence / Attachments
        React.createElement(V2Card, { style: { padding: '18px 20px' } },
          React.createElement(DetailSection, { label: 'Evidence & Attachments' },
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
              evidence.map((e, i) => React.createElement('div', {
                key: i,
                style: {
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8,
                  border: `1px solid ${t.borderLight}`, cursor: 'pointer', transition: 'all 0.12s',
                },
                onMouseEnter: ev => { ev.currentTarget.style.borderColor = t.primary + '40'; ev.currentTarget.style.background = t.surfaceHover; },
                onMouseLeave: ev => { ev.currentTarget.style.borderColor = t.borderLight; ev.currentTarget.style.background = 'transparent'; },
              },
                React.createElement('div', {
                  style: { width: 36, height: 36, borderRadius: 8, background: t.primaryMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.primary, fontSize: 14, flexShrink: 0 }
                }, '📎'),
                React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                  React.createElement('div', { style: { fontSize: 12, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, e.name),
                  React.createElement('div', { style: { fontSize: 11, color: t.textMuted } }, `${e.type} · ${e.size}`),
                ),
              )),
              React.createElement(V2Btn, { variant: 'ghost', style: { width: '100%', justifyContent: 'center', marginTop: 4 } }, React.createElement(V2PlusIcon), 'Upload Evidence'),
            ),
          ),
        ),

        // Recent activity
        React.createElement(V2Card, { style: { padding: '18px 20px' } },
          React.createElement(DetailSection, { label: 'Activity' },
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
              activity.map((a, i) => React.createElement('div', { key: i, style: { display: 'flex', gap: 10, alignItems: 'flex-start' } },
                React.createElement('div', { style: { width: 6, height: 6, borderRadius: 3, background: a.color, marginTop: 6, flexShrink: 0 } }),
                React.createElement('div', { style: { flex: 1 } },
                  React.createElement('div', { style: { fontSize: 12, color: t.text } }, a.text),
                  React.createElement('div', { style: { fontSize: 11, color: t.textMuted, fontFamily: '"DM Mono", monospace' } }, a.time),
                ),
              )),
            ),
          ),
        ),
      ),
    ),
  );
}

// -- Customer Detail Page --

function V2CustomerDetailPage({ customer: custProp, onBack }) {
  const t = useT();

  const cDefaults = {
    name: 'Sarah Jenkins',
    email: 'sarah@example.com',
    phone: '(512) 555-0123',
    address: '12 Ridge Rd, Austin, TX 78701',
    notes: 'Prefers morning appointments. Has two dogs — ring doorbell and wait. Gate code: 4521.',
    totalJobs: 8,
    totalRevenue: '$12,400',
    since: 'Jan 2025',
  };
  const c = { ...cDefaults, ...custProp };

  const jobs = [
    { title: 'HVAC Maintenance', status: 'IN_PROGRESS', scheduled: 'Today, 10:00 AM', assignee: 'Mike R.' },
    { title: 'Duct Cleaning', status: 'CANCELLED', scheduled: 'Last week', assignee: 'Sarah K.' },
    { title: 'AC Inspection', status: 'COMPLETED', scheduled: 'Mar 15, 2026', assignee: 'Tom L.' },
    { title: 'Furnace Tune-Up', status: 'COMPLETED', scheduled: 'Jan 20, 2026', assignee: 'Mike R.' },
    { title: 'Plumbing Fix', status: 'COMPLETED', scheduled: 'Dec 5, 2025', assignee: 'Tom L.' },
  ];

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 20 } },
    // Back + header
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 14 } },
      React.createElement('button', {
        onClick: onBack,
        style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface, cursor: 'pointer', color: t.textSecondary },
      }, React.createElement(V2ChevronIcon, { dir: 'left' })),
      React.createElement(V2Avatar, { name: c.name, size: 44, ring: true }),
      React.createElement('div', { style: { flex: 1 } },
        React.createElement('div', { style: { fontSize: 20, fontWeight: 800, color: t.text, letterSpacing: '-0.03em' } }, c.name),
        React.createElement('div', { style: { fontSize: 13, color: t.textMuted } }, c.email),
      ),
      React.createElement('div', { style: { display: 'flex', gap: 8 } },
        React.createElement(V2Btn, null, 'Create Job'),
        React.createElement(V2Btn, { variant: 'primary' }, 'Edit Customer'),
      ),
    ),

    // Stats row
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 } },
      [
        { l: 'Total Jobs', v: c.totalJobs, c: t.primary },
        { l: 'Revenue', v: c.totalRevenue, c: '#16A34A' },
        { l: 'Customer Since', v: c.since, c: t.text },
      ].map((s, i) => React.createElement(V2Card, { key: i, style: { padding: '14px 18px' } },
        React.createElement('div', { style: { fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' } }, s.l),
        React.createElement('div', { style: { fontSize: 22, fontWeight: 800, color: s.c, letterSpacing: '-0.03em', marginTop: 4 } }, s.v),
      )),
    ),

    // 2-col layout
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' } },
      // Left — jobs
      React.createElement(V2Card, { style: { padding: 0, overflow: 'hidden' } },
        React.createElement('div', {
          style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${t.borderLight}` }
        },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            React.createElement('h3', { style: { fontSize: 15, fontWeight: 700, color: t.text, margin: 0 } }, 'Job History'),
            React.createElement('span', { style: { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: t.primaryMuted, color: t.primary } }, jobs.length),
          ),
          React.createElement(V2Btn, { variant: 'ghost' }, 'View all'),
        ),
        React.createElement(V2Table, {
          columns: [
            { label: 'Job', key: 'title', render: r => React.createElement('span', { style: { color: t.primary, fontWeight: 600, cursor: 'pointer' } }, r.title) },
            { label: 'Status', key: 'status', render: r => React.createElement(V2Badge, { status: r.status }) },
            { label: 'Scheduled', key: 'scheduled', render: r => React.createElement('span', { style: { fontFamily: '"DM Mono", monospace', fontSize: 12 } }, r.scheduled) },
            { label: 'Assigned', key: 'assignee' },
          ],
          rows: jobs,
        }),
      ),

      // Right sidebar
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
        // Contact info
        React.createElement(V2Card, { style: { padding: '18px 20px' } },
          React.createElement(DetailSection, { label: 'Contact Information' },
            React.createElement(InfoRow, { label: 'Phone', value: c.phone }),
            React.createElement(InfoRow, { label: 'Email', value: c.email }),
            React.createElement(InfoRow, { label: 'Address', value: c.address }),
          ),
        ),

        // Notes
        React.createElement(V2Card, { style: { padding: '18px 20px' } },
          React.createElement(DetailSection, { label: 'Internal Notes' },
            React.createElement('p', { style: { fontSize: 13, lineHeight: 1.7, color: t.textSecondary, whiteSpace: 'pre-wrap' } }, c.notes),
            React.createElement(V2Btn, { variant: 'ghost', style: { marginTop: 10 } }, 'Edit Notes'),
          ),
        ),
      ),
    ),
  );
}

Object.assign(window, { V2JobDetailPage, V2CustomerDetailPage, DetailSection, InfoRow, TimelineStep });
