// Activity Main screen - shows polls, trending locations, and events
import * as React from 'react';
import { ScrollView, View, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import TonightSelector from '../components/TonightSelector';
import EventCard from '../components/EventCard';
import TrendingSection from '../components/TrendingSection';
import CreateEventModal from '../components/CreateEventModal';
import { events, feedPosts } from '../data/mock';
import { useThemeColors } from '../hooks/useThemeColors';
import { useAuth } from '../context/AuthContext';

const SectionHeader = ({ title, textColor }) => (
  <Text variant="titleLarge" style={{ color: textColor, marginBottom: 12 }}>{title}</Text>
);

export default function ActivityMain() {
  const [selectedLocation, setSelectedLocation] = React.useState(null);
  const [createEventVisible, setCreateEventVisible] = React.useState(false);
  const [localEvents, setLocalEvents] = React.useState(events);
  const { background, text, subText } = useThemeColors();
  const { user, userData } = useAuth();

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
      {localEvents.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {localEvents.map((e, index) => (
            <EventCard key={e.id || index} event={e} onJoin={() => {}} onSave={() => {}} />
          ))}
        </ScrollView>
      ) : null}

      {/* Create Event Modal */}
      <CreateEventModal
        visible={createEventVisible}
        onClose={() => setCreateEventVisible(false)}
        onSubmit={async (eventData) => {
          // Create new event object
          const newEvent = {
            id: Date.now().toString(), // Simple ID generation
            title: eventData.name,
            description: eventData.description,
            location: eventData.location,
            host: eventData.host,
            image: eventData.photo || 'https://via.placeholder.com/280x140?text=Event',
            time: new Date().toLocaleDateString(), // Default time
            createdAt: new Date(),
          };
          
          // Add to local events
          setLocalEvents([newEvent, ...localEvents]);
          
          // Close modal
          setCreateEventVisible(false);
          
          // TODO: Save to Firebase in the future
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


