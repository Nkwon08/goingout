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
import { createEvent, subscribeToUpcomingEvents } from '../services/eventsService';

const SectionHeader = ({ title, textColor }) => (
  <Text variant="titleLarge" style={{ color: textColor, marginBottom: 12 }}>{title}</Text>
);

export default function ActivityMain() {
  const [selectedLocation, setSelectedLocation] = React.useState(null);
  const [createEventVisible, setCreateEventVisible] = React.useState(false);
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
    const unsubscribe = subscribeToUpcomingEvents(({ events: firebaseEvents, error }) => {
      if (error) {
        console.error('Error loading events:', error);
        // Fallback to mock events if Firebase fails
        setLocalEvents(events);
      } else {
        // Combine Firebase events with mock events (for backward compatibility)
        // Filter out duplicates based on ID
        const allEvents = [...firebaseEvents, ...events];
        const uniqueEvents = allEvents.filter((event, index, self) =>
          index === self.findIndex((e) => e.id === event.id)
        );
        setLocalEvents(uniqueEvents);
      }
      setLoadingEvents(false);
    });

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid]);

  // Filter events to only show upcoming events (not past their end time)
  const upcomingEvents = React.useMemo(() => {
    const now = new Date();
    
    return localEvents.filter((event) => {
      // If event has endTime and date fields (new format)
      if (event.endTime && event.date) {
        // Combine date and endTime to create full end datetime
        const endDateTime = new Date(event.date);
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
            <EventCard key={e.id || index} event={e} onJoin={() => {}} onSave={() => {}} />
          ))}
        </ScrollView>
      ) : null}

      {/* Create Event Modal */}
      <CreateEventModal
        visible={createEventVisible}
        onClose={() => setCreateEventVisible(false)}
        onSubmit={async (eventData) => {
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
        }}
        currentUser={{
          ...(userData || { 
            name: user?.displayName || user?.email || 'User', 
            username: user?.email?.split('@')[0] || 'user'
          }),
          uid: user?.uid
        }}
      />
    </ScrollView>
  );
}


