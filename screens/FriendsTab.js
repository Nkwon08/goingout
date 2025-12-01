import * as React from 'react';
import { View, ScrollView, ActivityIndicator, Alert, TouchableOpacity, RefreshControl } from 'react-native';
import { Searchbar, Button, Avatar, List, Divider, Text, IconButton } from 'react-native-paper';
import UserAvatar from '../components/UserAvatar';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addFriend, checkFriendship, getFriends, sendFriendRequest, cancelFriendRequest, subscribeToOutgoingFriendRequests, getAuthUidFromUsername, getUsernameFromAuthUid } from '../services/friendsService';
import { getCardBorderOnly } from '../utils/cardStyles';
import { getCurrentUserData as getUserData } from '../services/authService';
import { searchUsersByUsername, getAllUsers, getUserById } from '../services/usersService';

export default function FriendsTab() {
  const navigation = useNavigation();
  const { isDarkMode } = useTheme();
  const { user, userData, loading: authLoading, friendsList: friendsListFromContext } = useAuth();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [friends, setFriends] = React.useState([]);
  const [friendsWithData, setFriendsWithData] = React.useState([]);
  const [searchResults, setSearchResults] = React.useState([]);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchResultsWithStatus, setSearchResultsWithStatus] = React.useState([]);
  const [loading, setLoading] = React.useState(false); // Start with false to show UI immediately
  
  // Suggested profiles state - always show 3 users
  const [suggestedUsers, setSuggestedUsers] = React.useState([]); // Currently displayed 3 users
  const [allAvailableUsers, setAllAvailableUsers] = React.useState([]); // Pool of available users
  const [clickedUserIds, setClickedUserIds] = React.useState(new Set()); // Track clicked users
  const [allUsersLoading, setAllUsersLoading] = React.useState(false);
  const [allUsersLastId, setAllUsersLastId] = React.useState(null);
  const [allUsersHasMore, setAllUsersHasMore] = React.useState(true);
  
  // Pending friends state (outgoing friend requests)
  const [pendingFriends, setPendingFriends] = React.useState([]);
  const [pendingFriendsWithData, setPendingFriendsWithData] = React.useState([]);
  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  

  const colors = {
    bg: isDarkMode ? '#121212' : '#FAFAFA',
    surface: isDarkMode ? '#1E1E1E' : '#F5F4F2',
    text: isDarkMode ? '#E6E8F0' : '#1A1A1A',
    subText: isDarkMode ? '#8A90A6' : '#666666',
    divider: isDarkMode ? '#3A3A3A' : '#D0CFCD',
    primary: '#CC0000',
    isDarkMode,
  };

  // Handle refresh
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Force re-subscription by incrementing refreshKey
    setRefreshKey(prev => prev + 1);
    // Reset refreshing after a short delay
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  /** Load friends list from AuthContext - subscription is managed centrally */
  React.useEffect(() => {
    // Use friends list from AuthContext (centralized subscription)
    // Note: friendsList now contains usernames (not UIDs) since document IDs are usernames
    const friendUsernames = friendsListFromContext || [];
    
    // Filter out any pending requests - they should only show in "Pending Friends" section
    // Get pending friend usernames from pendingFriendsWithData (both by username and UID)
    const pendingUsernames = new Set(
      pendingFriendsWithData
        .map((p) => p.username?.toLowerCase())
        .filter(Boolean)
    );
    const pendingUids = new Set(
      pendingFriendsWithData
        .map((p) => p.uid)
        .filter(Boolean)
    );
    
    // IMPORTANT: If a user is in friendsListFromContext, they're already accepted and should show in Friends section
    // The pendingFriendsWithData only contains PENDING requests (filtered by status === 'pending')
    // When a request is accepted, it's removed from pending (status changes or deleted)
    // So friends should always show in Friends section - don't filter them out
    // Only users with PENDING requests (not in friends list) should be filtered out
    const actualFriends = friendUsernames.filter(username => username && String(username).trim()); // Filter out empty/null usernames
    
    console.log('🔍 [FriendsTab] Filtering friends:', {
      totalFriends: friendUsernames.length,
      pendingFriends: pendingFriendsWithData.length,
      actualFriends: actualFriends.length,
      pendingUsernames: Array.from(pendingUsernames),
      filteredOut: friendUsernames.length - actualFriends.length,
      friendUsernames: actualFriends,
      note: 'Only filtering out users with PENDING requests, accepted friends should show in Friends section',
    });
    
    setFriends(actualFriends);

    if (!actualFriends.length) {
      setFriendsWithData([]);
      return;
    }

    // Fetch friend data in parallel
    let isMounted = true;

    // Create pending sets for filtering (accessible in loadFriendData)
    const pendingAuthUidsSet = new Set(
      pendingFriendsWithData
        .map((p) => p.uid)
        .filter(Boolean)
    );
    const pendingUsernamesSet = new Set(
      pendingFriendsWithData
        .map((p) => p.username?.toLowerCase())
        .filter(Boolean)
    );

    const loadFriendData = async () => {
      try {
        // Show placeholders immediately
        setFriendsWithData(actualFriends.map((username) => ({
          username,
          name: 'Loading...',
          avatar: null,
        })));

        // Fetch friend data in parallel - friendsList contains usernames (document IDs)
        const friendData = await Promise.all(
          actualFriends.map(async (username) => {
            try {
              // Normalize username before lookup (document IDs are lowercase, no spaces)
              const normalizedUsername = username ? String(username).toLowerCase().replace(/\s+/g, '') : null;
              if (!normalizedUsername) {
                console.warn('⚠️ [FriendsTab] Empty username in friends list:', username);
                return { username: username || 'unknown', name: 'Unknown User', avatar: null, uid: username || 'unknown', authUid: null };
              }
              
              // Use getUserById which accepts username (document ID) or authUid
              // getUserById normalizes internally, but we normalize here too for consistency
              const result = await getUserById(normalizedUsername);
              const { userData, error } = result || {};
              
              if (userData) {
                return {
                  username: userData.username || normalizedUsername,
                  name: userData.name || 'Unknown User',
                  avatar: userData.photoURL || userData.avatar || null,
                  uid: userData.authUid || userData.id || normalizedUsername, // Store authUid for comparison
                  authUid: userData.authUid || null, // Explicit authUid field
                };
              }
              
              // If not found, try the original username (might be authUid or different format)
              if (error && normalizedUsername !== username) {
                console.log('🔄 [FriendsTab] Retrying with original username format:', username);
                const retryResult = await getUserById(username);
                if (retryResult?.userData) {
                  return {
                    username: retryResult.userData.username || username,
                    name: retryResult.userData.name || 'Unknown User',
                    avatar: retryResult.userData.photoURL || retryResult.userData.avatar || null,
                    uid: retryResult.userData.authUid || retryResult.userData.id || username,
                    authUid: retryResult.userData.authUid || null,
                  };
                }
              }
              
              console.warn('⚠️ [FriendsTab] Could not load friend data for:', username, error || 'User not found');
              return { username: normalizedUsername, name: 'Unknown User', avatar: null, uid: normalizedUsername, authUid: null };
            } catch (error) {
              console.error('❌ [FriendsTab] Error fetching friend data for', username, error);
              // Still return a friend entry so it shows up (even if with "Unknown User")
              return { username: username || 'unknown', name: 'Unknown User', avatar: null, uid: username || 'unknown', authUid: null };
            }
          })
        );

        if (isMounted) {
          // IMPORTANT: If a user is in friendsListFromContext, they're already accepted
          // They should show in Friends section, regardless of pending status
          // The pendingFriendsWithData only contains PENDING requests (status === 'pending')
          // When a request is accepted, it's removed from pending, so friends won't be in pendingFriendsWithData
          // So show all friends - don't filter them out
          
          // Filter out null/undefined entries but keep all valid friend entries (even if they have "Unknown User")
          const finalFriendData = friendData.filter(f => f && f.username);
          
          console.log('🔍 [FriendsTab] Final friend data:', {
            totalFriendsInList: actualFriends.length,
            loadedFriends: finalFriendData.length,
            failedToLoad: actualFriends.length - finalFriendData.length,
            note: 'All friends are shown (they were accepted)',
            friendUsernames: actualFriends,
            loadedUsernames: finalFriendData.map(f => f.username),
          });
          
          // If some friends failed to load, log a warning
          if (finalFriendData.length < actualFriends.length) {
            const loadedUsernames = new Set(finalFriendData.map(f => f.username?.toLowerCase()));
            const missingUsernames = actualFriends.filter(u => !loadedUsernames.has(u?.toLowerCase()));
            console.warn('⚠️ [FriendsTab] Some friends failed to load:', missingUsernames);
          }
          
          setFriendsWithData(finalFriendData);
        }
      } catch (err) {
        console.error('Error fetching friend data:', err);
      }
    };

    loadFriendData();

    return () => {
      isMounted = false;
    };
  }, [friendsListFromContext, pendingFriendsWithData]); // Re-fetch when friends list or pending friends changes

  /** Load pending friends (outgoing friend requests) */
  React.useEffect(() => {
    if (!user?.uid) {
      setPendingFriends([]);
      setPendingFriendsWithData([]);
      return;
    }

    console.log('📡 [FriendsTab] Setting up outgoing friend requests subscription');
    const unsubscribe = subscribeToOutgoingFriendRequests(user.uid, (result) => {
      if (result.error) {
        console.error('❌ [FriendsTab] Error subscribing to outgoing requests:', result.error);
        setPendingFriends([]);
        setPendingFriendsWithData([]);
        setRefreshing(false);
        return;
      }

      // Filter for pending requests only (exclude accepted/declined/cancelled)
      const pendingRequests = result.requests?.filter(
        (request) => request.status === 'pending'
      ) || [];

      console.log('📡 [FriendsTab] Outgoing requests:', {
        total: result.requests?.length || 0,
        pending: pendingRequests.length,
        statuses: result.requests?.map(r => r.status) || [],
        pendingToUserIds: pendingRequests.map(r => r.toUserId),
      });

      // Extract receiver IDs from pending requests
      // Note: toUserId might be a UID (long string) or username (short string) depending on when the request was created
      // IMPORTANT: Exclude anyone who is already a friend - they should only show in Friends section
      const pendingUserIds = pendingRequests
        .map((request) => request.toUserId)
        .filter((userId) => {
          // If the user is already in friends list, exclude them from pending
          // This prevents showing accepted friends in both sections
          if (friendsListFromContext && userId) {
            // Check if userId is a username (short string) or UID (long string)
            const isShortString = userId.length < 28;
            if (isShortString) {
              // Likely a username - check if it's in friends list
              const usernameLower = userId.toLowerCase();
              const isInFriends = friendsListFromContext.some(
                (friendUsername) => friendUsername?.toLowerCase() === usernameLower
              );
              if (isInFriends) {
                console.log('🔍 [FriendsTab] Excluding pending friend (already accepted):', userId);
                return false;
              }
            }
            // For UIDs, we'd need to convert to username first, but this is a basic check
          }
          return true;
        });
      
      setPendingFriends(pendingUserIds);

      // Load user data for pending friends
      if (pendingUserIds.length === 0) {
        setPendingFriendsWithData([]);
        return;
      }

      let isMounted = true;
      const loadPendingFriendData = async () => {
        try {
          // Convert IDs to usernames and fetch user data
          const pendingFriendData = await Promise.all(
            pendingUserIds.map(async (userId) => {
              try {
                let username = null;
                let authUid = null;
                
                // Check if userId is a username (short string) or UID (long string)
                // UIDs are typically 28 characters, usernames are shorter
                if (userId && userId.length < 28) {
                  // Likely a username - try to get user data directly
                  username = userId.toLowerCase().replace(/\s+/g, '');
                  const { userData } = await getUserById(username);
                  if (userData) {
                    authUid = userData.authUid;
                    return {
                      username: userData.username || username,
                      name: userData.name || 'Unknown User',
                      avatar: userData.photoURL || userData.avatar || null,
                      uid: authUid || userId, // Use authUid if available, otherwise use userId
                      authUid: authUid || null,
                      requestId: pendingRequests.find((r) => r.toUserId === userId)?.id,
                    };
                  }
                } else {
                  // Likely a UID - convert to username
                  username = await getUsernameFromAuthUid(userId);
                  if (username) {
                    authUid = userId;
                    // Get user data by username
                    const { userData } = await getUserById(username);
                    if (userData) {
                      return {
                        username: userData.username || username,
                        name: userData.name || 'Unknown User',
                        avatar: userData.photoURL || userData.avatar || null,
                        uid: authUid,
                        authUid: authUid,
                        requestId: pendingRequests.find((r) => r.toUserId === userId)?.id,
                      };
                    }
                    return {
                      username,
                      name: 'Unknown User',
                      avatar: null,
                      uid: authUid,
                      authUid: authUid,
                      requestId: pendingRequests.find((r) => r.toUserId === userId)?.id,
                    };
                  }
                }
                
                // If we couldn't determine username or UID, return null
                console.error('Could not determine username or UID for pending friend:', userId);
                return null;
              } catch (error) {
                console.error('Error fetching pending friend data for', userId, error);
                return null;
              }
            })
          );

          const validData = pendingFriendData.filter((data) => {
            if (!data) return false;
            
            // IMPORTANT: Exclude anyone who is already a friend
            // If they're in friends list, they were accepted and shouldn't show in pending
            if (friendsListFromContext && data.username) {
              const usernameLower = data.username.toLowerCase();
              const isInFriends = friendsListFromContext.some(
                (friendUsername) => friendUsername?.toLowerCase() === usernameLower
              );
              if (isInFriends) {
                console.log('🔍 [FriendsTab] Excluding pending friend from display (already accepted):', data.username);
                return false;
              }
            }
            
            // Also check by authUid if available
            if (friendsListFromContext && data.authUid) {
              // We'd need to convert authUid to username, but for now check username first
              // The username check above should catch most cases
            }
            
            return true;
          });

          // Deduplicate by requestId, uid, or username to prevent duplicate keys
          const seen = new Set();
          const deduplicatedData = validData.filter((data) => {
            // Use requestId as primary key, fallback to uid or username
            const key = data.requestId || data.uid || data.authUid || data.username;
            if (!key) return false;
            if (seen.has(key)) {
              console.log('⚠️ [FriendsTab] Duplicate pending friend detected, removing:', key);
              return false;
            }
            seen.add(key);
            return true;
          });

          if (isMounted) {
            setPendingFriendsWithData(deduplicatedData);
            setRefreshing(false);
          }
        } catch (err) {
          console.error('Error fetching pending friend data:', err);
          if (isMounted) {
            setPendingFriendsWithData([]);
            setRefreshing(false);
          }
        }
      };

      loadPendingFriendData();
      return () => { isMounted = false; };
    });

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [user?.uid, friendsListFromContext, refreshKey]); // Re-subscribe when friends list changes to exclude accepted friends

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
        const filtered = users.filter((u) => {
          // Exclude temp documents (users who haven't selected a username yet)
          if (u?.uid && u.uid.startsWith('temp_')) return false;
          // Exclude users without proper username
          if (!u?.username || !u.username.trim() || u.username === 'username') return false;
          return u?.uid !== user.uid;
        });

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
        // Load more users to build a pool (load 20 at a time for better pool)
        // On initial load, use null to start from the beginning
        const lastId = allUsersLastId || null;
        const result = await getAllUsers(user.uid, 20, lastId);
        
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
          // Get friends and pending friends usernames to filter them out
          // Normalize to lowercase for case-insensitive comparison
          const friendsUsernames = (friendsListFromContext || []).map(u => String(u).toLowerCase().replace(/\s+/g, ''));
          const pendingUsernames = pendingFriendsWithData.map((p) => p.username).filter(Boolean).map(u => String(u).toLowerCase().replace(/\s+/g, ''));
          const excludedUsernames = new Set([...friendsUsernames, ...pendingUsernames]);
          
          // Filter out current user, friends, pending friends, and already clicked users
          const filteredUsers = result.users.filter((u) => {
            // Exclude temp documents (users who haven't selected a username yet)
            if (u.uid && u.uid.startsWith('temp_')) return false;
            // Exclude users without proper username
            if (!u.username || !u.username.trim() || u.username === 'username') return false;
            // Exclude current user by comparing UID
            if (u.uid === user.uid) return false;
            // Also check if username matches current user's username (case-insensitive)
            if (userData?.username && u.username) {
              const currentUsernameLower = String(userData.username).toLowerCase().replace(/\s+/g, '');
              const uUsernameLower = String(u.username).toLowerCase().replace(/\s+/g, '');
              if (currentUsernameLower === uUsernameLower) return false;
            }
            // Exclude if already a friend (case-insensitive comparison)
            if (u.username) {
              const uUsernameLower = String(u.username).toLowerCase().replace(/\s+/g, '');
              if (excludedUsernames.has(uUsernameLower)) return false;
            }
            // Also check by UID if username not available
            if (u.uid && friendsUsernames.includes(String(u.uid).toLowerCase().replace(/\s+/g, ''))) return false;
            // Exclude if already clicked
            const uId = u.uid || u.username;
            if (clickedUserIds.has(uId)) return false;
            // Exclude if already in suggested users
            const isAlreadySuggested = suggestedUsers.some(su => (su.uid || su.username) === uId);
            if (isAlreadySuggested) return false;
            return true;
          });
          
          // Add to available users pool
          setAllAvailableUsers((prev) => {
            // Avoid duplicates
            const existingIds = new Set(prev.map(u => u.uid || u.username));
            const newUsers = filteredUsers.filter(u => !existingIds.has(u.uid || u.username));
            return [...prev, ...newUsers];
          });
          
          setAllUsersLastId(result.lastUserId);
          setAllUsersHasMore(result.hasMore);
          
          // If we don't have 3 suggested users yet, fill them from the pool
          setSuggestedUsers((prev) => {
            if (prev.length >= 3) return prev;
            
            // Get users from filtered results that aren't already suggested
            const existingIds = new Set(prev.map(u => u.uid || u.username));
            const newSuggested = filteredUsers
              .filter(u => !existingIds.has(u.uid || u.username))
              .slice(0, 3 - prev.length);
            
            return [...prev, ...newSuggested].slice(0, 3);
          });
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
  }, [user, searchQuery, authLoading, friendsListFromContext, pendingFriendsWithData]);

  // Ensure we always have 3 suggested users when possible
  React.useEffect(() => {
    if (!user?.uid || searchQuery.trim() || suggestedUsers.length >= 3) return;

    // If we have available users in pool, fill up to 3
    if (allAvailableUsers.length > 0 && suggestedUsers.length < 3) {
      // Normalize friends list for case-insensitive comparison
      const friendsUsernames = (friendsListFromContext || []).map(u => String(u).toLowerCase().replace(/\s+/g, ''));
      const pendingUsernames = pendingFriendsWithData.map((p) => p.username).filter(Boolean).map(u => String(u).toLowerCase().replace(/\s+/g, ''));
      const excludedUsernames = new Set([...friendsUsernames, ...pendingUsernames]);
      
      const existingIds = new Set(suggestedUsers.map(u => u.uid || u.username));
      const newSuggested = allAvailableUsers
        .filter(u => {
          // Don't include if already suggested
          if (existingIds.has(u.uid || u.username)) return false;
          // Don't include if already a friend (case-insensitive)
          if (u.username) {
            const uUsernameLower = String(u.username).toLowerCase().replace(/\s+/g, '');
            if (excludedUsernames.has(uUsernameLower)) return false;
          }
          return true;
        })
        .slice(0, 3 - suggestedUsers.length);
      
      if (newSuggested.length > 0) {
        setSuggestedUsers((prev) => [...prev, ...newSuggested].slice(0, 3));
        setAllAvailableUsers((prev) => {
          const newIds = new Set(newSuggested.map(u => u.uid || u.username));
          return prev.filter(u => !newIds.has(u.uid || u.username));
        });
      }
    }

    // If we still don't have 3 and there are more users to load, load more
    if (suggestedUsers.length < 3 && allUsersHasMore && !allUsersLoading) {
      const loadMore = async () => {
        try {
          const result = await getAllUsers(user.uid, 20, allUsersLastId);
          if (!result.error && result.users.length > 0) {
            // Normalize to lowercase for case-insensitive comparison
            const friendsUsernames = (friendsListFromContext || []).map(u => String(u).toLowerCase().replace(/\s+/g, ''));
            const pendingUsernames = pendingFriendsWithData.map((p) => p.username).filter(Boolean).map(u => String(u).toLowerCase().replace(/\s+/g, ''));
            const excludedUsernames = new Set([...friendsUsernames, ...pendingUsernames]);
            
            const filteredUsers = result.users.filter((u) => {
              // Exclude temp documents (users who haven't selected a username yet)
              if (u.uid && u.uid.startsWith('temp_')) return false;
              // Exclude users without proper username
              if (!u.username || !u.username.trim() || u.username === 'username') return false;
              if (u.uid === user.uid) return false;
              // Case-insensitive username comparison
              if (userData?.username && u.username) {
                const currentUsernameLower = String(userData.username).toLowerCase().replace(/\s+/g, '');
                const uUsernameLower = String(u.username).toLowerCase().replace(/\s+/g, '');
                if (currentUsernameLower === uUsernameLower) return false;
              }
              // Case-insensitive friend check
              if (u.username) {
                const uUsernameLower = String(u.username).toLowerCase().replace(/\s+/g, '');
                if (excludedUsernames.has(uUsernameLower)) return false;
              }
              if (u.uid && friendsUsernames.includes(String(u.uid).toLowerCase().replace(/\s+/g, ''))) return false;
              const uId = u.uid || u.username;
              if (clickedUserIds.has(uId)) return false;
              const isAlreadySuggested = suggestedUsers.some(su => (su.uid || su.username) === uId);
              if (isAlreadySuggested) return false;
              return true;
            });

            if (filteredUsers.length > 0) {
              setAllAvailableUsers((prev) => {
                const existingIds = new Set(prev.map(u => u.uid || u.username));
                const newUsers = filteredUsers.filter(u => !existingIds.has(u.uid || u.username));
                return [...prev, ...newUsers];
              });
              
              // Fill up to 3 suggested users
              setSuggestedUsers((prev) => {
                if (prev.length >= 3) return prev;
                const existingIds = new Set(prev.map(u => u.uid || u.username));
                const newSuggested = filteredUsers
                  .filter(u => !existingIds.has(u.uid || u.username))
                  .slice(0, 3 - prev.length);
                return [...prev, ...newSuggested].slice(0, 3);
              });
            }
            
            setAllUsersLastId(result.lastUserId);
            setAllUsersHasMore(result.hasMore);
          }
        } catch (error) {
          console.error('Error loading more users to fill suggestions:', error);
        }
      };
      loadMore();
    }
  }, [suggestedUsers.length, allAvailableUsers.length, allUsersHasMore, allUsersLoading, user, userData, friendsListFromContext, pendingFriendsWithData, clickedUserIds, allUsersLastId, searchQuery]);

  // Remove friends from suggested users when friends list changes
  React.useEffect(() => {
    if (!friendsListFromContext || friendsListFromContext.length === 0) return;
    
    // Normalize friends list for case-insensitive comparison
    const friendsUsernames = new Set(friendsListFromContext.map(u => String(u).toLowerCase().replace(/\s+/g, '')));
    const pendingUsernames = new Set(pendingFriendsWithData.map((p) => p.username).filter(Boolean).map(u => String(u).toLowerCase().replace(/\s+/g, '')));
    
    // Remove any suggested users who are now friends or pending
    setSuggestedUsers((prev) => {
      const filtered = prev.filter((u) => {
        if (!u.username) return true; // Keep if no username
        const uUsernameLower = String(u.username).toLowerCase().replace(/\s+/g, '');
        // Remove if they're a friend or pending
        if (friendsUsernames.has(uUsernameLower) || pendingUsernames.has(uUsernameLower)) {
          return false;
        }
        return true;
      });
      
      // If we removed some, return the filtered list (will be refilled by other effects)
      return filtered;
    });
  }, [friendsListFromContext, pendingFriendsWithData]);

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
        // Filter out current user from the new users
        const filteredUsers = result.users.filter((u) => {
          // Exclude temp documents (users who haven't selected a username yet)
          if (u.uid && u.uid.startsWith('temp_')) return false;
          // Exclude users without proper username
          if (!u.username || !u.username.trim() || u.username === 'username') return false;
          // Exclude current user by comparing UID
          if (u.uid === user.uid) return false;
          // Also check if username matches current user's username
          if (userData?.username && u.username === userData.username) return false;
          return true;
        });
        setAllUsers((prev) => [...prev, ...filteredUsers]);
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

  // Track which friend requests are currently being sent to prevent duplicates
  const [sendingRequests, setSendingRequests] = React.useState(new Set());

  /** Send a friend request */
  const handleSendFriendRequest = React.useCallback(async (targetUid) => {
    if (!user || targetUid === user.uid) return;
    
    // Prevent duplicate requests
    if (sendingRequests.has(targetUid)) {
      console.log('⚠️ Friend request already in progress for:', targetUid);
      return;
    }
    
    setSendingRequests((prev) => new Set(prev).add(targetUid));
    
    try {
      const result = await sendFriendRequest(targetUid);
      if (result.success) {
        setSearchResultsWithStatus((prev) =>
          prev.map((u) => {
            // Match by UID or username (case-insensitive)
            const matches = u.uid === targetUid || 
                          u.authUid === targetUid ||
                          (u.username && targetUid && String(u.username).toLowerCase().replace(/\s+/g, '') === String(targetUid).toLowerCase().replace(/\s+/g, ''));
            return matches ? { ...u, requestSent: true } : u;
          })
        );
        // Also update suggestedUsers list
        setSuggestedUsers((prev) =>
          prev.map((u) => {
            // Match by UID or username (case-insensitive)
            const matches = u.uid === targetUid || 
                          u.authUid === targetUid ||
                          (u.username && targetUid && String(u.username).toLowerCase().replace(/\s+/g, '') === String(targetUid).toLowerCase().replace(/\s+/g, ''));
            return matches ? { ...u, requestSent: true } : u;
          })
        );
      } else {
        // Don't show error for "already sent" - it's expected if user clicks twice
        if (result.error !== 'Friend request already sent') {
          Alert.alert('Error', result.error || 'Failed to send friend request', [{ text: 'OK' }]);
        }
      }
    } catch (err) {
      console.error('Error sending friend request:', err);
      Alert.alert('Error', 'Failed to send friend request. Please try again.', [{ text: 'OK' }]);
    } finally {
      setSendingRequests((prev) => {
        const next = new Set(prev);
        next.delete(targetUid);
        return next;
      });
    }
  }, [user, sendingRequests]);

  /** Cancel a friend request (unsend) */
  const handleCancelFriendRequest = React.useCallback(async (targetUid) => {
    if (!user || targetUid === user.uid) return;
    try {
      const result = await cancelFriendRequest(targetUid);
      if (result.success) {
        setSearchResultsWithStatus((prev) =>
          prev.map((u) => {
            // Match by UID or username (case-insensitive)
            const matches = u.uid === targetUid || 
                          u.authUid === targetUid ||
                          (u.username && targetUid && String(u.username).toLowerCase().replace(/\s+/g, '') === String(targetUid).toLowerCase().replace(/\s+/g, ''));
            return matches ? { ...u, requestSent: false } : u;
          })
        );
        // Also update suggestedUsers list
        setSuggestedUsers((prev) =>
          prev.map((u) => {
            // Match by UID or username (case-insensitive)
            const matches = u.uid === targetUid || 
                          u.authUid === targetUid ||
                          (u.username && targetUid && String(u.username).toLowerCase().replace(/\s+/g, '') === String(targetUid).toLowerCase().replace(/\s+/g, ''));
            return matches ? { ...u, requestSent: false } : u;
          })
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to cancel friend request', [{ text: 'OK' }]);
      }
    } catch (err) {
      console.error('Error cancelling friend request:', err);
      Alert.alert('Error', 'Failed to cancel friend request. Please try again.', [{ text: 'OK' }]);
    }
  }, [user]);

  /** Handle friend profile tap - navigate to user profile screen */
  const handleFriendProfileTap = React.useCallback((friend) => {
    if (!friend || !friend.username) {
      return;
    }

    // Navigate to UserProfileModal in the root navigator
    // This keeps the current tab active
    // Go up navigation hierarchy: FriendsTab -> NotificationsScreen -> BottomTabs -> RootNavigator
    let rootNavigator = navigation;
    let parent = navigation.getParent();
    
    // Navigate up to find root navigator (3 levels up from FriendsTab)
    while (parent) {
      rootNavigator = parent;
      parent = parent.getParent();
    }
    
    // Navigate to the root modal
    rootNavigator.navigate('UserProfileModal', { 
      username: friend.username 
    });
  }, [navigation]);

  /** Handle user profile tap from Discover Users or search results */
  const handleUserProfileTap = React.useCallback((clickedUser) => {
    if (!clickedUser || !clickedUser.username) {
      return;
    }

    // Mark user as clicked
    const userId = clickedUser.uid || clickedUser.username;
    setClickedUserIds((prev) => new Set([...prev, userId]));

    // Remove clicked user from suggested users
    setSuggestedUsers((prev) => {
      return prev.filter(u => (u.uid || u.username) !== userId);
    });

    // Try to replace from available pool immediately
    setAllAvailableUsers((prevAvailable) => {
      // Find a user that's not already suggested and not clicked
      const availableUser = prevAvailable.find(u => {
        // Exclude temp documents (users who haven't selected a username yet)
        if (u.uid && u.uid.startsWith('temp_')) return false;
        // Exclude users without proper username
        if (!u.username || !u.username.trim() || u.username === 'username') return false;
        const uId = u.uid || u.username;
        const isClicked = clickedUserIds.has(uId) || userId === uId;
        return !isClicked;
      });

      if (availableUser) {
        // Add to suggested users immediately
        setSuggestedUsers((prevSuggested) => {
          const filtered = prevSuggested.filter(su => (su.uid || su.username) !== userId);
          const existingIds = new Set(filtered.map(u => u.uid || u.username));
          if (!existingIds.has(availableUser.uid || availableUser.username) && filtered.length < 3) {
            return [...filtered, availableUser].slice(0, 3);
          }
          return filtered;
        });

        // Remove from available pool
        return prevAvailable.filter(u => (u.uid || u.username) !== (availableUser.uid || availableUser.username));
      }

      // If no available user in pool, try to load more in background
      if (allUsersHasMore && !allUsersLoading) {
        setTimeout(() => {
          const loadMore = async () => {
            try {
              const result = await getAllUsers(user.uid, 10, allUsersLastId);
              if (!result.error && result.users.length > 0) {
                // Get friends and pending friends usernames to filter them out
                const friendsUsernames = friendsListFromContext || [];
                const pendingUsernames = pendingFriendsWithData.map((p) => p.username).filter(Boolean);
                const excludedUsernames = new Set([...friendsUsernames, ...pendingUsernames]);
                
                const filteredUsers = result.users.filter((u) => {
                  // Exclude temp documents (users who haven't selected a username yet)
                  if (u.uid && u.uid.startsWith('temp_')) return false;
                  // Exclude users without proper username
                  if (!u.username || !u.username.trim() || u.username === 'username') return false;
                  if (u.uid === user.uid) return false;
                  if (userData?.username && u.username === userData.username) return false;
                  if (u.username && excludedUsernames.has(u.username)) return false;
                  if (u.uid && friendsUsernames.includes(u.uid)) return false;
                  const uId = u.uid || u.username;
                  const currentClickedIds = new Set([...clickedUserIds, userId]);
                  if (currentClickedIds.has(uId)) return false;
                  return true;
                });

                if (filteredUsers.length > 0) {
                  const replacementUser = filteredUsers[0];
                  setSuggestedUsers((prevSuggested) => {
                    const filtered = prevSuggested.filter(su => (su.uid || su.username) !== userId);
                    const existingIds = new Set(filtered.map(u => u.uid || u.username));
                    if (!existingIds.has(replacementUser.uid || replacementUser.username) && filtered.length < 3) {
                      return [...filtered, replacementUser].slice(0, 3);
                    }
                    return filtered;
                  });
                  setAllAvailableUsers((prev) => {
                    const existingIds = new Set(prev.map(u => u.uid || u.username));
                    const newUsers = filteredUsers.filter(u => !existingIds.has(u.uid || u.username));
                    return [...prev, ...newUsers];
                  });
                }
                
                setAllUsersLastId(result.lastUserId);
                setAllUsersHasMore(result.hasMore);
              }
            } catch (error) {
              console.error('Error loading more users for replacement:', error);
            }
          };
          loadMore();
        }, 100);
      }

      return prevAvailable;
    });

    // Navigate to UserProfileModal in the root navigator
    // This keeps the current tab active
    // Go up navigation hierarchy: FriendsTab -> NotificationsScreen -> BottomTabs -> RootNavigator
    let rootNavigator = navigation;
    let parent = navigation.getParent();
    
    // Navigate up to find root navigator (3 levels up from FriendsTab)
    while (parent) {
      rootNavigator = parent;
      parent = parent.getParent();
    }
    
    // Navigate to the root modal
    rootNavigator.navigate('UserProfileModal', { 
      username: clickedUser.username 
    });
  }, [navigation, user, userData, friendsListFromContext, pendingFriendsWithData, clickedUserIds, allUsersHasMore, allUsersLoading, allUsersLastId]);

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
    <LinearGradient
      colors={isDarkMode ? ['#1a0000', '#121212', '#0a0000'] : ['#ffe5e5', '#FAFAFA', '#fff5f5']}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1 }}>
        <ScrollView 
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
        {/* Search */}
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Find Friends</Text>
        <Searchbar
          placeholder="Search by username..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={{ 
            backgroundColor: colors.isDarkMode ? 'rgba(30, 30, 30, 0.2)' : 'rgba(255, 255, 255, 0.3)',
            marginBottom: 12,
            borderRadius: 20,
            ...getCardBorderOnly(),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 8,
          }}
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
              <View style={{ 
                backgroundColor: colors.isDarkMode ? 'rgba(30, 30, 30, 0.2)' : 'rgba(255, 255, 255, 0.3)',
                borderRadius: 20,
                overflow: 'hidden',
                ...getCardBorderOnly(),
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 16,
                elevation: 8,
              }}>
                {searchResultsWithStatus.map((u, idx) => (
                  <View key={`search-${u.uid || u.username || idx}`}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
                      <TouchableOpacity 
                        style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                        onPress={() => handleUserProfileTap(u)}
                        activeOpacity={0.7}
                      >
                        <UserAvatar size={40} uri={u.avatar} />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{u.name || 'Unknown User'}</Text>
                          <Text style={{ color: colors.subText, fontSize: 12 }}>@{u.username || 'unknown'}</Text>
                        </View>
                      </TouchableOpacity>
                      {u.isFriend ? (
                        <Button mode="outlined" textColor={colors.subText} compact disabled icon="account-check">Friends</Button>
                      ) : u.requestSent ? (
                        <Button mode="outlined" textColor={colors.primary} compact onPress={() => handleCancelFriendRequest(u.uid)} icon="close">Request Sent</Button>
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
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Suggested Profiles</Text>
            {allUsersLoading && suggestedUsers.length === 0 ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ color: colors.subText, marginTop: 8, fontSize: 14 }}>Loading users...</Text>
              </View>
            ) : suggestedUsers.length > 0 ? (
              <View style={{ 
                backgroundColor: colors.isDarkMode ? 'rgba(30, 30, 30, 0.2)' : 'rgba(255, 255, 255, 0.3)',
                borderRadius: 20,
                overflow: 'hidden',
                ...getCardBorderOnly(),
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 16,
                elevation: 8,
              }}>
                {suggestedUsers.map((u, idx) => (
                  <View key={`suggested-${u.uid || u.username || idx}`}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
                      <TouchableOpacity 
                        style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                        onPress={() => handleUserProfileTap(u)}
                        activeOpacity={0.7}
                      >
                        <UserAvatar size={48} uri={u.avatar} />
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
                      </TouchableOpacity>
                      {(() => {
                        // Check if user is already a friend (by username or uid)
                        const isFriend = u.username && friendsListFromContext?.includes(u.username);
                        // Check if there's a pending request (case-insensitive username comparison and also check by UID)
                        const hasPendingRequest = pendingFriendsWithData.some((p) => {
                          // Case-insensitive username comparison
                          if (p.username && u.username) {
                            const pUsernameLower = String(p.username).toLowerCase().replace(/\s+/g, '');
                            const uUsernameLower = String(u.username).toLowerCase().replace(/\s+/g, '');
                            if (pUsernameLower === uUsernameLower) return true;
                          }
                          // Also check by UID if available
                          if (p.uid && u.uid && p.uid === u.uid) return true;
                          if (p.authUid && u.uid && p.authUid === u.uid) return true;
                          if (p.uid && u.authUid && p.uid === u.authUid) return true;
                          return false;
                        });
                        
                        if (isFriend) {
                          return <Button mode="outlined" textColor={colors.subText} compact disabled icon="account-check">Friends</Button>;
                        } else if (hasPendingRequest || u.requestSent) {
                          return <Button mode="outlined" textColor={colors.primary} compact onPress={() => handleCancelFriendRequest(u.uid)} icon="close">Request Sent</Button>;
                        } else {
                          return <Button mode="contained" buttonColor={colors.primary} textColor="#fff" compact onPress={() => handleSendFriendRequest(u.uid)} icon="account-plus">Send Request</Button>;
                        }
                      })()}
                    </View>
                    {idx < suggestedUsers.length - 1 && <Divider style={{ backgroundColor: colors.divider }} />}
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: colors.subText, textAlign: 'center', fontSize: 14 }}>No users found</Text>
              </View>
            )}
          </View>
        )}

        {/* Pending Friends Section */}
        {pendingFriendsWithData.length > 0 && (
          <>
            <Text style={{ color: colors.subText, marginVertical: 6, fontSize: 14, fontWeight: '600' }}>Pending Friends ({pendingFriendsWithData.length})</Text>
            <View style={{ 
              backgroundColor: colors.isDarkMode ? 'rgba(30, 30, 30, 0.2)' : 'rgba(255, 255, 255, 0.3)',
              borderRadius: 20,
              marginBottom: 16,
              ...getCardBorderOnly(),
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
              elevation: 8,
            }}>
              {pendingFriendsWithData.map((p, idx) => (
                  <View key={`pending-${p.requestId || p.uid || p.authUid || p.username || idx}`}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}
                    onPress={() => handleUserProfileTap(p)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <UserAvatar size={40} uri={p.avatar} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{p.name || 'Unknown User'}</Text>
                        <Text style={{ color: colors.subText, fontSize: 12 }}>@{p.username || 'unknown'}</Text>
                      </View>
                    </View>
                    <IconButton
                      icon="close-circle"
                      iconColor={colors.subText}
                      size={24}
                      onPress={(e) => {
                        e.stopPropagation(); // Prevent TouchableOpacity onPress from firing
                        handleCancelFriendRequest(p.uid || p.authUid || p.username);
                      }}
                      style={{ margin: 0 }}
                    />
                  </TouchableOpacity>
                  {idx < pendingFriendsWithData.length - 1 && <Divider style={{ backgroundColor: colors.divider }} />}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Friends List */}
        <Text style={{ color: colors.subText, marginVertical: 6, fontSize: 14, fontWeight: '600' }}>Friends ({friendsWithData.length})</Text>
        {friendsWithData.length ? (
          <View style={{ 
            backgroundColor: colors.isDarkMode ? 'rgba(30, 30, 30, 0.2)' : 'rgba(255, 255, 255, 0.3)',
            borderRadius: 20,
            ...getCardBorderOnly(),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 8,
          }}>
            {friendsWithData.map((f, idx) => (
              <View key={`friend-${f.uid || f.username || f.authUid || idx}`}>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}
                  onPress={() => handleFriendProfileTap(f)}
                  activeOpacity={0.7}
                >
                  <UserAvatar size={40} uri={f.avatar} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{f.name || 'Unknown User'}</Text>
                    <Text style={{ color: colors.subText, fontSize: 12 }}>@{f.username || 'unknown'}</Text>
                  </View>
                </TouchableOpacity>
                {idx < friendsWithData.length - 1 && <Divider style={{ backgroundColor: colors.divider }} />}
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: colors.subText, textAlign: 'center', padding: 10 }}>Empty</Text>
        )}
      </ScrollView>
      </View>
    </LinearGradient>
  );
}
