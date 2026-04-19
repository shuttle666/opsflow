// Schedule + Agent pages

function SchedulePage() {
  const t = useTheme();
  const [view, setView] = React.useState('week');

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dates = [14, 15, 16, 17, 18, 19, 20];
  const today = 2; // Wed index
  const hours = ['8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM'];

  const events = [
    { day: 0, start: 2, duration: 2, title: 'HVAC — S. Jenkins', assignee: 'Mike R.', color: t.primary },
    { day: 1, start: 1, duration: 1.5, title: 'Plumbing — M. Ross', assignee: 'Tom L.', color: '#B45309' },
    { day: 2, start: 2, duration: 2, title: 'Electrical — L. Park', assignee: 'Sarah K.', color: '#7C3AED' },
    { day: 2, start: 5, duration: 1, title: 'AC Check — D. Kim', assignee: 'Mike R.', color: '#0369A1' },
    { day: 3, start: 0, duration: 3, title: 'Furnace Install — E. Wilson', assignee: 'Tom L.', color: '#15803D' },
    { day: 4, start: 3, duration: 1.5, title: 'Duct Cleaning — J. Lee', assignee: 'Sarah K.', color: '#C2410C' },
  ];

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
        React.createElement(Button, { variant: view === 'week' ? 'primary' : undefined, onClick: () => setView('week'), style: { height: 32, fontSize: 12 } }, 'Week'),
        React.createElement(Button, { variant: view === 'day' ? 'primary' : undefined, onClick: () => setView('day'), style: { height: 32, fontSize: 12 } }, 'Day'),
      ),
      React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: t.text } }, 'Apr 14 – 20, 2026'),
    ),

    React.createElement(Card, { style: { padding: 0, overflow: 'hidden' } },
      // Day headers
      React.createElement('div', {
        style: { display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', borderBottom: `1px solid ${t.border}` }
      },
        React.createElement('div', { style: { padding: 12 } }),
        ...days.map((d, i) => React.createElement('div', {
          key: d,
          style: {
            padding: '10px 8px', textAlign: 'center', fontSize: 12, fontWeight: 600,
            color: i === today ? t.primary : t.textSecondary,
            borderLeft: `1px solid ${t.borderLight}`,
          }
        },
          React.createElement('div', null, d),
          React.createElement('div', {
            style: {
              width: 28, height: 28, borderRadius: 14, margin: '4px auto 0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700,
              background: i === today ? t.primary : 'transparent',
              color: i === today ? '#fff' : t.text,
            }
          }, dates[i]),
        )),
      ),

      // Time grid
      React.createElement('div', {
        style: { display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', position: 'relative' }
      },
        // Time labels
        ...hours.map((h, hi) => React.createElement(React.Fragment, { key: h },
          React.createElement('div', {
            style: { padding: '0 8px', height: 56, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', fontSize: 11, color: t.textMuted, fontFamily: '"DM Mono", monospace', paddingTop: 2 }
          }, h),
          ...Array(7).fill(null).map((_, di) => React.createElement('div', {
            key: di,
            style: {
              height: 56, borderLeft: `1px solid ${t.borderLight}`,
              borderBottom: hi < hours.length - 1 ? `1px solid ${t.borderLight}` : 'none',
              position: 'relative',
            }
          },
            events.filter(e => e.day === di && e.start === hi).map((ev, ei) =>
              React.createElement('div', {
                key: ei,
                style: {
                  position: 'absolute', top: 2, left: 3, right: 3,
                  height: ev.duration * 56 - 4, borderRadius: 6,
                  background: ev.color + '14', border: `1px solid ${ev.color}40`,
                  borderLeft: `3px solid ${ev.color}`,
                  padding: '4px 8px', overflow: 'hidden', fontSize: 11, zIndex: 5, cursor: 'pointer',
                }
              },
                React.createElement('div', { style: { fontWeight: 600, color: ev.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, ev.title),
                ev.duration >= 1.5 && React.createElement('div', { style: { fontSize: 10, color: t.textMuted, marginTop: 2 } }, ev.assignee),
              )
            ),
          )),
        )),
      ),
    ),
  );
}

function AgentPage() {
  const t = useTheme();
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState([
    { role: 'assistant', text: "Hi! I'm the OpsFlow AI Planner. I can help you optimize job scheduling, assign crew members, and plan routes. What would you like help with?" },
  ]);

  const send = () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', text: input };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setTimeout(() => {
      setMessages(m => [...m, { role: 'assistant', text: "I'll analyze the current workload and suggest an optimal schedule. Based on crew availability and job locations, here's what I recommend:\n\n• Move the AC Installation to 9 AM (closer to Mike's previous location)\n• Assign the Duct Cleaning to Sarah — she'll be free by 2 PM\n• Keep Tom on the Furnace Install since he's already on-site" }]);
    }, 800);
  };

  return React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)', gap: 0 }
  },
    React.createElement(Card, {
      style: { flex: 1, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }
    },
      // Messages
      React.createElement('div', { style: { flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 } },
        messages.map((m, i) => React.createElement('div', {
          key: i,
          style: {
            display: 'flex', gap: 10,
            flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
          }
        },
          m.role === 'assistant' && React.createElement('div', {
            style: {
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: `linear-gradient(135deg, ${t.primary}, ${t.primaryHover})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 13, fontWeight: 700,
            }
          }, 'AI'),
          React.createElement('div', {
            style: {
              maxWidth: '70%', padding: '10px 14px', borderRadius: 10,
              background: m.role === 'user' ? t.primary : t.surfaceAlt,
              color: m.role === 'user' ? '#fff' : t.text,
              fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap',
            }
          }, m.text),
        )),
      ),

      // Input
      React.createElement('div', {
        style: { padding: '12px 16px', borderTop: `1px solid ${t.border}`, display: 'flex', gap: 10 }
      },
        React.createElement('input', {
          value: input,
          onChange: e => setInput(e.target.value),
          onKeyDown: e => e.key === 'Enter' && send(),
          placeholder: 'Ask the AI Planner...',
          style: {
            flex: 1, height: 40, borderRadius: 8, border: `1px solid ${t.border}`,
            background: t.surface, padding: '0 14px', fontSize: 13, color: t.text, outline: 'none',
          },
        }),
        React.createElement(Button, { variant: 'primary', onClick: send }, 'Send'),
      ),
    ),
  );
}

window.SchedulePage = SchedulePage;
window.AgentPage = AgentPage;
