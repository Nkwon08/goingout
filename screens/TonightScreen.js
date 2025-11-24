// Tonight screen - shows polls, trending locations, and events
import * as React from 'react';
import { ScrollView, View, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import TonightSelector from '../components/TonightSelector';
import EventCard from '../components/EventCard';
import TrendingSection from '../components/TrendingSection';
import CreateEventModal from '../components/CreateEventModal';
import { events, feedPosts } from '../data/mock';
import { useThemeColors } from '../hooks/useThemeColors';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { createEvent, subscribeToUpcomingEvents, joinEvent, updateEvent, deleteEvent, checkEventJoinStatus } from '../services/eventsService';
import { checkFriendship } from '../services/friendsService';
import { useNavigation, CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SectionHeader = ({ title, textColor }) => (
  <Text variant="titleLarge" style={{ color: textColor, marginBottom: 12 }}>{title}</Text>
);

export default function TonightScreen() {
  const [selectedLocation, setSelectedLocation] = React.useState(null);
  const [createEventVisible, setCreateEventVisible] = React.useState(false);
  const [editEvent, setEditEvent] = React.useState(null);
  const [localEvents, setLocalEvents] = React.useState([]);
  const [loadingEvents, setLoadingEvents] = React.useState(true);
  const [joinedEventIds, setJoinedEventIds] = React.useState(new Set());
  const [refreshing, setRefreshing] = React.useState(false);
  const { background, text, subText } = useThemeColors();
  const { isDarkMode } = useTheme();
  const { user, userData } = useAuth();
  const navigation = useNavigation();

  // Load events from Firebase on mount and subscribe to real-time updates
  React.useEffect(() => {
    if (!user?.uid) {
      // If not logged in, use mock events
      setLocalEvents(events);
      setLoadingEvents(false);
      setRefreshing(false);
      return;
    }

    // Subscribe to real-time events from Firebase
    const unsubscribe = subscribeToUpcomingEvents(async ({ events: firebaseEvents, error }) => {
      if (error) {
        console.error('Error loading events:', error);
        // Fallback to mock events if Firebase fails
        setLocalEvents(events);
        setLoadingEvents(false);
        setRefreshing(false);
        return;
      }

      // Filter events based on friendsOnly setting
      const filteredEvents = [];
      const friendsList = userData?.friends || []; // Array of usernames
      
      for (const event of firebaseEvents) {
        // If event is friendsOnly, check if current user is a friend of the creator
        if (event.friendsOnly) {
          // Check if current user is the creator (always show own events)
          if (event.userId === user.uid) {
            filteredEvents.push(event);
          } else {
            // Check if creator's username is in friends list
            const creatorUsername = event.creatorUsername;
            const isFriend = creatorUsername && friendsList.includes(creatorUsername);
            if (isFriend) {
              filteredEvents.push(event);
            }
          }
        } else {
          // Public events - show to everyone
          filteredEvents.push(event);
        }
      }

      // Combine Firebase events with mock events (for backward compatibility)
      // Filter out duplicates based on ID
      const allEvents = [...filteredEvents, ...events];
      const uniqueEvents = allEvents.filter((event, index, self) =>
        index === self.findIndex((e) => e.id === event.id)
      );
      
      // Check which events the user has joined
      if (user?.uid) {
        const joinStatusChecks = uniqueEvents.map(async (event) => {
          const { joined } = await checkEventJoinStatus(event.id, user.uid);
          return { eventId: event.id, joined };
        });
        
        const joinStatuses = await Promise.all(joinStatusChecks);
        const joinedIds = new Set(joinStatuses.filter(s => s.joined).map(s => s.eventId));
        setJoinedEventIds(joinedIds);
      }
      
      setLocalEvents(uniqueEvents);
      setLoadingEvents(false);
      setRefreshing(false);
    });

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid, userData?.friends]);

  // Handle refresh
  const handleRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Force re-subscription by updating a dependency
    // The subscription will automatically reload events
    setTimeout(() => {
      setRefreshing(false);
    }, 500);
  }, []);

  // Filter events to only show upcoming events (not past their end time) and exclude joined events
  const upcomingEvents = React.useMemo(() => {
    const now = new Date();
    
    const filtered = localEvents.filter((event) => {
      // Don't show events the user has joined (except events they created)
      // Users should still see their own events even if they've joined them
      if (joinedEventIds.has(event.id) && event.userId !== user?.uid) {
        return false;
      }
      
      // If event has endTime, use it directly (endTime is already a full datetime)
      if (event.endTime) {
        // Convert endTime to Date if it's a Timestamp or other format
        let endDateTime;
        if (event.endTime instanceof Date) {
          endDateTime = event.endTime;
        } else if (event.endTime?.toDate) {
          endDateTime = event.endTime.toDate();
        } else if (typeof event.endTime === 'string' || typeof event.endTime === 'number') {
          endDateTime = new Date(event.endTime);
        } else {
          // Fallback: try to use endDate + endTime if endTime is just a time
          if (event.endDate || event.startDate || event.date) {
            const eventEndDate = event.endDate || event.startDate || event.date;
            endDateTime = new Date(eventEndDate);
            if (event.endTime && typeof event.endTime === 'object' && !(event.endTime instanceof Date)) {
              // If endTime has getHours method, extract time components
              if (typeof event.endTime.getHours === 'function') {
                endDateTime.setHours(event.endTime.getHours());
                endDateTime.setMinutes(event.endTime.getMinutes());
                endDateTime.setSeconds(event.endTime.getSeconds());
                endDateTime.setMilliseconds(0);
              }
            }
          } else {
            // No endTime or endDate available, show the event (legacy data)
            return true;
          }
        }
        
        // Only show if current time is before end time
        return now < endDateTime;
      }
      
      // For events without endTime (legacy/mock data), show them
      return true;
    });
    
    return filtered;
  }, [localEvents, joinedEventIds, user?.uid]);

  // Calculate trending locations from feed posts
  const trendingLocations = React.useMemo(() => {
    const locationCounts = {};
    feedPosts.forEach((post) => {
      if (post.location) {
        locationCounts[post.location] = (locationCounts[post.location] || 0) + 1;
      }
    });

    return Object.entries(locationCounts)
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, []);

  return (
    <LinearGradient
      colors={isDarkMode ? ['#1a0000', '#121212', '#0a0000'] : ['#ffe5e5', '#FAFAFA', '#fff5f5']}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#CC0000"
            />
          }
        >
          <TonightSelector />

          <View style={{ height: 24 }} />
          {trendingLocations.length > 0 && (
            <TrendingSection
              trendingLocations={trendingLocations}
              onLocationPress={setSelectedLocation}
              selectedLocation={selectedLocation}
            />
          )}

          <View style={{ height: 24 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <SectionHeader title="Upcoming Events Near You" textColor={text} />
            </View>
            <TouchableOpacity
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#CC0000',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              onPress={() => setCreateEventVisible(true)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="plus" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          {upcomingEvents.length > 0 ? (
            <View style={{ gap: 12 }}>
              {upcomingEvents.map((e, index) => (
                <EventCard 
                  key={e.id || index} 
                  event={e} 
                  style={{ width: '100%' }}
                  onJoin={async (eventId) => {
                    if (!user?.uid) {
                      Alert.alert('Error', 'You must be logged in to join events.');
                      return;
                    }

                    try {
                      const result = await joinEvent(eventId, user.uid);
                      
                      if (result.error) {
                        Alert.alert('Error', result.error);
                      } else {
                        // Remove event from feed
                        setJoinedEventIds(prev => new Set([...prev, eventId]));
                        
                        // Navigate to Groups tab with groupId
                        if (result.groupId) {
                          try {
                            await AsyncStorage.setItem('pendingGroupId', result.groupId);
                          } catch (storageError) {
                            console.error('Error storing groupId:', storageError);
                          }
                          
                          // Navigate to Groups tab (TonightScreen is inside BottomTabs)
                          navigation.navigate('Groups', {
                            screen: 'GroupsMain',
                            params: { groupId: result.groupId }
                          });
                        }
                      }
                    } catch (error) {
                        Alert.alert('Error', 'Failed to join event. Please try again.');
                    }
                  }}
                  onEdit={(event) => {
                    setEditEvent(event);
                    setCreateEventVisible(true);
                  }}
                />
              ))}
            </View>
          ) : null}

          {/* Create/Edit Event Modal */}
          <CreateEventModal
            visible={createEventVisible}
            onClose={() => {
              setCreateEventVisible(false);
              setEditEvent(null);
            }}
            onSubmit={async (eventData) => {
              if (editEvent) {
                // Editing existing event
                if (!user?.uid) {
                  Alert.alert('Error', 'You must be logged in to edit events.');
                  return;
                }

                const result = await updateEvent(editEvent.id, user.uid, {
                  name: eventData.name,
                  description: eventData.description,
                  location: eventData.location,
                  host: eventData.host,
                  photo: eventData.photo,
                  date: eventData.date,
                  startTime: eventData.startTime,
                  endTime: eventData.endTime,
                  friendsOnly: eventData.friendsOnly || false,
                });
                
                if (result.error) {
                  Alert.alert('Error', `Failed to update event: ${result.error}`);
                  return;
                }

                setCreateEventVisible(false);
                setEditEvent(null);
              } else {
                // Creating new event
                if (!user?.uid) {
                  Alert.alert('Error', 'You must be logged in to create events.');
                  return;
                }

                // Save to Firebase
                const result = await createEvent(user.uid, userData || {
                  name: user?.displayName || user?.email || 'User',
                  username: userData?.username || user?.email?.split('@')[0] || 'user',
                  photoURL: userData?.photoURL || userData?.avatar || null,
                  avatar: userData?.avatar || null,
                }, {
                  name: eventData.name,
                  description: eventData.description,
                  location: eventData.location,
                  host: eventData.host,
                  photo: eventData.photo,
                  date: eventData.date,
                  startDate: eventData.startDate,
                  endDate: eventData.endDate,
                  startTime: eventData.startTime,
                  endTime: eventData.endTime,
                  friendsOnly: eventData.friendsOnly,
                });

                if (result.error) {
                  Alert.alert('Error', `Failed to create event: ${result.error}`);
                  return;
                }

                // Close modal
                setCreateEventVisible(false);
                
                // The event will automatically appear via the real-time subscription
              }
            }}
            currentUser={{
              ...(userData || { 
                name: user?.displayName || user?.email || 'User', 
                username: user?.email?.split('@')[0] || 'user'
              }),
              uid: user?.uid
            }}
            event={editEvent}
            isEditMode={!!editEvent}
            onDelete={async (eventId) => {
              if (!user?.uid) {
                Alert.alert('Error', 'You must be logged in to delete events.');
                return;
              }

              const result = await deleteEvent(eventId, user.uid);
              
              if (result.error) {
                Alert.alert('Error', result.error);
                return;
              }

              setCreateEventVisible(false);
              setEditEvent(null);
            }}
          />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

