import * as React from 'react';
import { View, ScrollView } from 'react-native';
import { FAB } from 'react-native-paper';
import FeedPost from '../components/FeedPost';
import TrendingSection from '../components/TrendingSection';
import ComposePost from '../components/ComposePost';
import { feedPosts as initialPosts } from '../data/mock';
import { useThemeColors } from '../hooks/useThemeColors';

const IU_CRIMSON = '#990000';

const currentUser = {
  name: 'You',
  user: 'you',
  avatar: 'https://i.pravatar.cc/100?img=12',
};

export default function ActivityRecent() {
  const [posts, setPosts] = React.useState(initialPosts);
  const [selectedLocation, setSelectedLocation] = React.useState(null);
  const [composeVisible, setComposeVisible] = React.useState(false);

  // Calculate trending locations
  const trendingLocations = React.useMemo(() => {
    const locationCounts = {};
    posts.forEach((post) => {
      if (post.location) {
        locationCounts[post.location] = (locationCounts[post.location] || 0) + 1;
      }
    });

    return Object.entries(locationCounts)
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [posts]);

  // Filter posts by location
  const filteredPosts = React.useMemo(() => {
    if (!selectedLocation) return posts;
    return posts.filter((post) => post.location === selectedLocation);
  }, [posts, selectedLocation]);

  // Generate new post ID
  const generateId = () => {
    return `post${Date.now()}`;
  };

  // Handle new post submission
  const handlePostSubmit = (postData) => {
    const newPost = {
      id: generateId(),
      name: currentUser.name,
      user: currentUser.user,
      avatar: currentUser.avatar,
      text: postData.text,
      location: postData.location || null,
      image: postData.image || null,
      images: postData.images || null,
      likes: 0,
      retweets: 0,
      replies: 0,
      timeAgo: 'now',
      liked: false,
      retweeted: false,
    };
    setPosts((prev) => [newPost, ...prev]);
  };

  const { background } = useThemeColors();

  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {filteredPosts.map((post) => (
          <FeedPost key={post.id} post={post} />
        ))}
      </ScrollView>

      <FAB
        icon="plus"
        style={{
          position: 'absolute',
          right: 16,
          bottom: 16,
          backgroundColor: IU_CRIMSON,
          borderRadius: 28,
        }}
        iconColor="#FFFFFF"
        onPress={() => setComposeVisible(true)}
        customSize={56}
      />

      <ComposePost
        visible={composeVisible}
        onClose={() => setComposeVisible(false)}
        onSubmit={handlePostSubmit}
        currentUser={currentUser}
      />
    </View>
  );
}


