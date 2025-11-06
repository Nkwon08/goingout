// Create Group Screen - allows creating a group and adding friends
import * as React from 'react';
import { View, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Platform } from 'react-native';
import { Appbar, Text, Button, Checkbox, Avatar, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useThemeColors } from '../hooks/useThemeColors';
import { useAuth } from '../context/AuthContext';
import { getUserById } from '../services/usersService';
import { createGroup } from '../services/groupsService';

const IU_CRIMSON = '#990000';

export default function CreateGroupScreen({ navigation }) {
  const { background, text, subText, surface, divider } = useThemeColors();
  const { user, userData, friendsList: friendsListFromContext } = useAuth();
  
  const [groupName, setGroupName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [friends, setFriends] = React.useState([]); // Array of friend UIDs
  const [friendsWithData, setFriendsWithData] = React.useState([]); // Array of friend objects with full data
  const [selectedFriends, setSelectedFriends] = React.useState(new Set()); // Set of selected friend UIDs
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  
  // Time range state - set startTime to 5 minutes in the future to allow validation to pass
  const [startTime, setStartTime] = React.useState(() => new Date(Date.now() + 5 * 60 * 1000)); // Default: 5 minutes from now
  const [endTime, setEndTime] = React.useState(() => new Date(Date.now() + 24 * 60 * 60 * 1000)); // Default: 24 hours from now
  const [showStartPicker, setShowStartPicker] = React.useState(false);
  const [showEndPicker, setShowEndPicker] = React.useState(false);

  // Load friends list from AuthContext - subscription is managed centrally
  React.useEffect(() => {
    let isMounted = true;

    // Use friends list from AuthContext (centralized subscription)
    const friendIds = friendsListFromContext || [];
    setFriends(friendIds);

    if (!friendIds.length) {
      setFriendsWithData([]);
      setLoading(false);
      return;
    }

    // Fetch friend user data in parallel
    const loadFriendData = async () => {
      try {
        const friendData = await Promise.all(
          friendIds.map(async (uid) => {
            try {
              const { userData: friendUserData } = await getUserById(uid);
              if (friendUserData) {
                // Ensure uid is set (getUserById returns id, but we need uid)
                return { ...friendUserData, uid: friendUserData.uid || friendUserData.id || uid };
              }
              return { uid, username: 'Unknown', name: 'Unknown User', avatar: null };
            } catch {
              return { uid, username: 'Unknown', name: 'Unknown User', avatar: null };
            }
          })
        );
        
        if (isMounted) {
          setFriendsWithData(friendData);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading friends:', err);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadFriendData();

    return () => {
      isMounted = false;
    };
  }, [friendsListFromContext]); // Re-fetch when friends list changes from context

  const handleToggleFriend = (friendId) => {
    setSelectedFriends((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(friendId)) {
        newSet.delete(friendId);
      } else {
        newSet.add(friendId);
      }
      return newSet;
    });
  };

  const handleCreateGroup = async () => {
    console.log('🔵 Create Group button pressed');
    console.log('🔵 Group Name:', groupName);
    console.log('🔵 Selected Friends:', selectedFriends.size);
    console.log('🔵 Start Time:', startTime);
    console.log('🔵 End Time:', endTime);
    console.log('🔵 User:', user?.uid);

    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name', [{ text: 'OK' }]);
      return;
    }

    if (selectedFriends.size === 0) {
      Alert.alert('Error', 'Please select at least one friend to add to the group', [{ text: 'OK' }]);
      return;
    }

    if (!user || !user.uid) {
      Alert.alert('Error', 'You must be logged in to create a group', [{ text: 'OK' }]);
      return;
    }

    const now = new Date();
    // Allow startTime to be at least 30 seconds in the future (give some buffer)
    const minStartTime = new Date(now.getTime() + 30 * 1000); // 30 seconds from now
    if (startTime < minStartTime) {
      Alert.alert('Error', 'Start time must be at least 30 seconds in the future', [{ text: 'OK' }]);
      return;
    }

    if (endTime <= startTime) {
      Alert.alert('Error', 'End time must be after start time', [{ text: 'OK' }]);
      return;
    }

    if (endTime <= now) {
      Alert.alert('Error', 'End time must be in the future', [{ text: 'OK' }]);
      return;
    }

    setCreating(true);
    try {
      console.log('🔵 Calling createGroup service...');
      // Create group in Firestore
      const { groupId, error } = await createGroup({
        name: groupName.trim(),
        description: description.trim(),
        members: Array.from(selectedFriends),
        creator: user.uid,
        startTime,
        endTime,
      });

      if (error) {
        console.error('❌ Error from createGroup:', error);
        Alert.alert('Error', error, [{ text: 'OK' }]);
        setCreating(false);
        return;
      }

      if (!groupId) {
        console.error('❌ No groupId returned from createGroup');
        Alert.alert('Error', 'Failed to create group', [{ text: 'OK' }]);
        setCreating(false);
        return;
      }

      console.log('✅ Group created successfully:', groupId);

      Alert.alert(
        'Success',
        `Group "${groupName.trim()}" created with ${selectedFriends.size + 1} member${selectedFriends.size + 1 > 1 ? 's' : ''}!`,
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      console.error('❌ Error creating group:', error);
      console.error('❌ Error stack:', error.stack);
      Alert.alert('Error', error.message || 'Failed to create group', [{ text: 'OK' }]);
    } finally {
      setCreating(false);
    }
  };

  const formatDateTime = (date) => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleStartTimeChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowStartPicker(false);
    }
    if (event.type === 'set' && selectedDate) {
      setStartTime(selectedDate);
      // If start time is after end time, update end time to be 1 hour after start
      if (selectedDate >= endTime) {
        const newEndTime = new Date(selectedDate.getTime() + 60 * 60 * 1000); // 1 hour later
        setEndTime(newEndTime);
      }
    }
    if (Platform.OS === 'android' && event.type === 'dismissed') {
      setShowStartPicker(false);
    }
  };

  const handleEndTimeChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowEndPicker(false);
    }
    if (event.type === 'set' && selectedDate) {
      setEndTime(selectedDate);
    }
    if (Platform.OS === 'android' && event.type === 'dismissed') {
      setShowEndPicker(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      <Appbar.Header mode="center-aligned" style={{ backgroundColor: background }}>
        <Appbar.Action icon="arrow-left" onPress={() => navigation.goBack()} color={text} />
        <Appbar.Content title="Create Group" color={text} />
        <Appbar.Action
          icon="check"
          onPress={handleCreateGroup}
          disabled={
            creating ||
            !groupName.trim() ||
            selectedFriends.size === 0 ||
            !user ||
            !user.uid ||
            startTime.getTime() < Date.now() + 30 * 1000 || // At least 30 seconds in future
            endTime <= startTime ||
            endTime.getTime() <= Date.now()
          }
          color={
            creating ||
            !groupName.trim() ||
            selectedFriends.size === 0 ||
            !user ||
            !user.uid ||
            startTime.getTime() < Date.now() + 30 * 1000 || // At least 30 seconds in future
            endTime <= startTime ||
            endTime.getTime() <= Date.now()
              ? subText
              : IU_CRIMSON
          }
        />
      </Appbar.Header>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Group Name */}
        <Text style={{ color: text, fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
          Group Name *
        </Text>
        <TextInput
          style={{
            backgroundColor: surface,
            borderRadius: 12,
            padding: 12,
            color: text,
            fontSize: 16,
            marginBottom: 16,
          }}
          placeholder="Enter group name"
          placeholderTextColor={subText}
          value={groupName}
          onChangeText={setGroupName}
          maxLength={50}
        />

        {/* Description */}
        <Text style={{ color: text, fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
          Description (Optional)
        </Text>
        <TextInput
          style={{
            backgroundColor: surface,
            borderRadius: 12,
            padding: 12,
            color: text,
            fontSize: 16,
            marginBottom: 16,
            minHeight: 80,
            textAlignVertical: 'top',
          }}
          placeholder="Describe your group..."
          placeholderTextColor={subText}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          maxLength={200}
        />

        {/* Time Range Section */}
        <Text style={{ color: text, fontSize: 16, fontWeight: '600', marginBottom: 8, marginTop: 8 }}>
          Time Range *
        </Text>
        <Text style={{ color: subText, fontSize: 12, marginBottom: 12 }}>
          The group will be automatically deleted after the end time
        </Text>

        {/* Start Time */}
        <Text style={{ color: text, fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
          Start Time *
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: surface,
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
          onPress={() => setShowStartPicker(true)}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <MaterialCommunityIcons name="calendar-clock" size={20} color={IU_CRIMSON} />
            <Text style={{ color: text, fontSize: 16, marginLeft: 12 }}>
              {formatDateTime(startTime)}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-down" size={20} color={subText} />
        </TouchableOpacity>

        {/* End Time */}
        <Text style={{ color: text, fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
          End Time *
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: surface,
            borderRadius: 12,
            padding: 12,
            marginBottom: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
          onPress={() => setShowEndPicker(true)}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <MaterialCommunityIcons name="calendar-clock" size={20} color={IU_CRIMSON} />
            <Text style={{ color: text, fontSize: 16, marginLeft: 12 }}>
              {formatDateTime(endTime)}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-down" size={20} color={subText} />
        </TouchableOpacity>

        {/* Date/Time Pickers */}
        {showStartPicker && (
          <>
            {Platform.OS === 'ios' ? (
              <View
                style={{
                  backgroundColor: surface,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ color: text, fontSize: 16, fontWeight: '600' }}>Select Start Time</Text>
                  <Button
                    onPress={() => setShowStartPicker(false)}
                    textColor={IU_CRIMSON}
                    labelStyle={{ fontSize: 16 }}
                  >
                    Done
                  </Button>
                </View>
                <DateTimePicker
                  value={startTime}
                  mode="datetime"
                  display="spinner"
                  onChange={handleStartTimeChange}
                  minimumDate={new Date(Date.now() + 30 * 1000)} // At least 30 seconds in future
                  maximumDate={endTime}
                  textColor={text}
                />
              </View>
            ) : (
              <DateTimePicker
                value={startTime}
                mode="datetime"
                display="default"
                onChange={handleStartTimeChange}
                minimumDate={new Date(Date.now() + 30 * 1000)} // At least 30 seconds in future
                maximumDate={endTime}
              />
            )}
          </>
        )}

        {showEndPicker && (
          <>
            {Platform.OS === 'ios' ? (
              <View
                style={{
                  backgroundColor: surface,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ color: text, fontSize: 16, fontWeight: '600' }}>Select End Time</Text>
                  <Button
                    onPress={() => setShowEndPicker(false)}
                    textColor={IU_CRIMSON}
                    labelStyle={{ fontSize: 16 }}
                  >
                    Done
                  </Button>
                </View>
                <DateTimePicker
                  value={endTime}
                  mode="datetime"
                  display="spinner"
                  onChange={handleEndTimeChange}
                  minimumDate={startTime}
                  textColor={text}
                />
              </View>
            ) : (
              <DateTimePicker
                value={endTime}
                mode="datetime"
                display="default"
                onChange={handleEndTimeChange}
                minimumDate={startTime}
              />
            )}
          </>
        )}

        {/* Friends Section */}
        <Text style={{ color: text, fontSize: 16, fontWeight: '600', marginBottom: 8, marginTop: 8 }}>
          Add Friends ({selectedFriends.size} selected)
        </Text>

        {loading ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={IU_CRIMSON} />
            <Text style={{ color: subText, marginTop: 8 }}>Loading friends...</Text>
          </View>
        ) : friendsWithData.length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: subText, textAlign: 'center' }}>
              You don't have any friends yet. Add friends to create a group.
            </Text>
          </View>
        ) : (
          <View style={{ backgroundColor: surface, borderRadius: 16, overflow: 'hidden' }}>
            {friendsWithData.map((friend, index) => {
              const isSelected = selectedFriends.has(friend.uid);
              return (
                <View key={friend.uid}>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 12,
                      backgroundColor: isSelected ? 'rgba(153, 0, 0, 0.1)' : 'transparent',
                    }}
                    onPress={() => handleToggleFriend(friend.uid)}
                    activeOpacity={0.7}
                  >
                    <Avatar.Image
                      size={40}
                      source={{ uri: friend.avatar || 'https://i.pravatar.cc/100?img=12' }}
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ color: text, fontSize: 16, fontWeight: '500' }}>
                        {friend.name || 'Unknown User'}
                      </Text>
                      <Text style={{ color: subText, fontSize: 14 }}>
                        @{friend.username || 'unknown'}
                      </Text>
                    </View>
                    <Checkbox
                      status={isSelected ? 'checked' : 'unchecked'}
                      onPress={() => handleToggleFriend(friend.uid)}
                      color={IU_CRIMSON}
                    />
                  </TouchableOpacity>
                  {index < friendsWithData.length - 1 && (
                    <Divider style={{ backgroundColor: divider }} />
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Create Button */}
        <Button
          mode="contained"
          buttonColor={IU_CRIMSON}
          textColor="#FFFFFF"
          onPress={handleCreateGroup}
          disabled={
            creating ||
            !groupName.trim() ||
            selectedFriends.size === 0 ||
            !user ||
            !user.uid ||
            startTime.getTime() < Date.now() + 30 * 1000 || // At least 30 seconds in future
            endTime <= startTime ||
            endTime.getTime() <= Date.now()
          }
          loading={creating}
          style={{ marginTop: 24, marginBottom: 16 }}
          icon="account-plus"
        >
          {creating ? 'Creating...' : `Create Group (${selectedFriends.size} member${selectedFriends.size !== 1 ? 's' : ''})`}
        </Button>
      </ScrollView>
    </View>
  );
}

