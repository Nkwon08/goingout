import * as React from 'react';
import { View, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Searchbar, Button, Avatar, List, Divider, Text } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { 
  subscribeToFriends, 
  addFriend,
  checkFriendship,
} from '../services/friendsService';
import { getCurrentUserData as getUserData } from '../services/authService';
import { searchUsersByUsername } from '../services/usersService';

export default function FriendsTab() {
  const [searchQuery, setSearchQuery] = React.useState(''); // Search query for user lookup
  const [friends, setFriends] = React.useState([]);
  const [friendsWithUserData, setFriendsWithUserData] = React.useState([]);
  const [searchResults, setSearchResults] = React.useState([]);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchResultsWithStatus, setSearchResultsWithStatus] = React.useState([]);
  const [loading, setLoading] = React.useState(false); // Start with false - show UI immediately
  const [loadingUserData, setLoadingUserData] = React.useState(false);
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  
  const bgColor = isDarkMode ? '#1A1A1A' : '#EEEDEB';
  const surfaceColor = isDarkMode ? '#2A2A2A' : '#F5F4F2';
  const textColor = isDarkMode ? '#E6E8F0' : '#1A1A1A';
  const subTextColor = isDarkMode ? '#8A90A6' : '#666666';
  const dividerColor = isDarkMode ? '#3A3A3A' : '#D0CFCD';

  // Removed friend requests subscription - using direct add friend now

  // Subscribe to friends list
  React.useEffect(() => {
    if (!user) {
      return;
    }

    const unsubscribe = subscribeToFriends(user.uid, (result) => {
      if (result.error) {
        console.error('❌ Error getting friends:', result.error);
        setLoading(false);
        return;
      }

      setFriends(result.friends);
      setLoading(false); // Stop loading spinner once we have friends list

      // Fetch user data for each friend in background
      if (result.friends.length > 0) {
        // Show friends immediately with placeholder data
        const friendsWithPlaceholders = result.friends.map((friendId) => ({
          username: 'Loading...',
          name: 'Loading...',
          avatar: null,
          uid: friendId,
        }));
        setFriendsWithUserData(friendsWithPlaceholders);

        // Fetch user data in parallel (faster)
        const userDataPromises = result.friends.map(async (friendId) => {
          try {
            const { userData } = await getUserData(friendId);
            return userData || { username: 'Unknown', name: 'Unknown User', avatar: null, uid: friendId };
          } catch (error) {
            console.error('Error fetching friend data:', error);
            return { username: 'Unknown', name: 'Unknown User', avatar: null, uid: friendId };
          }
        });
        
        // Update as data loads (don't wait for all)
        Promise.all(userDataPromises).then((friendsWithData) => {
          setFriendsWithUserData(friendsWithData);
        });
      } else {
        setFriendsWithUserData([]);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Removed accept/decline handlers - using direct add friend now

  // Search for users by username (with debouncing)
  React.useEffect(() => {
    if (!user) {
      return;
    }

    // Clear search results if search query is empty
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchResultsWithStatus([]);
      return;
    }

    // Debounce search - wait 300ms after user stops typing (faster)
    const searchTimeout = setTimeout(async () => {
      setSearchLoading(true);
      
      try {
        const { users, error } = await searchUsersByUsername(searchQuery.trim());
        
        if (error) {
          console.error('Search error:', error);
          setSearchResults([]);
          setSearchResultsWithStatus([]);
          setSearchLoading(false);
          return;
        }

        // Filter out current user from results
        const filteredUsers = users.filter((u) => u.uid !== user.uid);
        setSearchResults(filteredUsers);

        // Show results immediately without friendship status (optimistic UI)
        setSearchResultsWithStatus(filteredUsers.map(userData => ({
          ...userData,
          isFriend: false, // Will update below
        })));

        // Check friendship status in parallel (faster)
        // Use the current friends list if available to avoid individual queries
        const friendsSet = new Set(friends);
        const usersWithStatus = filteredUsers.map((userData) => ({
          ...userData,
          isFriend: friendsSet.has(userData.uid), // Use cached friends list
        }));

        // If friends list isn't loaded yet, check individually (but don't block UI)
        if (friends.length === 0) {
          // Background check for friendship status
          Promise.all(
            filteredUsers.map(async (userData) => {
              try {
                const areFriends = await checkFriendship(user.uid, userData.uid);
                return { uid: userData.uid, isFriend: areFriends };
              } catch (error) {
                console.error('Error checking friendship for user:', error);
                return { uid: userData.uid, isFriend: false };
              }
            })
          ).then((friendshipStatuses) => {
            // Update only the friendship status without re-fetching all data
            setSearchResultsWithStatus((prev) =>
              prev.map((user) => {
                const status = friendshipStatuses.find((s) => s.uid === user.uid);
                return status ? { ...user, isFriend: status.isFriend } : user;
              })
            );
          });
        } else {
          // Use cached friends list
          setSearchResultsWithStatus(usersWithStatus);
        }
      } catch (error) {
        console.error('Error in search effect:', error);
        setSearchResults([]);
        setSearchResultsWithStatus([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300); // 300ms debounce (faster response)

    return () => clearTimeout(searchTimeout);
  }, [searchQuery, user, friends]); // Include friends in dependencies

  // Handle add friend from search results (direct mutual friendship)
  const handleAddFriend = async (targetUserId) => {
    if (!user || targetUserId === user.uid) {
      return;
    }

    try {
      const result = await addFriend(user.uid, targetUserId);
      
      if (result.success) {
        Alert.alert('Success', 'Friend added!', [{ text: 'OK' }]);
        // Update the search result status
        setSearchResultsWithStatus((prev) =>
          prev.map((u) =>
            u.uid === targetUserId
              ? { ...u, isFriend: true }
              : u
          )
        );
      } else if (result.error === 'Already friends') {
        Alert.alert('Already Friends', 'You are already friends with this user.', [{ text: 'OK' }]);
        // Update status
        setSearchResultsWithStatus((prev) =>
          prev.map((u) => (u.uid === targetUserId ? { ...u, isFriend: true } : u))
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to add friend', [{ text: 'OK' }]);
      }
    } catch (error) {
      console.error('Error adding friend:', error);
      Alert.alert('Error', 'Failed to add friend. Please try again.', [{ text: 'OK' }]);
    }
  };

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: subTextColor }}>Please sign in to view friends</Text>
      </View>
    );
  }

  // Only show loading spinner on initial load (wait for subscription to connect)
  // Show UI immediately once we have friends data (even if user data is still loading)
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#990000" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Search for new users */}
        <Text style={{ color: textColor, fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
          Find Friends
        </Text>
        <Searchbar 
          placeholder="Search by username..." 
          onChangeText={setSearchQuery} 
          value={searchQuery} 
          style={{ backgroundColor: surfaceColor, marginBottom: 12 }} 
          inputStyle={{ color: textColor }} 
          iconColor={subTextColor}
          placeholderTextColor={subTextColor}
        />
        
        {/* Search Results */}
        {searchQuery.trim() && (
          <View style={{ marginBottom: 24 }}>
            {searchLoading ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#990000" />
                <Text style={{ color: subTextColor, marginTop: 8, fontSize: 14 }}>Searching...</Text>
              </View>
            ) : searchResultsWithStatus.length > 0 ? (
              <View style={{ backgroundColor: surfaceColor, borderRadius: 16, overflow: 'hidden' }}>
                {searchResultsWithStatus.map((userData, idx) => (
                  <View key={userData.uid}>
                    <View 
                      style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        padding: 12,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                        <Avatar.Image 
                          size={40} 
                          source={{ uri: userData.avatar || 'https://i.pravatar.cc/100?img=12' }} 
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: textColor, fontSize: 14, fontWeight: '600' }}>
                            {userData.name || 'Unknown User'}
                          </Text>
                          <Text style={{ color: subTextColor, fontSize: 12 }}>
                            @{userData.username || 'unknown'}
                          </Text>
                        </View>
                      </View>
                      {userData.isFriend ? (
                        <Button 
                          mode="outlined" 
                          textColor={subTextColor}
                          compact
                          disabled
                          icon="account-check"
                        >
                          Friends
                        </Button>
                      ) : (
                        <Button 
                          mode="contained" 
                          buttonColor="#990000"
                          textColor="#FFFFFF"
                          compact
                          onPress={() => handleAddFriend(userData.uid)}
                          icon="account-plus"
                        >
                          Add Friend
                        </Button>
                      )}
                    </View>
                    {idx < searchResultsWithStatus.length - 1 && (
                      <Divider style={{ backgroundColor: dividerColor }} />
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: subTextColor, textAlign: 'center', fontSize: 14, marginBottom: 8 }}>
                  No users found
                </Text>
                <Text style={{ color: subTextColor, textAlign: 'center', fontSize: 12 }}>
                  Make sure you're typing the exact username
                </Text>
              </View>
            )}
          </View>
        )}

        <Text style={{ color: subTextColor, marginVertical: 6, marginTop: 20, fontSize: 14, fontWeight: '600' }}>
          Friends ({friendsWithUserData.length})
        </Text>
        {friendsWithUserData.length > 0 ? (
          <View style={{ backgroundColor: surfaceColor, borderRadius: 16 }}>
            {friendsWithUserData.map((friend, idx) => (
              <View key={friend?.uid || idx}>
                <List.Item 
                  title={friend?.name || 'Unknown User'} 
                  description={`@${friend?.username || 'unknown'}`}
                  titleStyle={{ color: textColor }} 
                  descriptionStyle={{ color: subTextColor, fontSize: 12 }}
                  left={() => (
                    <Avatar.Image 
                      size={36} 
                      source={{ uri: friend?.avatar || 'https://i.pravatar.cc/100?img=12' }} 
                    />
                  )} 
                />
                {idx < friendsWithUserData.length - 1 && <Divider style={{ backgroundColor: dividerColor }} />}
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: subTextColor, textAlign: 'center', padding: 10 }}>Empty</Text>
        )}
      </ScrollView>
    </View>
  );
}

