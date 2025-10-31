import { useTheme } from '../context/ThemeContext';

export function useThemeColors() {
  const { isDarkMode } = useTheme();

  return {
    isDarkMode,
    background: isDarkMode ? '#1A1A1A' : '#EEEDEB',
    surface: isDarkMode ? '#2A2A2A' : '#F5F4F2',
    text: isDarkMode ? '#E6E8F0' : '#1A1A1A',
    subText: isDarkMode ? '#8A90A6' : '#666666',
    divider: isDarkMode ? '#3A3A3A' : '#D0CFCD',
    border: isDarkMode ? '#3A3A3A' : '#D0CFCD',
    // Legacy colors for compatibility
    card: isDarkMode ? '#2A2A2A' : '#F5F4F2',
  };
}

