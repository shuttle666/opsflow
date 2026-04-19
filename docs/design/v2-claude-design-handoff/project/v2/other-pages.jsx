// V2 Schedule + Agent pages

function V2SchedulePage() {
  const t = useT();
  const [view, setView] = React.useState('week');
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dates = [14, 15, 16, 17, 18, 19, 20];
  const todayIdx = 2;
  const hours = ['8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM'];

  const events = [
    { day: 0, start: 2, dur: 2, title: 'HVAC — S. Jenkins', crew: 'Mike R.', color: t.primary },
    { day: 1, start: 1, dur: 1.5, title: 'Plumbing — M. Ross', crew: 'Tom L.', color: '#F59E0B' },
    { day: 2, start: 2, dur: 2, title: 'Electrical — L. Park', crew: 'Sarah K.', color: '#8B5CF6' },
    { day: 2, start: 5, dur: 1, title: 'AC Check — D. Kim', crew: 'Mike R.', color: '#0EA5E9' },
    { day: 3, start: 0, dur: 3, title: 'Furnace — E. Wilson', crew: 'Tom L.', color: '#16A34A' },
    { day: 4, start: 3, dur: 1.5, title: 'Duct Clean — J. Lee', crew: 'Sarah K.', color: '#E04F16' },
  ];

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, background: t.surface, borderRadius: 8, border: `1px solid ${t.border}`, padding: 3 } },
        ['Week', 'Day'].map(v => React.createElement('button', {
          key: v, onClick: () => setView(v.toLowerCase()),
          style: {
            padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: view === v.toLowerCase() ? t.primary : 'transparent',
            color: view === v.toLowerCase() ? '#fff' : t.textSecondary,
            transition: 'all 0.15s',
          }
        }, v)),
      ),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
        React.createElement(V2Btn, { style: { height: 30, width: 30, padding: 0 } }, React.createElement(V2ChevronIcon, { dir: 'left' })),
        React.createElement('span', { style: { fontSize: 14, fontWeight: 700, color: t.text, minWidth: 140, textAlign: 'center' } }, 'Apr 14 – 20, 2026'),
        React.createElement(V2Btn, { style: { height: 30, width: 30, padding: 0 } }, React.createElement(V2ChevronIcon, { dir: 'right' })),
      ),
    ),

    React.createElement(V2Card, { style: { padding: 0, overflow: 'hidden' } },
      // Headers
      React.createElement('div', {
        style: { display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', borderBottom: `1px solid ${t.border}` }
      },
        React.createElement('div'),
        ...days.map((d, i) => React.createElement('div', {
          key: d,
          style: { padding: '8px 4px', textAlign: 'center', borderLeft: `1px solid ${t.borderLight}` }
        },
          React.createElement('div', { style: { fontSize: 11, fontWeight: 600, color: i === todayIdx ? t.primary : t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' } }, d),
          React.createElement('div', {
            style: {
              width: 28, height: 28, borderRadius: 8, margin: '3px auto 0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700,
              background: i === todayIdx ? t.primary : 'transparent',
              color: i === todayIdx ? '#fff' : t.text,
            }
          }, dates[i]),
        )),
      ),

      // Grid
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)' } },
        ...hours.flatMap((h, hi) => [
          React.createElement('div', {
            key: 'h' + hi,
            style: { height: 54, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: '1px 6px 0 0', fontSize: 10, color: t.textMuted, fontFamily: '"DM Mono", monospace' }
          }, h),
          ...Array(7).fill(null).map((_, di) => React.createElement('div', {
            key: `c${hi}-${di}`,
            style: {
              height: 54, borderLeft: `1px solid ${t.borderLight}`,
              borderBottom: hi < hours.length - 1 ? `1px solid ${t.borderLight}` : 'none',
              position: 'relative',
            }
          },
            events.filter(e => e.day === di && e.start === hi).map((ev, ei) =>
              React.createElement('div', {
                key: ei,
                style: {
                  position: 'absolute', top: 2, left: 2, right: 2,
                  height: ev.dur * 54 - 4, borderRadius: 8, padding: '5px 8px',
                  background: ev.color + '12', borderLeft: `3px solid ${ev.color}`,
                  overflow: 'hidden', fontSize: 11, zIndex: 5, cursor: 'pointer',
                  transition: 'box-shadow 0.15s',
                },
                onMouseEnter: e => e.currentTarget.style.boxShadow = `0 2px 8px ${ev.color}25`,
                onMouseLeave: e => e.currentTarget.style.boxShadow = 'none',
              },
                React.createElement('div', { style: { fontWeight: 700, color: ev.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, ev.title),
                ev.dur >= 1.5 && React.createElement('div', { style: { fontSize: 10, color: t.textMuted, marginTop: 1 } }, ev.crew),
              )
            ),
          )),
        ]),
      ),
    ),
  );
}

function V2AgentPage() {
  const t = useT();
  const [input, setInput] = React.useState('');
  const [msgs, setMsgs] = React.useState([
    { role: 'ai', text: "Hi! I'm the OpsFlow AI Planner. I can help optimize scheduling, assign crew, and plan routes.\n\nWhat would you like help with?" },
  ]);
  const bottomRef = React.useRef(null);

  React.useEffect(() => { bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' }); }, [msgs.length]);

  const send = () => {
    if (!input.trim()) return;
    setMsgs(m => [...m, { role: 'user', text: input }]);
    const q = input;
    setInput('');
    setTimeout(() => {
      setMsgs(m => [...m, { role: 'ai', text: "Based on current workload analysis:\n\n→ Move AC Installation to 9 AM — closer to Mike's route\n→ Assign Duct Cleaning to Sarah — she'll be free by 2 PM\n→ Keep Tom on Furnace Install — he's already on-site\n\nThis reduces total drive time by ~40 minutes. Want me to apply these changes?" }]);
    }, 700);
  };

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', gap: 0 } },
    React.createElement(V2Card, { style: { flex: 1, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' } },
      // Messages
      React.createElement('div', { style: { flex: 1, overflowY: 'auto', padding: '20px 20px 12px' } },
        msgs.map((m, i) => React.createElement('div', {
          key: i,
          style: { display: 'flex', gap: 10, marginBottom: 16, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }
        },
          m.role === 'ai' && React.createElement('div', {
            style: {
              width: 30, height: 30, borderRadius: 10, flexShrink: 0, marginTop: 2,
              background: t.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 11, fontWeight: 800, boxShadow: `0 2px 8px ${t.primaryGlow}`,
            }
          }, 'AI'),
          React.createElement('div', {
            style: {
              maxWidth: '72%', padding: '12px 16px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              background: m.role === 'user' ? t.primary : t.dark ? t.surfaceHover : t.surfaceAlt,
              color: m.role === 'user' ? '#fff' : t.text,
              fontSize: 13, lineHeight: 1.65, whiteSpace: 'pre-wrap',
              boxShadow: m.role === 'user' ? `0 2px 8px ${t.primaryGlow}` : 'none',
            }
          }, m.text),
        )),
        React.createElement('div', { ref: bottomRef }),
      ),

      // Suggestions
      msgs.length === 1 && React.createElement('div', {
        style: { padding: '0 20px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }
      },
        ['Optimize tomorrow\'s schedule', 'Reassign unassigned jobs', 'Show crew workload'].map(s =>
          React.createElement('button', {
            key: s, onClick: () => { setInput(s); },
            style: {
              padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              border: `1px solid ${t.border}`, background: t.surface, color: t.textSecondary,
              cursor: 'pointer', transition: 'all 0.15s',
            },
            onMouseEnter: e => { e.currentTarget.style.borderColor = t.primary + '50'; e.currentTarget.style.color = t.primary; },
            onMouseLeave: e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textSecondary; },
          }, s)
        ),
      ),

      // Input bar
      React.createElement('div', {
        style: { padding: '12px 16px', borderTop: `1px solid ${t.border}`, display: 'flex', gap: 8, alignItems: 'center' }
      },
        React.createElement('input', {
          value: input, onChange: e => setInput(e.target.value),
          onKeyDown: e => e.key === 'Enter' && send(),
          placeholder: 'Ask the AI Planner...',
          style: {
            flex: 1, height: 40, borderRadius: 10, border: `1px solid ${t.border}`,
            background: t.dark ? t.surfaceHover : '#fff', padding: '0 14px',
            fontSize: 13, color: t.text, outline: 'none', transition: 'border-color 0.15s',
          },
          onFocus: e => e.target.style.borderColor = t.primary,
          onBlur: e => e.target.style.borderColor = t.border,
        }),
        React.createElement(V2Btn, {
          variant: 'primary', onClick: send,
          style: { width: 40, height: 40, padding: 0, borderRadius: 10 }
        }, React.createElement(V2SendIcon)),
      ),
    ),
  );
}

Object.assign(window, { V2SchedulePage, V2AgentPage });
