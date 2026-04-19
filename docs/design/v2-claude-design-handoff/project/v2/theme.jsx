// V2 Theme — Modern, bold, eye-catching

const ThemeContext2 = React.createContext();

const schemes2 = {
  violet: {
    name: 'Electric Violet',
    primary: '#7C5CFC',
    primaryHover: '#6B4FE0',
    primaryLight: '#F1EDFF',
    primaryMuted: 'rgba(124,92,252,0.08)',
    primaryGlow: 'rgba(124,92,252,0.25)',
    accent: '#F97316',
    accentLight: '#FFF7ED',
    gradient: 'linear-gradient(135deg, #7C5CFC 0%, #A78BFA 50%, #C4B5FD 100%)',
    sidebarGradient: 'linear-gradient(180deg, #1A1235 0%, #0F0A1E 100%)',
    sidebarAccent: '#A78BFA',
  },
  ocean: {
    name: 'Deep Ocean',
    primary: '#2563EB',
    primaryHover: '#1D4ED8',
    primaryLight: '#EFF6FF',
    primaryMuted: 'rgba(37,99,235,0.08)',
    primaryGlow: 'rgba(37,99,235,0.25)',
    accent: '#F59E0B',
    accentLight: '#FFFBEB',
    gradient: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 50%, #60A5FA 100%)',
    sidebarGradient: 'linear-gradient(180deg, #0C1929 0%, #070F1A 100%)',
    sidebarAccent: '#60A5FA',
  },
  ember: {
    name: 'Warm Ember',
    primary: '#E04F16',
    primaryHover: '#C4420F',
    primaryLight: '#FFF4ED',
    primaryMuted: 'rgba(224,79,22,0.07)',
    primaryGlow: 'rgba(224,79,22,0.22)',
    accent: '#7C3AED',
    accentLight: '#F5F3FF',
    gradient: 'linear-gradient(135deg, #E04F16 0%, #F97316 50%, #FB923C 100%)',
    sidebarGradient: 'linear-gradient(180deg, #1C1210 0%, #120B08 100%)',
    sidebarAccent: '#FB923C',
  },
};

const light2 = {
  bg: '#F6F5F3',
  surface: '#FFFFFF',
  surfaceHover: '#FAFAF8',
  surfaceAlt: '#F0EFED',
  border: '#E8E6E1',
  borderLight: '#F0EFED',
  text: '#18181B',
  textSecondary: '#71717A',
  textMuted: '#A1A1AA',
  shadow: '0 1px 2px rgba(0,0,0,0.05)',
  shadowMd: '0 4px 16px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  shadowLg: '0 12px 32px rgba(0,0,0,0.08)',
};

const dark2 = {
  bg: '#09090B',
  surface: '#18181B',
  surfaceHover: '#1F1F23',
  surfaceAlt: '#111113',
  border: '#27272A',
  borderLight: '#1F1F23',
  text: '#FAFAFA',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  shadow: '0 1px 2px rgba(0,0,0,0.4)',
  shadowMd: '0 4px 16px rgba(0,0,0,0.4)',
  shadowLg: '0 12px 32px rgba(0,0,0,0.5)',
};

const statusColors2 = {
  NEW: { bg: '#EEF2FF', text: '#4F46E5', dot: '#6366F1' },
  SCHEDULED: { bg: '#F0F9FF', text: '#0369A1', dot: '#0EA5E9' },
  IN_PROGRESS: { bg: '#FFFBEB', text: '#B45309', dot: '#F59E0B' },
  PENDING_REVIEW: { bg: '#FFF7ED', text: '#C2410C', dot: '#F97316' },
  COMPLETED: { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E' },
  CANCELLED: { bg: '#FEF2F2', text: '#B91C1C', dot: '#EF4444' },
  ACTIVE: { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E' },
};

function ThemeProvider2({ children }) {
  const [dark, setDark] = React.useState(false);
  const [schemeKey, setSchemeKey] = React.useState('violet');
  const scheme = schemes2[schemeKey];
  const tokens = dark ? dark2 : light2;
  const theme = { ...tokens, ...scheme, dark, setDark, schemeKey, setSchemeKey, statusColors: statusColors2 };
  return React.createElement(ThemeContext2.Provider, { value: theme }, children);
}

function useT() { return React.useContext(ThemeContext2); }

window.ThemeContext2 = ThemeContext2;
window.ThemeProvider2 = ThemeProvider2;
window.useT = useT;
window.schemes2 = schemes2;
window.statusColors2 = statusColors2;
