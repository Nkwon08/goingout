// Hook to get theme colors based on dark/light mode
import { useTheme } from '../context/ThemeContext';

export function useThemeColors() {
  let isDarkMode = false;
  try {
    const theme = useTheme();
    isDarkMode = theme?.isDarkMode ?? false;
  } catch (error) {
    // If useTheme throws (e.g., not within ThemeProvider), default to false
    console.warn('useThemeColors: Error getting theme, defaulting to light mode:', error);
    isDarkMode = false;
  }

  // Return color palette that changes based on theme with liquid glass effect
  return {
    isDarkMode: Boolean(isDarkMode), // Ensure it's always a boolean
    background: isDarkMode ? '#121212' : '#FAFAFA',
    surface: isDarkMode ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.8)',
    text: isDarkMode ? '#FFFFFF' : '#000000',
    subText: isDarkMode ? '#B0B0B0' : '#666666',
    divider: isDarkMode ? 'rgba(42, 42, 42, 0.3)' : 'rgba(224, 224, 224, 0.3)',
    border: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    card: isDarkMode ? 'rgba(30, 30, 30, 0.7)' : 'rgba(255, 255, 255, 0.9)',
    primary: '#CC0000',       // IU Crimson
    secondary: '#ffffff',
    accent: '#CC0000',
    accent2: '#CC0000',
    accent3: '#CC0000',
    accent4: '#CC0000',
    accent5: '#CC0000',
    accent6: '#CC0000',
  };
}

