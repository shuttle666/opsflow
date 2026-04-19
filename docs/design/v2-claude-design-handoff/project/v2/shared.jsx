// V2 Shared UI — Modern, punchy

function V2Badge({ status }) {
  const t = useT();
  const c = statusColors2[status] || statusColors2.NEW;
  return React.createElement('span', {
    style: {
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20,
      background: t.dark ? 'rgba(255,255,255,0.06)' : c.bg, color: c.text,
      letterSpacing: '0.02em',
    }
  },
    React.createElement('span', { style: { width: 6, height: 6, borderRadius: 3, background: c.dot } }),
    status.replace(/_/g, ' '),
  );
}

function V2Card({ children, style, glow, onClick }) {
  const t = useT();
  const [h, setH] = React.useState(false);
  return React.createElement('div', {
    onClick,
    onMouseEnter: () => setH(true), onMouseLeave: () => setH(false),
    style: {
      background: t.surface, borderRadius: 12,
      border: `1px solid ${h && glow ? t.primary + '40' : t.border}`,
      boxShadow: h && glow ? `${t.shadowMd}, 0 0 0 1px ${t.primary}20` : t.shadow,
      transition: 'all 0.2s ease', cursor: onClick ? 'pointer' : undefined,
      ...style,
    }
  }, children);
}

function V2Input({ placeholder, value, onChange, icon, style }) {
  const t = useT();
  const [f, setF] = React.useState(false);
  return React.createElement('div', { style: { position: 'relative', ...style } },
    icon && React.createElement('div', {
      style: { position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: t.textMuted, pointerEvents: 'none' }
    }, icon),
    React.createElement('input', {
      placeholder, value,
      onChange: e => onChange?.(e.target.value),
      onFocus: () => setF(true), onBlur: () => setF(false),
      style: {
        width: '100%', height: 36, borderRadius: 8,
        border: `1px solid ${f ? t.primary : t.border}`,
        boxShadow: f ? `0 0 0 3px ${t.primaryMuted}` : 'none',
        background: t.dark ? t.surfaceHover : '#fff',
        padding: icon ? '0 12px 0 34px' : '0 12px',
        fontSize: 13, color: t.text, outline: 'none', transition: 'all 0.15s',
      },
    })
  );
}

function V2Select({ options, value, onChange, style }) {
  const t = useT();
  return React.createElement('select', {
    value, onChange: e => onChange?.(e.target.value),
    style: {
      height: 36, borderRadius: 8, border: `1px solid ${t.border}`,
      background: t.dark ? t.surfaceHover : '#fff',
      padding: '0 28px 0 12px', fontSize: 13, color: t.text,
      outline: 'none', appearance: 'none', cursor: 'pointer',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23A1A1AA' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
      ...style,
    }
  }, options.map(o => React.createElement('option', { key: o.value, value: o.value }, o.label)));
}

function V2Btn({ children, variant, onClick, style, disabled }) {
  const t = useT();
  const [h, setH] = React.useState(false);
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';
  const base = isPrimary
    ? { background: h ? t.primaryHover : t.primary, color: '#fff', border: 'none', boxShadow: h ? `0 4px 16px ${t.primaryGlow}` : `0 2px 8px ${t.primaryMuted}` }
    : isGhost
    ? { background: h ? t.primaryMuted : 'transparent', color: t.primary, border: 'none', boxShadow: 'none' }
    : { background: h ? t.surfaceHover : t.surface, color: t.text, border: `1px solid ${t.border}`, boxShadow: 'none' };
  return React.createElement('button', {
    onClick, disabled,
    onMouseEnter: () => setH(true), onMouseLeave: () => setH(false),
    style: {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      height: isPrimary ? 36 : 32, padding: isGhost ? '0 8px' : '0 14px',
      borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all 0.15s', opacity: disabled ? 0.5 : 1, ...base, ...style,
    }
  }, children);
}

function V2Avatar({ name, size, ring }) {
  const t = useT();
  const s = size || 34;
  const initials = name ? name.split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join('') : 'OF';
  const colors = ['#7C5CFC', '#2563EB', '#E04F16', '#0891B2', '#7C3AED', '#059669', '#DB2777'];
  const hash = name ? Array.from(name).reduce((h, c) => c.charCodeAt(0) + ((h << 5) - h), 0) : 0;
  const c = colors[Math.abs(hash) % colors.length];
  return React.createElement('div', {
    style: {
      width: s, height: s, borderRadius: s, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(135deg, ${c}20, ${c}35)`,
      color: c, fontSize: s * 0.36, fontWeight: 700, letterSpacing: '-0.02em',
      border: ring ? `2px solid ${c}50` : 'none',
    }
  }, initials);
}

function V2StatCard({ label, value, trend, trendLabel, icon, color, spark }) {
  const t = useT();
  const c = color || t.primary;
  return React.createElement(V2Card, { glow: true, style: { padding: '20px 22px', position: 'relative', overflow: 'hidden' } },
    // Subtle gradient blob
    React.createElement('div', {
      style: {
        position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: 40,
        background: `radial-gradient(circle, ${c}12, transparent 70%)`, pointerEvents: 'none',
      }
    }),
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, position: 'relative' } },
      React.createElement('span', { style: { fontSize: 13, fontWeight: 500, color: t.textSecondary } }, label),
      React.createElement('div', {
        style: { width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c + '10', color: c, fontSize: 15 }
      }, icon),
    ),
    React.createElement('div', { style: { position: 'relative' } },
      React.createElement('div', {
        style: { fontSize: 30, fontWeight: 800, color: t.text, letterSpacing: '-0.04em', lineHeight: 1 }
      }, value),
      trend !== undefined && React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 12, fontWeight: 600, color: trend > 0 ? '#16A34A' : trend < 0 ? '#DC2626' : t.textMuted }
      },
        React.createElement('span', {
          style: {
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 18, height: 18, borderRadius: 4, fontSize: 10,
            background: trend > 0 ? '#DCFCE7' : trend < 0 ? '#FEE2E2' : t.surfaceAlt,
          }
        }, trend > 0 ? '↑' : trend < 0 ? '↓' : '→'),
        React.createElement('span', null, trendLabel),
      ),
    ),
  );
}

function V2Table({ columns, rows, onRowClick }) {
  const t = useT();
  return React.createElement('div', { style: { overflowX: 'auto' } },
    React.createElement('table', {
      style: { width: '100%', borderCollapse: 'collapse', fontSize: 13 }
    },
      React.createElement('thead', null,
        React.createElement('tr', { style: { borderBottom: `1px solid ${t.border}` } },
          columns.map((col, i) => React.createElement('th', {
            key: i,
            style: {
              textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.06em', color: t.textMuted,
            }
          }, col.label))
        )
      ),
      React.createElement('tbody', null,
        rows.map((row, ri) => React.createElement('tr', {
          key: ri, onClick: () => onRowClick?.(row),
          style: { cursor: onRowClick ? 'pointer' : undefined, borderBottom: `1px solid ${t.borderLight}`, transition: 'background 0.1s' },
          onMouseEnter: e => e.currentTarget.style.background = t.surfaceHover,
          onMouseLeave: e => e.currentTarget.style.background = 'transparent',
        },
          columns.map((col, ci) => React.createElement('td', {
            key: ci,
            style: { padding: '12px 16px', color: ci === 0 ? t.text : t.textSecondary, fontWeight: ci === 0 ? 600 : 400 }
          }, col.render ? col.render(row) : row[col.key]))
        ))
      ),
    )
  );
}

// SVG Icons as components
function V2Icon({ d, size, sw }) {
  return React.createElement('svg', {
    width: size || 18, height: size || 18, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: sw || 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
  }, React.createElement('path', { d }));
}

function V2SearchIcon() { return React.createElement(V2Icon, { d: 'M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z', size: 15 }); }
function V2BellIcon() { return React.createElement(V2Icon, { d: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0' }); }
function V2PlusIcon() { return React.createElement(V2Icon, { d: 'M12 5v14M5 12h14', sw: 2.5, size: 15 }); }
function V2ChevronIcon({ dir }) {
  const d = dir === 'left' ? 'M15 19l-7-7 7-7' : dir === 'right' ? 'M9 5l7 7-7 7' : 'M19 9l-7 7-7-7';
  return React.createElement(V2Icon, { d, size: 15 });
}
function V2SendIcon() { return React.createElement(V2Icon, { d: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z' }); }

// Navigation context (defined early so all pages can use it)
const V2NavContext = React.createContext({ openJobDetail: () => {}, openCustomerDetail: () => {}, back: () => {} });
function useV2Nav() { return React.useContext(V2NavContext); }

Object.assign(window, {
  V2Badge, V2Card, V2Input, V2Select, V2Btn, V2Avatar, V2StatCard, V2Table,
  V2Icon, V2SearchIcon, V2BellIcon, V2PlusIcon, V2ChevronIcon, V2SendIcon,
  V2NavContext, useV2Nav,
});
