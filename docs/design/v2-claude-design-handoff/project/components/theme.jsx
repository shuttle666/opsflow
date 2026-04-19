// Theme system for OpsFlow
const ThemeContext = React.createContext();

const schemes = {
  indigo: {
    name: 'Warm Indigo',
    primary: '#4F46E5',
    primaryHover: '#4338CA',
    primaryLight: '#EEF2FF',
    primaryMuted: 'rgba(79,70,229,0.08)',
    accent: '#F59E0B',
    accentLight: '#FFFBEB',
  },
  teal: {
    name: 'Deep Teal',
    primary: '#0F766E',
    primaryHover: '#0D5F59',
    primaryLight: '#F0FDFA',
    primaryMuted: 'rgba(15,118,110,0.08)',
    accent: '#E11D48',
    accentLight: '#FFF1F2',
  },
  slate: {
    name: 'Slate Pro',
    primary: '#3B5998',
    primaryHover: '#2D4A7A',
    primaryLight: '#EFF4FB',
    primaryMuted: 'rgba(59,89,152,0.08)',
    accent: '#E67E22',
    accentLight: '#FFF7ED',
  },
};

const lightTokens = {
  bg: '#FAF9F7',
  surface: '#FFFFFF',
  surfaceHover: '#F5F4F2',
  surfaceAlt: '#F5F4F2',
  border: '#E7E5E0',
  borderLight: '#F0EEEB',
  text: '#1C1917',
  textSecondary: '#78716C',
  textMuted: '#A8A29E',
  shadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  shadowMd: '0 4px 12px rgba(0,0,0,0.06)',
  shadowLg: '0 8px 24px rgba(0,0,0,0.08)',
};

const darkTokens = {
  bg: '#1A1918',
  surface: '#262524',
  surfaceHover: '#302F2D',
  surfaceAlt: '#1F1E1D',
  border: '#3D3B38',
  borderLight: '#333230',
  text: '#F5F4F2',
  textSecondary: '#A8A29E',
  textMuted: '#78716C',
  shadow: '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
  shadowMd: '0 4px 12px rgba(0,0,0,0.3)',
  shadowLg: '0 8px 24px rgba(0,0,0,0.4)',
};

const statusColors = {
  NEW: { bg: '#EEF2FF', text: '#4F46E5', border: '#C7D2FE' },
  SCHEDULED: { bg: '#F0F9FF', text: '#0369A1', border: '#BAE6FD' },
  IN_PROGRESS: { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
  PENDING_REVIEW: { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  COMPLETED: { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  CANCELLED: { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' },
  ACTIVE: { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
};

function ThemeProvider({ children }) {
  const [dark, setDark] = React.useState(false);
  const [schemeKey, setSchemeKey] = React.useState('indigo');

  const scheme = schemes[schemeKey];
  const tokens = dark ? darkTokens : lightTokens;
  const theme = { ...tokens, ...scheme, dark, setDark, schemeKey, setSchemeKey, statusColors };

  return React.createElement(ThemeContext.Provider, { value: theme }, children);
}

function useTheme() {
  return React.useContext(ThemeContext);
}

window.ThemeContext = ThemeContext;
window.ThemeProvider = ThemeProvider;
window.useTheme = useTheme;
window.schemes = schemes;
window.statusColors = statusColors;
