import * as React from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Appbar, Text, Avatar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useThemeColors } from '../hooks/useThemeColors';
import { subscribeToUserGroups } from '../services/groupsService';
import { sendImageMessage, sendVideoMessage } from '../services/groupChatService';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const IU_CRIMSON = '#CC0000';

export default function SelectGroupScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, userData } = useAuth();
  const themeColors = useThemeColors();
  const text = themeColors?.text || '#000000';
  const subText = themeColors?.subText || '#666666';
  const surface = themeColors?.surface || '#FFFFFF';
  const isDarkMode = themeColors?.isDarkMode || false;
  
  const [groups, setGroups] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [posting, setPosting] = React.useState(null);
  
  // Get media from route params
  const { mediaUri, mediaType } = route.params || {};
  
  // Subscribe to user groups
  React.useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const unsubscribe = subscribeToUserGroups(user.uid, ({ groups, error }) => {
      if (error) {
        console.error('Error loading groups:', error);
      }
      // Filter out expired groups - only show active groups
      const now = new Date();
      const activeGroups = (groups || []).filter((group) => {
        if (!group.endTime) return true; // Groups without endTime are considered active
        const endTime = group.endTime instanceof Date ? group.endTime : new Date(group.endTime);
        return endTime.getTime() > now.getTime();
      });
      setGroups(activeGroups);
      setLoading(false);
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid]);
  
  // Handle group selection
  const handleSelectGroup = async (group) => {
    if (!mediaUri || !mediaType || !user?.uid || !userData) {
      Alert.alert('Error', 'Missing required information to post to group.');
      return;
    }
    
    if (posting) return; // Prevent double posting
    
    setPosting(group.id);
    
    try {
      if (mediaType === 'video') {
        const { messageId, error } = await sendVideoMessage(
          group.id,
          user.uid,
          mediaUri,
          '',
          userData
        );
        
        if (error) {
          Alert.alert('Error', error);
        } else {
          // Store groupId in AsyncStorage for GroupsScreen to pick up
          await AsyncStorage.setItem('pendingGroupId', group.id);
          // Navigate to GroupsMain directly (we're already in GroupsStack)
          navigation.navigate('GroupsMain', { groupId: group.id });
        }
      } else {
        const { messageId, error } = await sendImageMessage(
          group.id,
          user.uid,
          mediaUri,
          '',
          userData
        );
        
        if (error) {
          Alert.alert('Error', error);
        } else {
          // Store groupId in AsyncStorage for GroupsScreen to pick up
          await AsyncStorage.setItem('pendingGroupId', group.id);
          // Navigate to GroupsMain directly (we're already in GroupsStack)
          navigation.navigate('GroupsMain', { groupId: group.id });
        }
      }
    } catch (error) {
      console.error('Error posting to group:', error);
      Alert.alert('Error', error.message || 'Failed to post to group. Please try again.');
    } finally {
      setPosting(null);
    }
  };
  
  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#121212' : '#FAFAFA' }}>
      <Appbar.Header mode="center-aligned" style={{ backgroundColor: 'transparent' }}>
        <Appbar.Action icon="arrow-left" onPress={() => navigation.goBack()} color={text} />
        <Appbar.Content title="Select Group" color={text} />
        <View style={{ width: 48 }} />
      </Appbar.Header>
      
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={IU_CRIMSON} />
          <Text style={{ color: subText, marginTop: 12 }}>Loading groups...</Text>
        </View>
      ) : groups.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <MaterialCommunityIcons name="account-group-outline" size={64} color={subText} />
          <Text style={{ color: text, fontSize: 18, fontWeight: '600', marginTop: 16, textAlign: 'center' }}>
            No Groups Available
          </Text>
          <Text style={{ color: subText, fontSize: 14, marginTop: 8, textAlign: 'center' }}>
            You need to be a member of at least one active group to post.
          </Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {groups.map((group) => (
            <TouchableOpacity
              key={group.id}
              style={{
                backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.8)',
                borderRadius: 20,
                padding: 16,
                marginBottom: 12,
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 4,
                opacity: posting === group.id ? 0.6 : 1,
              }}
              onPress={() => handleSelectGroup(group)}
              disabled={!!posting}
              activeOpacity={0.7}
            >
              {group?.coverPhoto ? (
                <Avatar.Image
                  size={50}
                  source={{ uri: group.coverPhoto }}
                  style={{ backgroundColor: surface, marginRight: 12 }}
                />
              ) : group?.profilePicture ? (
                <Avatar.Image
                  size={50}
                  source={{ uri: group.profilePicture }}
                  style={{ backgroundColor: surface, marginRight: 12 }}
                />
              ) : (
                <Avatar.Text
                  size={50}
                  label={group?.name?.slice(0, 2).toUpperCase() || 'GR'}
                  style={{ backgroundColor: surface, marginRight: 12 }}
                />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: text, fontSize: 16, fontWeight: '600' }}>
                  {group?.name || 'Group'}
                </Text>
                <Text style={{ color: subText, fontSize: 14, marginTop: 2 }}>
                  {group?.memberCount || (Array.isArray(group.members) ? group.members.length : 0)} member{(group?.memberCount || (Array.isArray(group.members) ? group.members.length : 0)) !== 1 ? 's' : ''}
                </Text>
              </View>
              {posting === group.id ? (
                <ActivityIndicator size="small" color={IU_CRIMSON} />
              ) : (
                <MaterialCommunityIcons name="chevron-right" size={24} color={subText} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

