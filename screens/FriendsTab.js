import * as React from 'react';
import { View, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Searchbar, Button, Avatar, List, Divider, Text } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { addFriend, checkFriendship, getFriends, sendFriendRequest } from '../services/friendsService';
import { getCurrentUserData as getUserData } from '../services/authService';
import { searchUsersByUsername, getAllUsers } from '../services/usersService';

export default function FriendsTab() {
  const { isDarkMode } = useTheme();
  const { user, loading: authLoading, friendsList: friendsListFromContext } = useAuth();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [friends, setFriends] = React.useState([]);
  const [friendsWithData, setFriendsWithData] = React.useState([]);
  const [searchResults, setSearchResults] = React.useState([]);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchResultsWithStatus, setSearchResultsWithStatus] = React.useState([]);
  const [loading, setLoading] = React.useState(false); // Start with false to show UI immediately
  
  // All users list state (for displaying all users)
  const [allUsers, setAllUsers] = React.useState([]);
  const [allUsersLoading, setAllUsersLoading] = React.useState(false);
  const [allUsersLastId, setAllUsersLastId] = React.useState(null);
  const [allUsersHasMore, setAllUsersHasMore] = React.useState(true);

  const colors = {
    bg: isDarkMode ? '#1A1A1A' : '#EEEDEB',
    surface: isDarkMode ? '#2A2A2A' : '#F5F4F2',
    text: isDarkMode ? '#E6E8F0' : '#1A1A1A',
    subText: isDarkMode ? '#8A90A6' : '#666666',
    divider: isDarkMode ? '#3A3A3A' : '#D0CFCD',
    primary: '#990000',
  };

  /** Load friends list from AuthContext - subscription is managed centrally */
  React.useEffect(() => {
    // Use friends list from AuthContext (centralized subscription)
    const friendIds = friendsListFromContext || [];
    setFriends(friendIds);

    if (!friendIds.length) {
      setFriendsWithData([]);
      return;
    }

    // Fetch friend data in parallel
    let isMounted = true;

    const loadFriendData = async () => {
      try {
        // Show placeholders immediately
        setFriendsWithData(friendIds.map((uid) => ({
          uid,
          username: 'Loading...',
          name: 'Loading...',
          avatar: null,
        })));

        // Fetch friend data in parallel
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
    };

    loadFriendData();

    return () => {
      isMounted = false;
    };
  }, [friendsListFromContext]); // Re-fetch when friends list changes from context

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

  /** Load all users (for "Discover" section when search is empty) */
  React.useEffect(() => {
    // Wait for auth to be fully initialized
    if (authLoading) {
      return; // Still loading auth state
    }
    
    // Wait for auth to be fully initialized and user to be signed in
    if (!user || !user.uid) {
      console.log('ℹ️ No user signed in - skipping user fetch');
      return;
    }
    
    const loadAllUsers = async (retryCount = 0) => {
      const maxRetries = 3;
      setAllUsersLoading(true);
      
      try {
        // Force fresh data from server (bypasses cache)
        const result = await getAllUsers(user.uid, 20, null);
        
        if (result.error) {
          // If network error and retries remaining, retry after delay
          if (result.error.includes('Unable to connect') && retryCount < maxRetries) {
            console.log(`⚠️ Network error, retrying... (${retryCount + 1}/${maxRetries})`);
            setTimeout(() => {
              loadAllUsers(retryCount + 1);
            }, 1000 * (retryCount + 1)); // Exponential backoff: 1s, 2s, 3s
            return;
          }
          console.error('Error loading users:', result.error);
        } else {
          setAllUsers(result.users);
          setAllUsersLastId(result.lastUserId);
          setAllUsersHasMore(result.hasMore);
        }
      } catch (err) {
        // Retry on error if retries remaining
        if (retryCount < maxRetries) {
          console.log(`⚠️ Error loading users, retrying... (${retryCount + 1}/${maxRetries})`);
          setTimeout(() => {
            loadAllUsers(retryCount + 1);
          }, 1000 * (retryCount + 1));
          return;
        }
        console.error('Error loading all users:', err);
      } finally {
        if (retryCount === 0) {
          // Only set loading to false on first attempt or final retry
          setAllUsersLoading(false);
        }
      }
    };

    // Only load if search is empty
    if (!searchQuery.trim()) {
      loadAllUsers();
    }
  }, [user, searchQuery, authLoading]);

  /** Load more users (pagination) */
  const loadMoreUsers = React.useCallback(async (retryCount = 0) => {
    const maxRetries = 3;
    
    // Safety checks
    if (!user || !user.uid) {
      console.log('ℹ️ No user signed in - skipping load more');
      return;
    }
    
    if (!allUsersHasMore || allUsersLoading || !allUsersLastId) return;

    setAllUsersLoading(true);
    try {
      const result = await getAllUsers(user.uid, 20, allUsersLastId);
      
      if (result.error) {
        // Retry on network errors
        if (result.error.includes('Unable to connect') && retryCount < maxRetries) {
          console.log(`⚠️ Network error loading more, retrying... (${retryCount + 1}/${maxRetries})`);
          setTimeout(() => {
            loadMoreUsers(retryCount + 1);
          }, 1000 * (retryCount + 1));
          return;
        }
        console.error('Error loading more users:', result.error);
      } else {
        setAllUsers((prev) => [...prev, ...result.users]);
        setAllUsersLastId(result.lastUserId);
        setAllUsersHasMore(result.hasMore);
      }
    } catch (err) {
      // Retry on error
      if (retryCount < maxRetries) {
        console.log(`⚠️ Error loading more users, retrying... (${retryCount + 1}/${maxRetries})`);
        setTimeout(() => {
          loadMoreUsers(retryCount + 1);
        }, 1000 * (retryCount + 1));
        return;
      }
      console.error('Error loading more users:', err);
    } finally {
      if (retryCount === 0) {
        setAllUsersLoading(false);
      }
    }
  }, [user, allUsersLastId, allUsersHasMore, allUsersLoading]);

  /** Send a friend request */
  const handleSendFriendRequest = React.useCallback(async (targetUid) => {
    if (!user || targetUid === user.uid) return;
    try {
      const result = await sendFriendRequest(targetUid);
      if (result.success) {
        Alert.alert('Success', 'Friend request sent!', [{ text: 'OK' }]);
        setSearchResultsWithStatus((prev) =>
          prev.map((u) => (u.uid === targetUid ? { ...u, requestSent: true } : u))
        );
        // Also update allUsers list
        setAllUsers((prev) =>
          prev.map((u) => (u.uid === targetUid ? { ...u, requestSent: true } : u))
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to send friend request', [{ text: 'OK' }]);
      }
    } catch (err) {
      console.error('Error sending friend request:', err);
      Alert.alert('Error', 'Failed to send friend request. Please try again.', [{ text: 'OK' }]);
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
                      ) : u.requestSent ? (
                        <Button mode="outlined" textColor={colors.subText} compact disabled icon="account-plus">Request Sent</Button>
                      ) : (
                        <Button mode="contained" buttonColor={colors.primary} textColor="#fff" compact onPress={() => handleSendFriendRequest(u.uid)} icon="account-plus">Send Request</Button>
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
        ) : (
          // All Users List (when search is empty)
          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Discover Users</Text>
            {allUsersLoading && allUsers.length === 0 ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ color: colors.subText, marginTop: 8, fontSize: 14 }}>Loading users...</Text>
              </View>
            ) : allUsers.length > 0 ? (
              <View style={{ backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' }}>
                {allUsers.map((u, idx) => (
                  <View key={u.uid}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <Avatar.Image size={48} source={{ uri: u.avatar || 'https://i.pravatar.cc/100?img=12' }} />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{u.name || 'User'}</Text>
                          <Text style={{ color: colors.subText, fontSize: 14 }}>@{u.username || 'username'}</Text>
                          {u.bio && (
                            <Text style={{ color: colors.subText, fontSize: 12, marginTop: 4 }} numberOfLines={2}>
                              {u.bio}
                            </Text>
                          )}
                          {(u.age || u.gender) && (
                            <View style={{ flexDirection: 'row', marginTop: 4, gap: 8 }}>
                              {u.age && (
                                <Text style={{ color: colors.subText, fontSize: 12 }}>{u.age} years old</Text>
                              )}
                              {u.gender && (
                                <Text style={{ color: colors.subText, fontSize: 12 }}>{u.gender}</Text>
                              )}
                            </View>
                          )}
                        </View>
                      </View>
                      {friends.includes(u.uid) ? (
                        <Button mode="outlined" textColor={colors.subText} compact disabled icon="account-check">Friends</Button>
                      ) : u.requestSent ? (
                        <Button mode="outlined" textColor={colors.subText} compact disabled icon="account-plus">Request Sent</Button>
                      ) : (
                        <Button mode="contained" buttonColor={colors.primary} textColor="#fff" compact onPress={() => handleSendFriendRequest(u.uid)} icon="account-plus">Send Request</Button>
                      )}
                    </View>
                    {idx < allUsers.length - 1 && <Divider style={{ backgroundColor: colors.divider }} />}
                  </View>
                ))}
                {allUsersHasMore && (
                  <View style={{ padding: 16, alignItems: 'center' }}>
                    <Button
                      mode="outlined"
                      onPress={loadMoreUsers}
                      loading={allUsersLoading}
                      disabled={allUsersLoading}
                      textColor={colors.text}
                      style={{ borderColor: colors.divider }}
                    >
                      {allUsersLoading ? 'Loading...' : 'Load More'}
                    </Button>
                  </View>
                )}
              </View>
            ) : (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: colors.subText, textAlign: 'center', fontSize: 14 }}>No users found</Text>
              </View>
            )}
          </View>
        )}

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
