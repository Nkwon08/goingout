import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from 'react-native-paper';
import PollCard from '../components/PollCard';
import EventCard from '../components/EventCard';
import TrendingSection from '../components/TrendingSection';
import { polls, events, feedPosts } from '../data/mock';
import { useThemeColors } from '../hooks/useThemeColors';

const SectionHeader = ({ title, textColor }) => (
  <Text variant="titleLarge" style={{ color: textColor, marginBottom: 12 }}>{title}</Text>
);

export default function ActivityMain() {
  const [selectedLocation, setSelectedLocation] = React.useState(null);
  const { background, text } = useThemeColors();

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
      <SectionHeader title="Where's everyone going tonight?" textColor={text} />
      {polls.length > 0 && <PollCard poll={polls[0]} onVote={() => {}} />}

      <View style={{ height: 24 }} />
      <TrendingSection
        trendingLocations={trendingLocations}
        onLocationPress={setSelectedLocation}
        selectedLocation={selectedLocation}
      />

      <View style={{ height: 24 }} />
      <SectionHeader title="Upcoming Events Near You" textColor={text} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
        {events.map((e) => (
          <EventCard key={e.id} event={e} onJoin={() => {}} onSave={() => {}} />
        ))}
      </ScrollView>
    </ScrollView>
  );
}


