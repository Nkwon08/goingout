// Activity Main screen - shows polls, trending locations, and events
import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from 'react-native-paper';
import TonightSelector from '../components/TonightSelector';
import EventCard from '../components/EventCard';
import TrendingSection from '../components/TrendingSection';
import { events, feedPosts } from '../data/mock';
import { useThemeColors } from '../hooks/useThemeColors';

const SectionHeader = ({ title, textColor }) => (
  <Text variant="titleLarge" style={{ color: textColor, marginBottom: 12 }}>{title}</Text>
);

export default function ActivityMain() {
  const [selectedLocation, setSelectedLocation] = React.useState(null);
  const { background, text, subText } = useThemeColors();

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
      {trendingLocations.length > 0 ? (
        <TrendingSection
          trendingLocations={trendingLocations}
          onLocationPress={setSelectedLocation}
          selectedLocation={selectedLocation}
        />
      ) : (
        <Text style={{ color: subText, textAlign: 'center', padding: 20 }}>Empty</Text>
      )}

      <View style={{ height: 24 }} />
      <SectionHeader title="Upcoming Events Near You" textColor={text} />
      {events.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {events.map((e) => (
            <EventCard key={e.id} event={e} onJoin={() => {}} onSave={() => {}} />
          ))}
        </ScrollView>
      ) : (
        <Text style={{ color: subText, textAlign: 'center', padding: 20 }}>Empty</Text>
      )}
    </ScrollView>
  );
}


