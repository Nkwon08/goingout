// Notification popup component - shows in-app notification popup
import React from 'react';
import { View, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Text, Avatar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UserAvatar from './UserAvatar';
import { useTheme } from '../context/ThemeContext';
import { useThemeColors } from '../hooks/useThemeColors';

const IU_CRIMSON = '#CC0000';

export default function NotificationPopup({ visible, notification, onPress, onDismiss }) {
  const { isDarkMode } = useTheme();
  const { text, subText, surface, background } = useThemeColors();
  const insets = useSafeAreaInsets();
  const slideAnim = React.useRef(new Animated.Value(0)).current; // Start at 0 instead of -100
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible && notification) {
      // Fade in (no slide animation to avoid position issues)
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Fade out
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, notification]);

  if (!visible || !notification) {
    return null;
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'like':
        return 'heart';
      case 'comment':
        return 'comment';
      case 'tag':
        return 'account-tag';
      case 'mention':
        return 'at';
      case 'group_message':
        return 'message-text';
      default:
        return 'bell';
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + 72, // Match the top of the "Roll" logo (insets.top + 8 + 64)
          opacity: opacityAnim,
        },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        style={[
          styles.popup,
          {
            backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          },
        ]}
      >
        <View style={styles.content}>
          <View style={styles.avatarContainer}>
            {notification.fromUserAvatar ? (
              <UserAvatar size={40} uri={notification.fromUserAvatar} />
            ) : (
              <Avatar.Text
                size={40}
                label={notification.fromUserName?.charAt(0)?.toUpperCase() || '?'}
                style={{ backgroundColor: IU_CRIMSON }}
              />
            )}
            <View
              style={[
                styles.iconBadge,
                {
                  backgroundColor: IU_CRIMSON,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={getNotificationIcon(notification.type)}
                size={16}
                color="#FFFFFF"
              />
            </View>
          </View>
          <View style={styles.textContainer}>
            <Text
              style={[styles.name, { color: text }]}
              numberOfLines={1}
            >
              {notification.fromUserName || 'Someone'}
            </Text>
            <Text
              style={[styles.message, { color: subText }]}
              numberOfLines={2}
            >
              {notification.message || 'You have a new notification'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onDismiss}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="close" size={20} color={subText} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  popup: {
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  iconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  textContainer: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  message: {
    fontSize: 12,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
});

