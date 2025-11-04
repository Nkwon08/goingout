// Theme context - manages dark/light mode for the entire app
import * as React from 'react';
import { createContext, useContext, useState } from 'react';

const ThemeContext = createContext();

// Provider component - wraps app to provide theme state
export function ThemeProvider({ children }) {
  // Track if dark mode is enabled - default to dark mode
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Toggle between dark and light mode
  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook to use theme context in components
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

