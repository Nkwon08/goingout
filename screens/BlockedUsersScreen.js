// Blocked Users screen - view and manage blocked users
import * as React from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { Appbar, Avatar, Text, List, Button, Divider, ActivityIndicator } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { subscribeToBlockedUsers, unblockUser } from '../services/blockService';

export default function BlockedUsersScreen({ navigation }) {
  const [blockedUsers, setBlockedUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [unblocking, setUnblocking] = React.useState({}); // Track which user is being unblocked
  
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  
  // Theme colors
  const bgColor = isDarkMode ? '#121212' : '#FAFAFA';
  const surfaceColor = isDarkMode ? '#2A2A2A' : '#F5F4F2';
  const textColor = isDarkMode ? '#E6E8F0' : '#1A1A1A';
  const subTextColor = isDarkMode ? '#8A90A6' : '#666666';
  const dividerColor = isDarkMode ? '#3A3A3A' : '#D0CFCD';

  // Subscribe to blocked users
  React.useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToBlockedUsers(user.uid, (result) => {
      if (result.error) {
        console.error('Error loading blocked users:', result.error);
        Alert.alert('Error', result.error);
      } else {
        setBlockedUsers(result.blockedUsers);
      }
      setLoading(false);
    });

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [user?.uid]);

  // Handle unblock
  const handleUnblock = React.useCallback(async (blockedUser) => {
    if (!user?.uid || unblocking[blockedUser.authUid]) {
      return;
    }

    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock @${blockedUser.username}? You will be able to see their posts and interact with them again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'destructive',
          onPress: async () => {
            setUnblocking(prev => ({ ...prev, [blockedUser.authUid]: true }));
            try {
              const result = await unblockUser(user.uid, blockedUser.authUid || blockedUser.username);
              if (!result.success) {
                Alert.alert('Error', result.error || 'Failed to unblock user');
              }
            } catch (error) {
              console.error('Error unblocking user:', error);
              Alert.alert('Error', 'Failed to unblock user. Please try again.');
            } finally {
              setUnblocking(prev => {
                const newState = { ...prev };
                delete newState[blockedUser.authUid];
                return newState;
              });
            }
          },
        },
      ]
    );
  }, [user?.uid, unblocking]);

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      {/* Header */}
      <Appbar.Header mode="center-aligned" style={{ backgroundColor: bgColor }}>
        <Appbar.Action 
          icon="arrow-left" 
          onPress={() => navigation.goBack()} 
          color={textColor} 
        />
        <Appbar.Content title="Blocked Users" color={textColor} />
      </Appbar.Header>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={textColor} />
          <Text style={{ color: subTextColor, marginTop: 16 }}>Loading blocked users...</Text>
        </View>
      ) : blockedUsers.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: subTextColor, fontSize: 16, textAlign: 'center' }}>
            You haven't blocked any users yet.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={{ backgroundColor: surfaceColor, borderRadius: 16 }}>
            {blockedUsers.map((blockedUser, index) => (
              <React.Fragment key={blockedUser.authUid || blockedUser.username}>
                <List.Item
                  title={blockedUser.name || 'Unknown User'}
                  description={`@${blockedUser.username}`}
                  titleStyle={{ color: textColor }}
                  descriptionStyle={{ color: subTextColor }}
                  left={(props) => (
                    <Avatar.Image
                      {...props}
                      size={48}
                      source={{ uri: blockedUser.avatar }}
                      style={{ marginLeft: 8 }}
                    />
                  )}
                  right={() => (
                    <Button
                      mode="outlined"
                      onPress={() => handleUnblock(blockedUser)}
                      disabled={unblocking[blockedUser.authUid]}
                      loading={unblocking[blockedUser.authUid]}
                      style={{ marginRight: 8 }}
                      textColor={textColor}
                    >
                      Unblock
                    </Button>
                  )}
                />
                {index < blockedUsers.length - 1 && (
                  <Divider style={{ backgroundColor: dividerColor }} />
                )}
              </React.Fragment>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

