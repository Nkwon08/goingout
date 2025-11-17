// Create Group Screen - allows creating a group and adding friends
import * as React from 'react';
import { View, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Platform } from 'react-native';
import { Appbar, Text, Button, Checkbox, Avatar, Divider } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UserAvatar from '../components/UserAvatar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useThemeColors } from '../hooks/useThemeColors';
import { useAuth } from '../context/AuthContext';
import { getUserById } from '../services/usersService';
import { createGroup } from '../services/groupsService';

const IU_CRIMSON = '#CC0000';

export default function CreateGroupScreen({ navigation }) {
  const { background, text, subText, surface, divider } = useThemeColors();
  const { user, userData, friendsList: friendsListFromContext } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [currentStep, setCurrentStep] = React.useState(1); // 1: Name, 2: Time Range, 3: Friends
  const [groupName, setGroupName] = React.useState('');
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
        description: '', // Description removed
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

  const handleNext = () => {
    if (currentStep === 1) {
      if (!groupName.trim()) {
        Alert.alert('Error', 'Please enter a group name', [{ text: 'OK' }]);
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      const now = new Date();
      const minStartTime = new Date(now.getTime() + 30 * 1000);
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
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  const canProceedFromStep = () => {
    if (currentStep === 1) {
      return groupName.trim().length > 0;
    } else if (currentStep === 2) {
      const now = new Date();
      const minStartTime = new Date(now.getTime() + 30 * 1000);
      return startTime >= minStartTime && endTime > startTime && endTime > now;
    }
    return true;
  };

  // Render Step 1: Group Name
  const renderStep1 = () => (
    <ScrollView 
      contentContainerStyle={{ 
        flexGrow: 1, 
        justifyContent: 'flex-start', 
        paddingHorizontal: 16,
        paddingTop: 60,
        paddingBottom: 24
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={{ color: text, fontSize: 24, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
        What's the group name?
      </Text>
      <Text style={{ color: subText, fontSize: 16, marginBottom: 32, textAlign: 'center' }}>
        Give your group a memorable name
      </Text>
      <TextInput
        style={{
          backgroundColor: surface,
          borderRadius: 12,
          padding: 16,
          color: text,
          fontSize: 18,
          marginBottom: 24,
          width: '100%',
        }}
        placeholder="Enter group name"
        placeholderTextColor={subText}
        value={groupName}
        onChangeText={setGroupName}
        maxLength={50}
        autoFocus
      />
      <Button
        mode="contained"
        buttonColor={IU_CRIMSON}
        textColor="#FFFFFF"
        onPress={() => {
          console.log('Next button pressed on step 1');
          handleNext();
        }}
        disabled={false}
        icon="arrow-right"
        contentStyle={{ flexDirection: 'row-reverse', paddingVertical: 8 }}
        style={{ 
          width: '100%', 
          marginTop: 8,
          opacity: canProceedFromStep() ? 1 : 0.6
        }}
      >
        Next
      </Button>
    </ScrollView>
  );

  // Render Step 2: Time Range
  const renderStep2 = () => (
    <ScrollView 
      contentContainerStyle={{ padding: 16, paddingTop: 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={{ color: text, fontSize: 24, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
        When is the group active?
      </Text>
      <Text style={{ color: subText, fontSize: 16, marginBottom: 32, textAlign: 'center' }}>
        The group will be automatically deleted after the end time
      </Text>

      {/* Start Time */}
      <Text style={{ color: text, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
        Start Time *
      </Text>
      <TouchableOpacity
        style={{
          backgroundColor: surface,
          borderRadius: 12,
          padding: 16,
          marginBottom: showStartPicker ? 0 : 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderWidth: showStartPicker ? 2 : 0,
          borderColor: IU_CRIMSON,
        }}
        onPress={() => {
          setShowEndPicker(false); // Close end picker if open
          setShowStartPicker(!showStartPicker);
        }}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <MaterialCommunityIcons name="calendar-clock" size={24} color={IU_CRIMSON} />
          <Text style={{ color: text, fontSize: 18, marginLeft: 12, fontWeight: showStartPicker ? '600' : '400' }}>
            {formatDateTime(startTime)}
          </Text>
        </View>
        <MaterialCommunityIcons 
          name={showStartPicker ? "chevron-up" : "chevron-down"} 
          size={24} 
          color={showStartPicker ? IU_CRIMSON : subText} 
        />
      </TouchableOpacity>

      {/* Start Time Picker - Appears directly under Start Time button */}
      {showStartPicker && (
        <View
          style={{
            backgroundColor: surface,
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: divider,
          }}
        >
          {Platform.OS === 'ios' ? (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ color: text, fontSize: 16, fontWeight: '600' }}>Select Start Time</Text>
                <TouchableOpacity
                  onPress={() => setShowStartPicker(false)}
                  style={{
                    backgroundColor: IU_CRIMSON,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={startTime}
                mode="datetime"
                display="spinner"
                onChange={handleStartTimeChange}
                minimumDate={new Date(Date.now() + 30 * 1000)}
                maximumDate={endTime}
                textColor={text}
              />
            </>
          ) : (
            <DateTimePicker
              value={startTime}
              mode="datetime"
              display="default"
              onChange={handleStartTimeChange}
              minimumDate={new Date(Date.now() + 30 * 1000)}
              maximumDate={endTime}
            />
          )}
        </View>
      )}

      {/* End Time */}
      <Text style={{ color: text, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
        End Time *
      </Text>
      <TouchableOpacity
        style={{
          backgroundColor: surface,
          borderRadius: 12,
          padding: 16,
          marginBottom: showEndPicker ? 0 : 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderWidth: showEndPicker ? 2 : 0,
          borderColor: IU_CRIMSON,
        }}
        onPress={() => {
          setShowStartPicker(false); // Close start picker if open
          setShowEndPicker(!showEndPicker);
        }}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <MaterialCommunityIcons name="calendar-clock" size={24} color={IU_CRIMSON} />
          <Text style={{ color: text, fontSize: 18, marginLeft: 12, fontWeight: showEndPicker ? '600' : '400' }}>
            {formatDateTime(endTime)}
          </Text>
        </View>
        <MaterialCommunityIcons 
          name={showEndPicker ? "chevron-up" : "chevron-down"} 
          size={24} 
          color={showEndPicker ? IU_CRIMSON : subText} 
        />
      </TouchableOpacity>

      {/* End Time Picker - Appears directly under End Time button */}
      {showEndPicker && (
        <View
          style={{
            backgroundColor: surface,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: divider,
          }}
        >
          {Platform.OS === 'ios' ? (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ color: text, fontSize: 16, fontWeight: '600' }}>Select End Time</Text>
                <TouchableOpacity
                  onPress={() => setShowEndPicker(false)}
                  style={{
                    backgroundColor: IU_CRIMSON,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={endTime}
                mode="datetime"
                display="spinner"
                onChange={handleEndTimeChange}
                minimumDate={startTime}
                textColor={text}
              />
            </>
          ) : (
            <DateTimePicker
              value={endTime}
              mode="datetime"
              display="default"
              onChange={handleEndTimeChange}
              minimumDate={startTime}
            />
          )}
        </View>
      )}

      {/* Navigation Buttons */}
      <Button
        mode="contained"
        buttonColor={IU_CRIMSON}
        textColor="#FFFFFF"
        onPress={() => {
          console.log('Next button pressed on step 2');
          handleNext();
        }}
        disabled={false}
        icon="arrow-right"
        contentStyle={{ flexDirection: 'row-reverse', paddingVertical: 8 }}
        style={{ 
          width: '100%', 
          marginTop: 24,
          opacity: canProceedFromStep() ? 1 : 0.6
        }}
      >
        Next
      </Button>
      <Button
        mode="outlined"
        textColor={text}
        onPress={handleBack}
        style={{ marginTop: 8, width: '100%' }}
        contentStyle={{ paddingVertical: 8 }}
      >
        Back
      </Button>
    </ScrollView>
  );

  // Render Step 3: Friends
  const renderStep3 = () => (
    <ScrollView 
      contentContainerStyle={{ padding: 16, paddingTop: 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={{ color: text, fontSize: 24, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
        Add Friends
      </Text>
      <Text style={{ color: subText, fontSize: 16, marginBottom: 32, textAlign: 'center' }}>
        Select friends to add to your group ({selectedFriends.size} selected)
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
                  <UserAvatar
                    size={40}
                    uri={friend.avatar}
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
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      <Appbar.Header mode="center-aligned" style={{ backgroundColor: background }}>
        <Appbar.Action icon="arrow-left" onPress={handleBack} color={text} />
        <Appbar.Content title={`Step ${currentStep} of 3`} color={text} />
        <View style={{ width: 40 }} />
      </Appbar.Header>

      {/* Progress Indicator */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 20, backgroundColor: background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', position: 'relative', paddingVertical: 2 }}>
          {[1, 2, 3].map((step, index) => (
            <React.Fragment key={step}>
              <View style={{ alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: currentStep >= step ? IU_CRIMSON : surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: currentStep >= step ? IU_CRIMSON : divider,
                  }}
                >
                  {currentStep > step ? (
                    <MaterialCommunityIcons name="check" size={20} color="#FFFFFF" />
                  ) : (
                    <Text style={{ color: currentStep >= step ? '#FFFFFF' : subText, fontWeight: '600', fontSize: 16 }}>
                      {step}
                    </Text>
                  )}
                </View>
              </View>
              {index < 2 && (
                <View style={{ flex: 1, height: 2, marginHorizontal: 4, position: 'relative', justifyContent: 'center' }}>
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      height: 2,
                      backgroundColor: divider,
                      zIndex: 0,
                    }}
                  />
                  {currentStep > step && (
                    <View
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        height: 2,
                        backgroundColor: IU_CRIMSON,
                        zIndex: 1,
                      }}
                    />
                  )}
                </View>
              )}
            </React.Fragment>
          ))}
        </View>
      </View>

      {/* Step Content */}
      <View style={{ flex: 1, width: '100%' }}>
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </View>

      {/* Navigation Buttons - Only show for step 3 */}
      {currentStep === 3 && (
        <View style={{ 
          padding: 16, 
          paddingBottom: Math.max(80, insets.bottom + 80),
          backgroundColor: background, 
          borderTopWidth: 1, 
          borderTopColor: divider,
          width: '100%'
        }}>
          <Button
            mode="contained"
            buttonColor={IU_CRIMSON}
            textColor="#FFFFFF"
            onPress={handleCreateGroup}
            disabled={
              creating ||
              selectedFriends.size === 0 ||
              !user ||
              !user.uid
            }
            loading={creating}
            icon="account-plus"
            style={{ marginBottom: 8, width: '100%' }}
            contentStyle={{ paddingVertical: 8 }}
          >
            {creating ? 'Creating...' : `Create Group (${selectedFriends.size} member${selectedFriends.size !== 1 ? 's' : ''})`}
          </Button>
          <Button
            mode="outlined"
            textColor={text}
            onPress={handleBack}
            style={{ marginTop: 8, width: '100%' }}
            contentStyle={{ paddingVertical: 8 }}
          >
            Back
          </Button>
        </View>
      )}
    </View>
  );
}

