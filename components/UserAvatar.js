// UserAvatar component - displays user avatar with grey person icon fallback
import * as React from 'react';
import { Avatar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * UserAvatar component that shows user's avatar or a grey person icon as fallback
 * @param {Object} props
 * @param {number} props.size - Size of the avatar
 * @param {string} props.uri - Image URI (photoURL, avatar, etc.)
 * @param {Object} props.style - Additional styles
 * @param {string} props.backgroundColor - Background color for icon (default: '#808080')
 * @param {string} props.iconColor - Icon color (default: '#FFFFFF')
 */
export default function UserAvatar({ size, uri, style, backgroundColor = '#808080', iconColor = '#FFFFFF', ...props }) {
  // Check if we have a valid image URI (not empty, not null, not pravatar, and looks like a valid URL)
  const hasValidImage = uri && 
                        typeof uri === 'string' && 
                        uri.trim() && 
                        !uri.includes('pravatar.cc') &&
                        (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('file://') || uri.startsWith('content://'));
  
  if (hasValidImage) {
    return (
      <Avatar.Image 
        size={size} 
        source={{ uri }} 
        style={style}
        {...props}
      />
    );
  }
  
  // Otherwise, show grey background with person icon
  return (
    <Avatar.Icon
      size={size}
      icon={({ size: iconSize, color }) => (
        <MaterialCommunityIcons name="account" size={iconSize * 0.6} color={iconColor} />
      )}
      style={[{ backgroundColor }, style]}
      {...props}
    />
  );
}

