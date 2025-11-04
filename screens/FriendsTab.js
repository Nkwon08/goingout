import * as React from 'react';
import { View, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Searchbar, Button, Avatar, List, Divider, Text } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { subscribeToFriends, addFriend, checkFriendship, getFriends } from '../services/friendsService';
import { getCurrentUserData as getUserData } from '../services/authService';
import { searchUsersByUsername } from '../services/usersService';

export default function FriendsTab() {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [friends, setFriends] = React.useState([]);
  const [friendsWithData, setFriendsWithData] = React.useState([]);
  const [searchResults, setSearchResults] = React.useState([]);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchResultsWithStatus, setSearchResultsWithStatus] = React.useState([]);
  const [loading, setLoading] = React.useState(false); // Start with false to show UI immediately

  const colors = {
    bg: isDarkMode ? '#1A1A1A' : '#EEEDEB',
    surface: isDarkMode ? '#2A2A2A' : '#F5F4F2',
    text: isDarkMode ? '#E6E8F0' : '#1A1A1A',
    subText: isDarkMode ? '#8A90A6' : '#666666',
    divider: isDarkMode ? '#3A3A3A' : '#D0CFCD',
    primary: '#990000',
  };

  /** Load friends list and fetch user data - optimized for fast initial load */
  React.useEffect(() => {
    if (!user) return;

    // Fast initial load: fetch friends list immediately (one-time read)
    let isMounted = true;
    let unsubscribe = null;

    const loadFriends = async () => {
      try {
        // Fetch initial friends list quickly (one-time read, faster than waiting for subscription)
        const initialResult = await getFriends(user.uid);
        if (!isMounted) return;

        const friendIds = initialResult.friends || [];
        setFriends(friendIds);

        if (!friendIds.length) {
          setFriendsWithData([]);
        } else {
          // Show placeholders immediately
          setFriendsWithData(friendIds.map((uid) => ({
            uid,
            username: 'Loading...',
            name: 'Loading...',
            avatar: null,
          })));

          // Fetch friend data in parallel (optimized)
          try {
            const friendData = await Promise.all(
              friendIds.map(async (uid) => {
                try {
                  const { userData } = await getUserData(uid);
                  return userData || { uid, username: 'Unknown', name: 'Unknown User', avatar: null };
                } catch {
                  return { uid, username: 'Unknown', name: 'Unknown User', avatar: null };
                }
              })
            );
            if (isMounted) {
              setFriendsWithData(friendData);
            }
          } catch (err) {
            console.error('Error fetching friend data:', err);
          }
        }
      } catch (err) {
        console.error('Error loading initial friends:', err);
      }

      // Then subscribe for real-time updates (non-blocking)
      unsubscribe = subscribeToFriends(user.uid, async (result) => {
        if (!isMounted) return;

        if (result.error) {
          console.error('Error in friends subscription:', result.error);
          return;
        }

        const friendIds = result.friends || [];
        setFriends(friendIds);

        if (!friendIds.length) {
          setFriendsWithData([]);
          return;
        }

        // Update placeholders if needed - use current state via callback
        setFriendsWithData((prev) => {
          const currentIds = new Set(prev.map(f => f.uid));
          const newIds = new Set(friendIds);
          const hasChanges = friendIds.length !== prev.length || 
            friendIds.some(id => !currentIds.has(id)) ||
            prev.some(f => !newIds.has(f.uid));

          if (!hasChanges) {
            return prev; // No changes, keep existing data
          }

          // Show placeholders for new friends, keep existing loaded data
          const prevMap = new Map(prev.map(f => [f.uid, f]));
          const updated = friendIds.map((uid) => {
            const existing = prevMap.get(uid);
            if (existing && existing.username !== 'Loading...') {
              return existing; // Keep loaded data
            }
            return {
              uid,
              username: 'Loading...',
              name: 'Loading...',
              avatar: null,
            };
          });

          // Fetch data for new friends only (in background)
          const newFriendIds = friendIds.filter(id => !currentIds.has(id));
          if (newFriendIds.length > 0) {
            // Don't await - fetch in background
            Promise.all(
              newFriendIds.map(async (uid) => {
                try {
                  const { userData } = await getUserData(uid);
                  return userData || { uid, username: 'Unknown', name: 'Unknown User', avatar: null };
                } catch {
                  return { uid, username: 'Unknown', name: 'Unknown User', avatar: null };
                }
              })
            ).then((newFriendData) => {
              if (isMounted) {
                // Use current friendIds from the latest subscription update
                setFriendsWithData((current) => {
                  const currentMap = new Map(current.map(f => [f.uid, f]));
                  newFriendData.forEach(f => currentMap.set(f.uid, f));
                  // Use the latest friendIds from state (setFriends was called earlier)
                  const latestFriendIds = friendIds; // Captured from subscription callback
                  return latestFriendIds.map(uid => currentMap.get(uid) || {
                    uid,
                    username: 'Loading...',
                    name: 'Loading...',
                    avatar: null,
                  });
                });
              }
            }).catch((err) => {
              console.error('Error fetching new friend data:', err);
            });
          }

          return updated;
        });
      });
    };

    loadFriends();

    return () => {
      isMounted = false;
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [user]);

  /** Handle user search with debounce */
  React.useEffect(() => {
    if (!user) return;
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchResultsWithStatus([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const result = await searchUsersByUsername(searchQuery.trim());
        const users = Array.isArray(result?.users) ? result.users : [];
        const filtered = users.filter((u) => u?.uid !== user.uid);

        // Optimistic UI - use cached friends list if available (optimized)
        const friendsSet = new Set(friends);
        setSearchResults(filtered);
        setSearchResultsWithStatus(
          filtered.map((u) => ({
            ...u,
            isFriend: friendsSet.has(u.uid), // Optimized: uses cached friends array
          }))
        );

        // Background check if friends list not loaded yet (fallback)
        if (!friends.length) {
          const statuses = await Promise.all(
            filtered.map(async (u) => {
              try {
                // Query Firestore when friends array not available
                const isFriend = await checkFriendship(user.uid, u.uid);
                return { uid: u.uid, isFriend };
              } catch {
                return { uid: u.uid, isFriend: false };
              }
            })
          );
          setSearchResultsWithStatus((prev) =>
            prev.map((u) => {
              const status = statuses.find((s) => s.uid === u.uid);
              return status ? { ...u, isFriend: status.isFriend } : u;
            })
          );
        }
      } catch (err) {
        console.error('Search error:', err);
        setSearchResults([]);
        setSearchResultsWithStatus([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery, user, friends]);

  /** Add a friend */
  const handleAddFriend = React.useCallback(async (targetUid) => {
    if (!user || targetUid === user.uid) return;
    try {
      const result = await addFriend(user.uid, targetUid);
      if (result.success || result.error === 'Already friends') {
        Alert.alert('Success', 'Friend added!', [{ text: 'OK' }]);
        setSearchResultsWithStatus((prev) =>
          prev.map((u) => (u.uid === targetUid ? { ...u, isFriend: true } : u))
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to add friend', [{ text: 'OK' }]);
      }
    } catch (err) {
      console.error('Error adding friend:', err);
      Alert.alert('Error', 'Failed to add friend. Please try again.', [{ text: 'OK' }]);
    }
  }, [user]);

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.subText }}>Please sign in to view friends</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Search */}
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Find Friends</Text>
        <Searchbar
          placeholder="Search by username..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={{ backgroundColor: colors.surface, marginBottom: 12 }}
          inputStyle={{ color: colors.text }}
          iconColor={colors.subText}
          placeholderTextColor={colors.subText}
        />

        {/* Search Results */}
        {searchQuery.trim() ? (
          <View style={{ marginBottom: 24 }}>
            {searchLoading ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ color: colors.subText, marginTop: 8, fontSize: 14 }}>Searching...</Text>
              </View>
            ) : searchResultsWithStatus.length ? (
              <View style={{ backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' }}>
                {searchResultsWithStatus.map((u, idx) => (
                  <View key={u.uid}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                        <Avatar.Image size={40} source={{ uri: u.avatar || 'https://i.pravatar.cc/100?img=12' }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{u.name || 'Unknown User'}</Text>
                          <Text style={{ color: colors.subText, fontSize: 12 }}>@{u.username || 'unknown'}</Text>
                        </View>
                      </View>
                      {u.isFriend ? (
                        <Button mode="outlined" textColor={colors.subText} compact disabled icon="account-check">Friends</Button>
                      ) : (
                        <Button mode="contained" buttonColor={colors.primary} textColor="#fff" compact onPress={() => handleAddFriend(u.uid)} icon="account-plus">Add Friend</Button>
                      )}
                    </View>
                    {idx < searchResultsWithStatus.length - 1 && <Divider style={{ backgroundColor: colors.divider }} />}
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: colors.subText, textAlign: 'center', fontSize: 14, marginBottom: 8 }}>No users found</Text>
                <Text style={{ color: colors.subText, textAlign: 'center', fontSize: 12 }}>Check spelling or try another username</Text>
              </View>
            )}
          </View>
        ) : null}

        {/* Friends List */}
        <Text style={{ color: colors.subText, marginVertical: 6, fontSize: 14, fontWeight: '600' }}>Friends ({friendsWithData.length})</Text>
        {friendsWithData.length ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 16 }}>
            {friendsWithData.map((f, idx) => (
              <View key={f.uid || idx}>
                <List.Item
                  title={f.name || 'Unknown User'}
                  description={`@${f.username || 'unknown'}`}
                  titleStyle={{ color: colors.text }}
                  descriptionStyle={{ color: colors.subText, fontSize: 12 }}
                  left={() => <Avatar.Image size={36} source={{ uri: f.avatar || 'https://i.pravatar.cc/100?img=12' }} />}
                />
                {idx < friendsWithData.length - 1 && <Divider style={{ backgroundColor: colors.divider }} />}
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: colors.subText, textAlign: 'center', padding: 10 }}>Empty</Text>
        )}
      </ScrollView>
    </View>
  );
}
