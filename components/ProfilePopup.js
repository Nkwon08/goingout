// Profile Popup component - shows user profile when clicking avatar in feed
import * as React from 'react';
import { View, Modal, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Avatar, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';

const IU_CRIMSON = '#CC0000';

export default function ProfilePopup({ visible, onClose, userProfile, onAddFriend, isFriend }) {
  const { background, text, subText, surface } = useThemeColors();

  if (!visible || !userProfile) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={[styles.popup, { backgroundColor: surface }]}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <MaterialCommunityIcons name="close" size={24} color={text} />
          </TouchableOpacity>

          {/* Profile Content */}
          <View style={styles.content}>
            {/* Avatar */}
            <Avatar.Image
              size={80}
              source={{ uri: userProfile.avatar || 'https://i.pravatar.cc/100?img=12' }}
              style={styles.avatar}
            />

            {/* Username */}
            <Text variant="titleLarge" style={[styles.username, { color: text }]}>
              @{userProfile.username || userProfile.user || 'username'}
            </Text>

            {/* Bio */}
            <Text style={[styles.bio, { color: userProfile.bio ? text : subText }]}>
              {userProfile.bio || 'No bio yet'}
            </Text>

            {/* Age and Gender */}
            <View style={styles.infoRow}>
              <Text style={[styles.info, { color: subText }]}>
                {userProfile.age ? `${userProfile.age} years old` : 'Age not set'}
              </Text>
              <Text style={[styles.separator, { color: subText }]}>•</Text>
              <Text style={[styles.info, { color: subText }]}>
                {userProfile.gender || 'Gender not set'}
              </Text>
            </View>

            {/* Add Friend Button */}
            <Button
              mode="contained"
              onPress={onAddFriend}
              disabled={isFriend} // Disable if already friends
              buttonColor={isFriend ? subText : IU_CRIMSON}
              textColor="#FFFFFF"
              style={styles.addFriendButton}
              contentStyle={styles.buttonContent}
              icon={isFriend ? 'account-check' : 'account-plus'}
              loading={false} // Loading state handled by parent
            >
              {isFriend ? 'Friends' : 'Add Friend'}
            </Button>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popup: {
    width: '85%',
    maxWidth: 350,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  content: {
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  avatar: {
    marginBottom: 16,
  },
  username: {
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  bio: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: -8,
    paddingHorizontal: 8,
    lineHeight: 20,
    minHeight: 40,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  info: {
    fontSize: 14,
  },
  separator: {
    fontSize: 14,
    marginHorizontal: 4,
  },
  addFriendButton: {
    width: '100%',
    borderRadius: 12,
    marginTop: 8,
  },
  buttonContent: {
    paddingVertical: 8,
  },
});

