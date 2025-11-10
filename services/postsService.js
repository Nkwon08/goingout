// Posts service - handles post creation, reading, updating, deletion with real-time updates
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  limit,
  doc,
  updateDoc,
  deleteDoc,
  where,
  serverTimestamp,
  onSnapshot,
  Timestamp,
  disableNetwork,
  waitForPendingWrites,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Create a new post with user data
export const createPost = async (userId, userData, postData) => {
  try {
    // Check if Firestore is configured (minimal logging for speed)
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { postId: null, error: 'Firestore not configured. Please check your Firebase configuration and restart the app: expo start --clear' };
    }

    // Ensure images array is properly formatted for carousel posts
    let imagesArray = null;
    if (postData.images && Array.isArray(postData.images) && postData.images.length > 0) {
      imagesArray = postData.images; // Carousel post with multiple images
    } else if (postData.image) {
      // Single image - also save as array for consistency
      imagesArray = [postData.image];
    }

    // Calculate expiration time: 24 hours from now
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours in milliseconds
    const expiresAtTimestamp = Timestamp.fromDate(expiresAt);

    // Ensure location is properly saved - trim and normalize
    const postLocation = postData.location ? String(postData.location).trim() : null;
    
    // GPS coordinates (required for location-based filtering)
    const postLat = postData.lat || postData.latitude || null;
    const postLng = postData.lng || postData.longitude || null;
    
    // Get avatar from userData - check photoURL first (new field), then avatar (backward compatibility)
    const userAvatar = userData.photoURL || userData.avatar || null;
    
    // Extract @mentions from post text
    const { extractMentions } = await import('../utils/mentionUtils');
    const mentionedUsernames = extractMentions(postData.text || '');
    
    const postToCreate = {
      userId,
      name: userData.name || 'User',
      username: userData.username || userData.user || 'user',
      avatar: userAvatar,
      text: postData.text || '',
      location: postLocation || 'Unknown Location', // City name for display
      lat: postLat, // GPS latitude (required for distance filtering)
      lng: postLng, // GPS longitude (required for distance filtering)
      image: postData.image || (imagesArray && imagesArray.length > 0 ? imagesArray[0] : null), // Backwards compatibility
      images: imagesArray, // Carousel post images array
      bar: postData.bar || null, // Bar name (optional)
      mentions: mentionedUsernames, // Array of mentioned usernames (lowercase)
      likes: 0,
      likedBy: [], // Array of user IDs who liked this post
      retweets: 0,
      replies: 0,
      liked: false,
      visibility: postData.visibility || 'location', // 'friends' or 'location' - default to 'location'
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      expiresAt: expiresAtTimestamp, // Posts expire 24 hours after creation
    };
    
    console.log('📝 Creating post with location:', postLocation, 'GPS:', postLat, postLng);
    if (mentionedUsernames.length > 0) {
      console.log('📝 Post contains mentions:', mentionedUsernames);
    }

    // Create the post in Firestore
    const postRef = await addDoc(collection(db, 'posts'), postToCreate);
    
    // Send notifications to mentioned users (in background, don't block post creation)
    if (mentionedUsernames.length > 0) {
      (async () => {
        try {
          const { createNotification } = await import('./notificationsService');
          const { getAuthUidFromUsername } = await import('./friendsService');
          
          // Get the post creator's name for the notification
          const fromUserName = userData.name || userData.username || 'Someone';
          
          // Send notification to each mentioned user
          const notificationPromises = mentionedUsernames.map(async (username) => {
            try {
              // Convert username to authUid
              const mentionedUserId = await getAuthUidFromUsername(username);
              
              if (!mentionedUserId) {
                console.warn(`⚠️ User not found for mention: @${username}`);
                return { success: false, error: `User @${username} not found` };
              }
              
              // Don't notify if user mentioned themselves
              if (mentionedUserId === userId) {
                return { success: true, skipped: true };
              }
              
              // Send notification
              const result = await createNotification(mentionedUserId, {
                type: 'tag',
                postId: postRef.id,
                fromUserId: userId,
                message: 'mentioned you in a post',
              });
              
              if (result.error) {
                console.error(`❌ Failed to send tag notification to @${username}:`, result.error);
              } else {
                console.log(`✅ Sent tag notification to @${username}`);
              }
              
              return result;
            } catch (error) {
              console.error(`❌ Error sending tag notification to @${username}:`, error);
              return { success: false, error: error.message };
            }
          });
          
          await Promise.all(notificationPromises);
        } catch (error) {
          console.error('❌ Error sending tag notifications:', error);
          // Don't fail post creation if notifications fail
        }
      })();
    }
    
    return { postId: postRef.id, error: null };
  } catch (error) {
    console.error('❌ Error creating post:', error);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error message:', error.message);
    return { postId: null, error: error.message };
  }
};

// Get posts by user ID
export const getUserPosts = async (userId, pageSize = 50) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { posts: [], error: 'Firestore not configured' };
    }

    const q = query(
      collection(db, 'posts'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );

    const querySnapshot = await getDocs(q);
    const posts = querySnapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
          expiresAt: data.expiresAt?.toDate ? data.expiresAt.toDate() : (data.expiresAt ? new Date(data.expiresAt) : null),
          timeAgo: formatTimeAgo(data.createdAt),
        };
      });

    return { posts, error: null };
  } catch (error) {
    console.error('❌ Error getting user posts:', error);
    return { posts: [], error: error.message };
  }
};

// Subscribe to user posts in real-time
export const subscribeToUserPosts = (userId, callback, pageSize = 50) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      callback({ posts: [], error: 'Firestore not configured' });
      return () => {};
    }

    if (Object.keys(db).length === 0) {
      callback({ posts: [], error: 'Firestore not configured' });
      return () => {};
    }

    // Query without orderBy to avoid needing composite index
    // We'll sort client-side instead
    const q = query(
      collection(db, 'posts'),
      where('userId', '==', userId),
      limit(pageSize * 2) // Get more docs to account for client-side filtering/sorting
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const posts = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
              expiresAt: data.expiresAt?.toDate ? data.expiresAt.toDate() : (data.expiresAt ? new Date(data.expiresAt) : null),
              timeAgo: formatTimeAgo(data.createdAt),
            };
          })
          // Sort by createdAt descending (newest first)
          .sort((a, b) => {
            const aTime = a.createdAt?.getTime ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime();
            const bTime = b.createdAt?.getTime ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime();
            return bTime - aTime; // Descending order (newest first)
          })
          // Limit after sorting
          .slice(0, pageSize);
        
        callback({ posts, error: null });
      },
      (error) => {
        console.error('❌ Error subscribing to user posts:', error);
        callback({ posts: [], error: error.message });
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('❌ Error setting up user posts subscription:', error);
    callback({ posts: [], error: error.message });
    return () => {};
  }
};

// Get all posts (feed) - one-time fetch
export const getPosts = async (lastPostId = null, pageSize = 20) => {
  try {
    const now = new Date();
    const nowTimestamp = Timestamp.fromDate(now);
    
    // Query uses composite index: expiresAt (Ascending), createdAt (Descending)
    // Index must be created in Firebase Console: posts collection
    let q = query(
      collection(db, 'posts'),
      where('expiresAt', '>', nowTimestamp), // Filter: only show posts that haven't expired
      orderBy('createdAt', 'desc'), // Order: newest first (uses composite index)
      limit(pageSize)
    );

    const querySnapshot = await getDocs(q);
    const posts = querySnapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          expiresAt: data.expiresAt?.toDate ? data.expiresAt.toDate() : (data.expiresAt ? new Date(data.expiresAt) : null),
          timeAgo: formatTimeAgo(data.createdAt),
        };
      })
      .filter((post) => {
        // Client-side filter: ensure post hasn't expired
        if (!post.expiresAt) {
          // For backwards compatibility, show posts without expiresAt
          return true;
        }
        return post.expiresAt.getTime() > now.getTime();
      });

    return { posts, error: null };
  } catch (error) {
    return { posts: [], error: error.message };
  }
};

// Listen to posts in real-time (for feed updates)
// userLocation: user's current city name (e.g., "Bloomington, IN") - for backwards compatibility
// userLat: user's GPS latitude
// userLng: user's GPS longitude
// userId: current user's ID (for checking friends visibility)
// friendsList: array of friend user IDs (for filtering Friends Only posts)
// blockedUsersList: array of blocked usernames (for filtering blocked users' posts)
// radiusKm: radius in kilometers for nearby posts (default: 10km)
export const subscribeToPosts = (callback, pageSize = 20, userLocation = null, userId = null, userLat = null, userLng = null, radiusKm = null, friendsList = [], blockedUsersList = []) => {
  try {
    // Check if db is configured - Firestore v9+ doesn't have 'collection' method
    // Instead check if it's a real Firestore instance (not empty object from fallback)
    if (!db || typeof db !== 'object') {
      callback({ posts: [], error: 'Firestore not configured. Please check your Firebase configuration and restart the app: expo start --clear' });
      return () => {}; // Return empty unsubscribe function
    }
    
    // Check if db is the fallback empty object (from development mode)
    // Real Firestore instance has properties like _settings, _databaseId, etc.
    if (Object.keys(db).length === 0) {
      callback({ posts: [], error: 'Firestore not configured. Please check your Firebase configuration and restart the app: expo start --clear' });
      return () => {}; // Return empty unsubscribe function
    }

    // Calculate current time for filtering expired posts
    // Only show posts that haven't expired (expiresAt > now)
    const now = new Date();
    const nowTimestamp = Timestamp.fromDate(now);

    // Build query with filters - uses composite index
    // IMPORTANT: When using range query (>) on one field and orderBy on another,
    // the index must have: createdAt (Ascending), expiresAt (Ascending), __name__ (Ascending)
    // Use the URL from error message to create the correct index
    let constraints = [];
    
    // Filter expired posts - range query on expiresAt
    constraints.push(where('expiresAt', '>', nowTimestamp));
    
    // Order by creation date (newest first) - requires composite index
    // Index needed: createdAt (Ascending), expiresAt (Ascending), __name__ (Ascending)
    constraints.push(orderBy('createdAt', 'desc'));
    
    // Limit results
    constraints.push(limit(pageSize));
    
    const q = query(collection(db, 'posts'), ...constraints);

    let unsubscribeFn = null;
    
    unsubscribeFn = onSnapshot(
      q,
      (snapshot) => {
        const now = new Date();
        const posts = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            const post = {
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
              expiresAt: data.expiresAt?.toDate ? data.expiresAt.toDate() : (data.expiresAt ? new Date(data.expiresAt) : null),
              timeAgo: formatTimeAgo(data.createdAt),
            };
            // Ensure images array is properly formatted for carousel posts
            if (post.images) {
              if (!Array.isArray(post.images)) {
                console.warn('⚠️ Post images is not an array, converting:', post.id, post.images);
                post.images = null;
              }
            }
            return post;
          })
          // Remove duplicates by ID (in case Firestore returns duplicates)
          .filter((post, index, self) => {
            const isFirst = index === self.findIndex((p) => p.id === post.id);
            if (!isFirst) {
              console.warn('⚠️ Duplicate post ID found:', post.id, 'removing duplicate');
            }
            return isFirst;
          })
          .filter((post) => {
            // Check expiration first
            if (post.expiresAt) {
              const expiresAtTime = post.expiresAt.getTime ? post.expiresAt.getTime() : new Date(post.expiresAt).getTime();
              const nowTime = now.getTime();
              if (expiresAtTime <= nowTime) {
                return false;
              }
            }
            
            // Filter out posts from blocked users
            // Check if post author's userId or username is in blockedUsersList
            if (blockedUsersList && blockedUsersList.length > 0) {
              const postAuthorId = post.userId || '';
              const postAuthorUsername = post.username || '';
              
              // Normalize blocked users list for comparison (lowercase)
              const normalizedBlockedList = blockedUsersList.map(u => String(u).toLowerCase().replace(/\s+/g, ''));
              const normalizedPostAuthorId = String(postAuthorId).toLowerCase().replace(/\s+/g, '');
              const normalizedPostAuthorUsername = String(postAuthorUsername).toLowerCase().replace(/\s+/g, '');
              
              // Check if post author is blocked
              const isBlocked = normalizedBlockedList.some(blockedUser => 
                blockedUser === normalizedPostAuthorId || 
                blockedUser === normalizedPostAuthorUsername
              );
              
              if (isBlocked) {
                return false; // Don't show posts from blocked users
              }
            }
            
            // Filter by visibility setting
            // If post visibility is 'friends', only show if user is friends with post author
            if (post.visibility === 'friends') {
              const isPostAuthorFriend = friendsList.includes(post.userId);
              const isOwnPost = userId === post.userId; // Always show own posts
              
              if (!isOwnPost && !isPostAuthorFriend) {
                return false;
              }
              
              // For friends-only posts, skip location filtering (show all friends' posts)
              return true;
            }
            
            // For location-based posts, filter by matching account location
            // Normalize location strings for comparison (trim and lowercase)
            const normalizeLocation = (loc) => {
              if (!loc) return '';
              return String(loc).trim().toLowerCase();
            };
            
            const postLocation = normalizeLocation(post.location);
            const userAccountLocation = normalizeLocation(userLocation);
            
            // Show post if locations match (or if user hasn't set location yet)
            if (userAccountLocation && postLocation) {
              if (postLocation !== userAccountLocation) {
                return false;
              }
            }
            
            return true;
          });
        // Sort posts by createdAt descending (newest first) - order always based on when it was posted
        posts.sort((a, b) => {
          const aTime = a.createdAt?.getTime ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime();
          const bTime = b.createdAt?.getTime ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime();
          return bTime - aTime; // b - a means newest (larger timestamp) comes first
        });
        
        callback({ posts, error: null });
      },
      (error) => {
        console.error('❌ Posts subscription error:', error);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error message:', error.message);
        
        // Check for Firestore index error - extract the index creation URL from error
        if (error.code === 'failed-precondition' || error.message.includes('index') || error.message.includes('requires an index')) {
          console.error('❌ Index error - make sure the composite index is created and enabled in Firebase Console');
          
          // Extract index URL from error message if available
          let indexUrl = 'https://console.firebase.google.com/project/goingout-8b2e0/firestore/indexes';
          const urlMatch = error.message.match(/https:\/\/[^\s]+/);
          if (urlMatch) {
            indexUrl = urlMatch[0];
          }
          
          console.error('❌ Index URL:', indexUrl);
          console.error('❌ Required index: posts collection');
          console.error('❌ Fields: createdAt (Ascending), expiresAt (Ascending), __name__ (Ascending)');
          
          // Provide helpful error message with link to create index
          callback({ 
            posts: [], 
            error: `Firestore index not found. Click the link in the error message above to create the index automatically, or create manually:\n\nCollection: posts\nFields:\n  - createdAt (Ascending)\n  - expiresAt (Ascending)\n  - __name__ (Ascending)\n\n${indexUrl}` 
          });
        } else {
          callback({ posts: [], error: error.message });
        }
      }
    );
    
    // Return unsubscribe function
    return () => {
      if (unsubscribeFn) unsubscribeFn();
    };
  } catch (error) {
    console.error('❌ Error setting up posts subscription:', error);
    callback({ posts: [], error: error.message });
    return () => {}; // Return empty unsubscribe function
  }
};

// Helper function to format time ago (used as initial value, will be updated by component)
const formatTimeAgo = (timestamp) => {
  if (!timestamp) return '0s ago';
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
};

// Get posts by location
export const getPostsByLocation = async (location) => {
  try {
    const q = query(
      collection(db, 'posts'),
      where('location', '==', location),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const posts = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return { posts, error: null };
  } catch (error) {
    return { posts: [], error: error.message };
  }
};

// Like a post
// Toggles like status and returns the new like state
export const likePost = async (postId, userId, postOwnerId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured' };
    }

    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);
    
    if (!postDoc.exists()) {
      return { success: false, error: 'Post not found' };
    }

    const postData = postDoc.data();
    const likedBy = postData.likedBy || [];
    const isLiked = likedBy.includes(userId);

    // Toggle like status
    if (isLiked) {
      // Unlike: remove user from likedBy array and decrement count
      await updateDoc(postRef, {
        likedBy: arrayRemove(userId),
        likes: (postData.likes || 0) - 1,
        updatedAt: serverTimestamp(),
      });
      return { success: true, isLiked: false, likes: (postData.likes || 0) - 1 };
    } else {
      // Like: add user to likedBy array and increment count
      await updateDoc(postRef, {
        likedBy: arrayUnion(userId),
        likes: (postData.likes || 0) + 1,
        updatedAt: serverTimestamp(),
      });
      
      // Send notification to post owner if not the same user
      if (postOwnerId && postOwnerId !== userId) {
        try {
          const { createNotification } = await import('./notificationsService');
          await createNotification(postOwnerId, {
            type: 'like',
            postId,
            fromUserId: userId,
            message: 'liked your post',
          });
        } catch (notifError) {
          console.warn('Failed to send like notification:', notifError);
          // Don't fail the like action if notification fails
        }
      }
      
      return { success: true, isLiked: true, likes: (postData.likes || 0) + 1 };
    }
  } catch (error) {
    console.error('Error liking post:', error);
    return { success: false, error: error.message };
  }
};

// Check if user liked a post
export const checkIfLiked = async (postId, userId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return false;
    }

    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);
    
    if (!postDoc.exists()) {
      return false;
    }

    const likedBy = postDoc.data().likedBy || [];
    return likedBy.includes(userId);
  } catch (error) {
    console.error('Error checking like status:', error);
    return false;
  }
};

// Delete a post
// Delete a post by ID
export const deletePost = async (postId) => {
  try {
    console.log('🗑️ Deleting post:', postId);
    
    // Check if Firestore is configured
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      console.error('❌ Firestore not configured');
      throw new Error('Firestore not configured. Please check your Firebase configuration and restart the app: expo start --clear');
    }

    const postRef = doc(db, 'posts', postId);
    await deleteDoc(postRef);
    
    console.log('✅ Post deleted successfully:', postId);
    return { error: null };
  } catch (error) {
    console.error('❌ Error deleting post:', error);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error message:', error.message);
    throw error; // Throw error so component can handle it
  }
};

