// Hook to get theme colors based on dark/light mode
import { useTheme } from '../context/ThemeContext';

export function useThemeColors() {
  const { isDarkMode } = useTheme();

  // Return color palette that changes based on theme
  return {
    isDarkMode,
    background: isDarkMode ? '#1A1A1A' : '#EEEDEB',
    surface: isDarkMode ? '#1E1E1E' : '#F5F4F2',
    text: isDarkMode ? '#E6E8F0' : '#1A1A1A',
    subText: isDarkMode ? '#8A90A6' : '#666666',
    divider: isDarkMode ? '#3A3A3A' : '#D0CFCD',
    border: isDarkMode ? '#3A3A3A' : '#D0CFCD',
    card: isDarkMode ? '#1E1E1E' : '#F5F4F2',
  };
}

