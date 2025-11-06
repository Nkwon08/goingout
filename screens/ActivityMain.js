// Activity Main screen - shows polls, trending locations, and events
import * as React from 'react';
import { ScrollView, View, TouchableOpacity, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import TonightSelector from '../components/TonightSelector';
import EventCard from '../components/EventCard';
import TrendingSection from '../components/TrendingSection';
import CreateEventModal from '../components/CreateEventModal';
import { events, feedPosts } from '../data/mock';
import { useThemeColors } from '../hooks/useThemeColors';
import { useAuth } from '../context/AuthContext';
import { createEvent, subscribeToUpcomingEvents, joinEvent, updateEvent, deleteEvent } from '../services/eventsService';
import { checkFriendship } from '../services/friendsService';

const SectionHeader = ({ title, textColor }) => (
  <Text variant="titleLarge" style={{ color: textColor, marginBottom: 12 }}>{title}</Text>
);

export default function ActivityMain() {
  const [selectedLocation, setSelectedLocation] = React.useState(null);
  const [createEventVisible, setCreateEventVisible] = React.useState(false);
  const [editEvent, setEditEvent] = React.useState(null);
  const [localEvents, setLocalEvents] = React.useState([]);
  const [loadingEvents, setLoadingEvents] = React.useState(true);
  const { background, text, subText } = useThemeColors();
  const { user, userData } = useAuth();

  // Load events from Firebase on mount and subscribe to real-time updates
  React.useEffect(() => {
    if (!user?.uid) {
      // If not logged in, use mock events
      setLocalEvents(events);
      setLoadingEvents(false);
      return;
    }

    // Subscribe to real-time events from Firebase
    const unsubscribe = subscribeToUpcomingEvents(async ({ events: firebaseEvents, error }) => {
      if (error) {
        console.error('Error loading events:', error);
        // Fallback to mock events if Firebase fails
        setLocalEvents(events);
        setLoadingEvents(false);
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
      setLocalEvents(uniqueEvents);
      setLoadingEvents(false);
    });

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid, userData?.friends]);

  // Filter events to only show upcoming events (not past their end time)
  const upcomingEvents = React.useMemo(() => {
    const now = new Date();
    
    return localEvents.filter((event) => {
      // If event has endTime and endDate/startDate/date fields
      if (event.endTime && (event.endDate || event.startDate || event.date)) {
        // Use endDate if available, otherwise fall back to startDate or date for backward compatibility
        const eventEndDate = event.endDate || event.startDate || event.date;
        // Combine date and endTime to create full end datetime
        const endDateTime = new Date(eventEndDate);
        // Extract time components from endTime (which is a Date object)
        endDateTime.setHours(event.endTime.getHours());
        endDateTime.setMinutes(event.endTime.getMinutes());
        endDateTime.setSeconds(event.endTime.getSeconds());
        endDateTime.setMilliseconds(0);
        
        // Only show if current time is before end time
        return now < endDateTime;
      }
      
      // For events without endTime/date (legacy/mock data), show them
      // You can remove this fallback if all events will have endTime/date
      return true;
    });
  }, [localEvents]);

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
    <ScrollView style={{ flex: 1, backgroundColor: background }} contentContainerStyle={{ padding: 16 }}>
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
            backgroundColor: '#990000',
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {upcomingEvents.map((e, index) => (
            <EventCard 
              key={e.id || index} 
              event={e} 
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
                    Alert.alert('Success', 'You have joined this event! You can now chat with other attendees in the Groups tab.');
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
        </ScrollView>
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

            Alert.alert('Success', 'Event updated successfully!');
            setCreateEventVisible(false);
            setEditEvent(null);
          } else {
            // Creating new event
            console.log('Creating event with data:', eventData);
            
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
              startTime: eventData.startTime,
              endTime: eventData.endTime,
            });

            if (result.error) {
              Alert.alert('Error', `Failed to create event: ${result.error}`);
              return;
            }

            console.log('Event created successfully with ID:', result.eventId);
            
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

          Alert.alert('Success', 'Event deleted successfully');
          setCreateEventVisible(false);
          setEditEvent(null);
        }}
      />
    </ScrollView>
  );
}


