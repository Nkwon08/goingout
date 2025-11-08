// Shared card border styles using PlatformColor and hairlineWidth
// Provides iOS-style separator borders that adapt to light/dark mode
import { Platform, StyleSheet, PlatformColor, DynamicColorIOS } from 'react-native';

/**
 * Get the card border color using platform-specific semantic colors
 * iOS: Uses PlatformColor('separator') which adapts to light/dark mode
 * Android: Uses PlatformColor('?attr/colorOutline') with fallback
 */
export const getCardBorderColor = () => {
  if (Platform.OS === 'ios') {
    // iOS: Use separator color which automatically adapts to light/dark mode
    return PlatformColor('separator');
  } else {
    // Android: Use colorOutline attribute with fallback
    try {
      return PlatformColor('?attr/colorOutline');
    } catch (e) {
      // Fallback to low-alpha neutral color only as last resort
      return 'rgba(120, 120, 128, 0.18)';
    }
  }
};

/**
 * Get card border styles object
 * Uses StyleSheet.hairlineWidth for crisp 1-pt borders on all pixel densities
 * @param {number} borderRadius - Border radius (default: 16, but can be overridden)
 * @returns {object} Style object with borderWidth, borderColor, and borderRadius
 */
export const getCardBorderStyles = (borderRadius = 16) => {
  return {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: getCardBorderColor(),
    borderRadius: borderRadius,
  };
};

/**
 * Get card border styles without borderRadius (useful when borderRadius is set separately)
 * @returns {object} Style object with borderWidth and borderColor only
 */
export const getCardBorderOnly = () => {
  return {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: getCardBorderColor(),
  };
};

/**
 * Complete card surface style with border, radius, and optional background
 * Use this for consistent card styling across the app
 */
export const getCardSurfaceStyle = (borderRadius = 16, backgroundColor = null) => {
  const baseStyle = getCardBorderStyles(borderRadius);
  if (backgroundColor) {
    return {
      ...baseStyle,
      backgroundColor,
    };
  }
  return baseStyle;
};

/**
 * Card border style object for use in StyleSheet.create
 * Use this when you need a static style object
 */
export const cardBorderStyle = {
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: getCardBorderColor(),
};

