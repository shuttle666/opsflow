// Shared UI primitives

function Badge({ status }) {
  const t = useTheme();
  const c = statusColors[status] || statusColors.NEW;
  return React.createElement('span', {
    style: {
      display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 600,
      fontFamily: '"DM Mono", monospace', letterSpacing: '0.04em',
      padding: '3px 10px', borderRadius: 6, textTransform: 'uppercase',
      background: t.dark ? 'rgba(255,255,255,0.06)' : c.bg,
      color: t.dark ? c.text : c.text,
      border: `1px solid ${t.dark ? 'rgba(255,255,255,0.1)' : c.border}`,
    }
  }, status.replace('_', ' '));
}

function Card({ children, style, onClick, hover }) {
  const t = useTheme();
  const [hovered, setHovered] = React.useState(false);
  return React.createElement('div', {
    onClick,
    onMouseEnter: hover ? () => setHovered(true) : undefined,
    onMouseLeave: hover ? () => setHovered(false) : undefined,
    style: {
      background: t.surface,
      border: `1px solid ${hovered ? t.primary + '30' : t.border}`,
      borderRadius: 10,
      boxShadow: hovered ? t.shadowMd : t.shadow,
      transition: 'all 0.15s ease',
      cursor: onClick ? 'pointer' : undefined,
      ...style,
    }
  }, children);
}

function Input({ placeholder, value, onChange, icon, style }) {
  const t = useTheme();
  return React.createElement('div', {
    style: { position: 'relative', ...style }
  },
    icon && React.createElement('div', {
      style: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: t.textMuted, pointerEvents: 'none' }
    }, icon),
    React.createElement('input', {
      placeholder, value,
      onChange: e => onChange && onChange(e.target.value),
      style: {
        width: '100%', height: 38, borderRadius: 8,
        border: `1px solid ${t.border}`, background: t.surface,
        padding: icon ? '0 12px 0 36px' : '0 12px',
        fontSize: 13, color: t.text, outline: 'none',
        transition: 'border-color 0.15s',
      },
      onFocus: e => e.target.style.borderColor = t.primary,
      onBlur: e => e.target.style.borderColor = t.border,
    })
  );
}

function Select({ options, value, onChange, style }) {
  const t = useTheme();
  return React.createElement('select', {
    value,
    onChange: e => onChange && onChange(e.target.value),
    style: {
      height: 38, borderRadius: 8,
      border: `1px solid ${t.border}`, background: t.surface,
      padding: '0 32px 0 12px', fontSize: 13, color: t.text,
      outline: 'none', appearance: 'none', cursor: 'pointer',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2378716C' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
      ...style,
    }
  }, options.map(o => React.createElement('option', { key: o.value, value: o.value }, o.label)));
}

function Button({ children, variant, onClick, style, disabled }) {
  const t = useTheme();
  const [hovered, setHovered] = React.useState(false);
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';
  return React.createElement('button', {
    onClick, disabled,
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    style: {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      height: isPrimary ? 38 : 34, padding: isGhost ? '0 8px' : '0 16px',
      borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
      border: isPrimary ? 'none' : isGhost ? 'none' : `1px solid ${t.border}`,
      background: isPrimary ? (hovered ? t.primaryHover : t.primary) : isGhost ? (hovered ? t.primaryMuted : 'transparent') : (hovered ? t.surfaceHover : t.surface),
      color: isPrimary ? '#fff' : isGhost ? t.primary : t.text,
      transition: 'all 0.15s', opacity: disabled ? 0.5 : 1,
      ...style,
    }
  }, children);
}

function Avatar({ name, size, color }) {
  const t = useTheme();
  const s = size || 36;
  const initials = name ? name.split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join('') : 'OF';
  const colors = ['#4F46E5', '#0F766E', '#B45309', '#7C3AED', '#0369A1', '#C2410C', '#15803D'];
  const hash = name ? Array.from(name).reduce((h, c) => c.charCodeAt(0) + ((h << 5) - h), 0) : 0;
  const c = color || colors[Math.abs(hash) % colors.length];
  return React.createElement('div', {
    style: {
      width: s, height: s, borderRadius: s / 2, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: c + '18', color: c, fontSize: s * 0.36, fontWeight: 700,
      letterSpacing: '-0.02em',
    }
  }, initials);
}

function StatCard({ label, value, icon, trend, trendLabel, color }) {
  const t = useTheme();
  const c = color || t.primary;
  return React.createElement(Card, { style: { padding: '18px 20px' } },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 } },
      React.createElement('div', {
        style: {
          width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: c + '12', color: c, fontSize: 16,
        }
      }, icon),
      React.createElement('span', { style: { fontSize: 13, fontWeight: 500, color: t.textSecondary } }, label),
    ),
    React.createElement('div', { style: { fontSize: 28, fontWeight: 700, color: t.text, fontFamily: '"DM Mono", monospace', letterSpacing: '-0.03em' } }, value),
    trend !== undefined && React.createElement('div', {
      style: { display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 12, fontWeight: 600, color: trend > 0 ? '#15803D' : trend < 0 ? '#B91C1C' : t.textMuted }
    },
      React.createElement('span', null, trend > 0 ? '↑' : trend < 0 ? '↓' : '→'),
      React.createElement('span', null, trendLabel),
    ),
  );
}

function EmptyState({ icon, title, description }) {
  const t = useTheme();
  return React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }
  },
    React.createElement('div', { style: { fontSize: 32, color: t.textMuted, marginBottom: 12 } }, icon || '📋'),
    React.createElement('h3', { style: { fontSize: 15, fontWeight: 600, color: t.text, margin: '0 0 6px' } }, title),
    React.createElement('p', { style: { fontSize: 13, color: t.textSecondary, maxWidth: 320 } }, description),
  );
}

// Table helper
function DataTable({ columns, rows, onRowClick }) {
  const t = useTheme();
  return React.createElement('div', { style: { overflowX: 'auto' } },
    React.createElement('table', {
      style: { width: '100%', borderCollapse: 'separate', borderSpacing: '0 0', fontSize: 13 }
    },
      React.createElement('thead', null,
        React.createElement('tr', null,
          columns.map((col, i) => React.createElement('th', {
            key: i,
            style: {
              textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.06em', color: t.textMuted,
              borderBottom: `1px solid ${t.border}`,
            }
          }, col.label))
        )
      ),
      React.createElement('tbody', null,
        rows.map((row, ri) => React.createElement('tr', {
          key: ri,
          onClick: () => onRowClick && onRowClick(row),
          style: { cursor: onRowClick ? 'pointer' : undefined, transition: 'background 0.1s' },
          onMouseEnter: e => e.currentTarget.style.background = t.surfaceHover,
          onMouseLeave: e => e.currentTarget.style.background = 'transparent',
        },
          columns.map((col, ci) => React.createElement('td', {
            key: ci,
            style: {
              padding: '12px 16px', color: t.text, borderBottom: `1px solid ${t.borderLight}`,
              fontWeight: ci === 0 ? 600 : 400,
            }
          }, col.render ? col.render(row) : row[col.key]))
        ))
      ),
    )
  );
}

Object.assign(window, { Badge, Card, Input, Select, Button, Avatar, StatCard, EmptyState, DataTable });
