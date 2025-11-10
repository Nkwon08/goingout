// Event Detail screen - view event details with join/edit/delete functionality
import * as React from 'react';
import { View, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { Appbar, Text, Button, Avatar, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useThemeColors } from '../hooks/useThemeColors';
import { useNavigation } from '@react-navigation/native';
import { getEventById, joinEvent, checkEventJoinStatus, updateEvent, deleteEvent } from '../services/eventsService';
import { getGroupById } from '../services/groupsService';
import CreateEventModal from '../components/CreateEventModal';
import AsyncStorage from '@react-native-async-storage/async-storage';

const IU_CRIMSON = '#CC0000';

export default function EventDetailScreen({ route, navigation }) {
  const { eventId, event } = route.params || {};
  
  const [eventData, setEventData] = React.useState(event || null);
  const [loading, setLoading] = React.useState(!event);
  const [joining, setJoining] = React.useState(false);
  const [hasJoined, setHasJoined] = React.useState(false);
  const [groupId, setGroupId] = React.useState(null);
  const [groupMembers, setGroupMembers] = React.useState([]);
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  
  const { isDarkMode } = useTheme();
  const { user, userData } = useAuth();
  const themeColors = useThemeColors();
  
  // Check if current user is the event creator
  const isCreator = user?.uid && eventData?.userId && String(user.uid) === String(eventData.userId);
  
  // Theme colors based on dark/light mode
  const bgColor = isDarkMode ? '#121212' : '#FAFAFA';
  const surfaceColor = isDarkMode ? '#2A2A2A' : '#F5F4F2';
  const textColor = isDarkMode ? '#E6E8F0' : '#1A1A1A';
  const subTextColor = isDarkMode ? '#8A90A6' : '#666666';
  const dividerColor = isDarkMode ? '#3A3A3A' : '#D0CFCD';

  // Load event data if only eventId is provided
  React.useEffect(() => {
    if (event) {
      setEventData(event);
      setLoading(false);
      return;
    }

    if (!eventId) {
      setLoading(false);
      return;
    }

    const loadEvent = async () => {
      try {
        setLoading(true);
        const { event: loadedEvent, error } = await getEventById(eventId);
        
        if (error) {
          console.error('Error loading event:', error);
          setEventData(null);
        } else {
          setEventData(loadedEvent);
        }
      } catch (error) {
        console.error('Error loading event:', error);
        setEventData(null);
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [eventId, event]);

  // Check join status and load group members
  React.useEffect(() => {
    if (!eventData?.id || !user?.uid) {
      return;
    }

    const checkStatus = async () => {
      const { joined, groupId: eventGroupId } = await checkEventJoinStatus(eventData.id, user.uid);
      setHasJoined(joined);
      setGroupId(eventGroupId || null);

      // Load group members if group exists
      if (eventGroupId) {
        const { group } = await getGroupById(eventGroupId);
        if (group?.members) {
          setGroupMembers(group.members);
        }
      }
    };

    checkStatus();
  }, [eventData?.id, user?.uid]);

  // Format date and time for display
  const formatDateTime = (date, time) => {
    if (!date || !time) return '';
    
    const dateObj = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
    const timeObj = time instanceof Date ? time : time.toDate ? time.toDate() : new Date(time);
    
    const dateStr = dateObj.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const timeStr = timeObj.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
    return { dateStr, timeStr };
  };

  // Format time range
  const formatTimeRange = (startTime, endTime) => {
    if (!startTime || !endTime) return '';
    
    const start = startTime instanceof Date ? startTime : startTime.toDate ? startTime.toDate() : new Date(startTime);
    const end = endTime instanceof Date ? endTime : endTime.toDate ? endTime.toDate() : new Date(endTime);
    
    const startStr = start.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
    const endStr = end.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
    return `${startStr} - ${endStr}`;
  };

  // Navigate to creator profile
  const handleCreatorPress = () => {
    if (!eventData?.creatorUsername) return;
    
    // Navigate up to find root navigator
    let rootNavigator = navigation;
    let parent = navigation.getParent();
    
    while (parent) {
      rootNavigator = parent;
      parent = parent.getParent();
    }
    
    // Navigate to the user profile modal
    rootNavigator.navigate('UserProfileModal', { 
      username: eventData.creatorUsername 
    });
  };

  // Handle join event
  const handleJoin = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'You must be logged in to join events.');
      return;
    }

    if (!eventData?.id) {
      Alert.alert('Error', 'Event information is missing.');
      return;
    }

    setJoining(true);
    try {
      const result = await joinEvent(eventData.id, user.uid);
      
      if (result.error) {
        Alert.alert('Error', result.error);
      } else {
        setHasJoined(true);
        setGroupId(result.groupId);
        
        // Reload group members
        if (result.groupId) {
          const { group } = await getGroupById(result.groupId);
          if (group?.members) {
            setGroupMembers(group.members);
          }
          
          // Navigate to Groups tab with groupId
          try {
            await AsyncStorage.setItem('pendingGroupId', result.groupId);
          } catch (storageError) {
            console.error('Error storing groupId:', storageError);
          }
          
          // Navigate up to find root navigator
          let rootNavigator = navigation;
          let parent = navigation.getParent();
          
          while (parent) {
            rootNavigator = parent;
            parent = parent.getParent();
          }
          
          // Navigate to Groups tab
          rootNavigator.navigate('Groups', {
            screen: 'GroupsMain',
            params: { groupId: result.groupId }
          });
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to join event. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  // Handle edit event
  const handleEdit = () => {
    setShowEditModal(true);
  };

  // Handle save edited event
  const handleSaveEdit = async (editedEventData) => {
    if (!user?.uid || !eventData?.id) {
      Alert.alert('Error', 'Unable to edit event.');
      return;
    }

    try {
      const result = await updateEvent(eventData.id, user.uid, editedEventData);
      
      if (result.error) {
        Alert.alert('Error', result.error);
      } else {
        // Reload event data
        const { event: updatedEvent } = await getEventById(eventData.id);
        if (updatedEvent) {
          setEventData(updatedEvent);
        }
        setShowEditModal(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update event. Please try again.');
    }
  };

  // Handle delete event
  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!user?.uid || !eventData?.id) {
      return;
    }

    setDeleting(true);
    try {
      const result = await deleteEvent(eventData.id, user.uid);
      
      if (result.error) {
        Alert.alert('Error', result.error);
      } else {
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to delete event. Please try again.');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: textColor }}>Loading event...</Text>
      </View>
    );
  }

  if (!eventData) {
    return (
      <View style={{ flex: 1, backgroundColor: bgColor }}>
        <Appbar.Header mode="center-aligned" style={{ backgroundColor: bgColor }}>
          <Appbar.Action icon="arrow-left" onPress={() => navigation.goBack()} color={textColor} />
          <Appbar.Content title="Event" color={textColor} />
        </Appbar.Header>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: textColor }}>Event not found</Text>
        </View>
      </View>
    );
  }

  const { dateStr, timeStr } = formatDateTime(eventData.date, eventData.startTime);
  const timeRange = formatTimeRange(eventData.startTime, eventData.endTime);

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      {/* Header */}
      <Appbar.Header mode="center-aligned" style={{ backgroundColor: bgColor }}>
        <Appbar.Action 
          icon="arrow-left" 
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              const parent = navigation.getParent();
              if (parent) {
                parent.goBack();
              }
            }
          }} 
          color={textColor} 
        />
        <Appbar.Content title="Event Details" color={textColor} />
      </Appbar.Header>
      
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Event Image */}
        <Image 
          source={{ uri: eventData.image || 'https://via.placeholder.com/400x200?text=Event' }} 
          style={{ 
            width: '100%', 
            height: 250,
            backgroundColor: surfaceColor,
          }}
          resizeMode="cover"
        />
        
        {/* Event Content */}
        <View style={{ padding: 16 }}>
          {/* Title */}
          <Text variant="headlineMedium" style={{ color: textColor, marginBottom: 8 }}>
            {eventData.title}
          </Text>
          
          {/* Host */}
          {eventData.host && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <MaterialCommunityIcons name="account" size={20} color={subTextColor} />
              <Text style={{ color: subTextColor, marginLeft: 8, fontSize: 16 }}>
                Host: {eventData.host}
              </Text>
            </View>
          )}
          
          {/* Creator */}
          {eventData.creatorName && (
            <TouchableOpacity 
              onPress={handleCreatorPress}
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
              activeOpacity={0.7}
            >
              <Avatar.Image 
                size={32} 
                source={{ uri: eventData.creatorAvatar || 'https://i.pravatar.cc/100?img=12' }} 
              />
              <View style={{ marginLeft: 12 }}>
                <Text style={{ color: subTextColor, fontSize: 12 }}>Created by</Text>
                <Text style={{ color: textColor, fontSize: 16, fontWeight: '500' }}>
                  {eventData.creatorName}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          
          {/* Divider */}
          <View style={{ 
            height: 1, 
            backgroundColor: dividerColor, 
            marginVertical: 16 
          }} />
          
          {/* Date */}
          {eventData.date && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <MaterialCommunityIcons name="calendar" size={24} color={IU_CRIMSON} />
              <View style={{ marginLeft: 12 }}>
                <Text style={{ color: textColor, fontSize: 18, fontWeight: '600' }}>
                  {dateStr}
                </Text>
                {timeRange && (
                  <Text style={{ color: subTextColor, fontSize: 14, marginTop: 4 }}>
                    {timeRange}
                  </Text>
                )}
              </View>
            </View>
          )}
          
          {/* Location */}
          {eventData.location && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <MaterialCommunityIcons name="map-marker" size={24} color={IU_CRIMSON} />
              <Text style={{ color: textColor, fontSize: 16, marginLeft: 12, flex: 1 }}>
                {eventData.location}
              </Text>
            </View>
          )}
          
          {/* Group Members Count */}
          {hasJoined && groupMembers.length > 0 && (
            <View style={{ marginTop: 12, marginBottom: 12 }}>
              <Text style={{ color: textColor, fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
                Attendees ({groupMembers.length})
              </Text>
              <Text style={{ color: subTextColor, fontSize: 14 }}>
                You're part of this event group! Chat with other attendees in the Groups tab.
              </Text>
            </View>
          )}
          
          {/* Divider */}
          <View style={{ 
            height: 1, 
            backgroundColor: dividerColor, 
            marginVertical: 16 
          }} />
          
          {/* Description */}
          {eventData.description && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: textColor, fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
                About
              </Text>
              <Text style={{ color: subTextColor, fontSize: 16, lineHeight: 24 }}>
                {eventData.description}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
      
      {/* Action Buttons */}
      <View style={{ 
        padding: 16, 
        backgroundColor: bgColor,
        borderTopWidth: 1,
        borderTopColor: dividerColor,
      }}>
        {isCreator ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button
              mode="contained"
              buttonColor={IU_CRIMSON}
              textColor="#FFFFFF"
              onPress={handleEdit}
              style={{ flex: 1 }}
              icon="pencil"
            >
              Edit Event
            </Button>
            <Button
              mode="outlined"
              textColor="#FF6B6B"
              onPress={handleDelete}
              loading={deleting}
              disabled={deleting}
              style={{ flex: 1 }}
              icon="delete"
            >
              Delete
            </Button>
          </View>
        ) : (
          <Button
            mode={hasJoined ? "outlined" : "contained"}
            buttonColor={hasJoined ? undefined : IU_CRIMSON}
            textColor={hasJoined ? textColor : "#FFFFFF"}
            onPress={handleJoin}
            loading={joining}
            disabled={joining || hasJoined}
            style={{ width: '100%' }}
            icon={hasJoined ? "check-circle" : "account-plus"}
          >
            {hasJoined ? 'Joined' : 'Join Event'}
          </Button>
        )}
      </View>

      {/* Edit Event Modal */}
      <CreateEventModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleSaveEdit}
        currentUser={{
          ...(userData || { 
            name: user?.displayName || user?.email || 'User', 
            username: user?.email?.split('@')[0] || 'user'
          }),
          uid: user?.uid
        }}
        event={eventData}
        isEditMode={true}
      />

      {/* Delete Confirmation Alert */}
      {showDeleteConfirm && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
        }}>
          <View style={{
            backgroundColor: bgColor,
            borderRadius: 16,
            padding: 24,
            width: '80%',
            maxWidth: 400,
          }}>
            <Text style={{ color: textColor, fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
              Delete Event?
            </Text>
            <Text style={{ color: subTextColor, fontSize: 14, marginBottom: 24 }}>
              Are you sure you want to delete this event? This action cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Button
                mode="outlined"
                textColor={textColor}
                onPress={() => setShowDeleteConfirm(false)}
                style={{ flex: 1 }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                buttonColor="#FF6B6B"
                textColor="#FFFFFF"
                onPress={confirmDelete}
                loading={deleting}
                disabled={deleting}
                style={{ flex: 1 }}
              >
                Delete
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
