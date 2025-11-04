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
  enableNetwork,
  disableNetwork,
  waitForPendingWrites,
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
    
    const postToCreate = {
      userId,
      name: userData.name || 'User',
      username: userData.username || userData.user || 'user',
      avatar: userData.avatar || null,
      text: postData.text || '',
      location: postLocation || 'Unknown Location', // City name for display
      lat: postLat, // GPS latitude (required for distance filtering)
      lng: postLng, // GPS longitude (required for distance filtering)
      image: postData.image || (imagesArray && imagesArray.length > 0 ? imagesArray[0] : null), // Backwards compatibility
      images: imagesArray, // Carousel post images array
      bar: postData.bar || null, // Bar name (optional)
      likes: 0,
      retweets: 0,
      replies: 0,
      liked: false,
      visibility: postData.visibility || 'location', // 'friends' or 'location' - default to 'location'
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      expiresAt: expiresAtTimestamp, // Posts expire 24 hours after creation
    };
    
    console.log('📝 Creating post with location:', postLocation, 'GPS:', postLat, postLng);

    // Try to enable network quickly (in case Firestore is offline)
    // Don't wait too long - if it fails, try anyway
    try {
      const enableNetworkPromise = enableNetwork(db);
      const networkTimeout = new Promise((resolve) => setTimeout(resolve, 500)); // Reduced to 500ms for speed
      await Promise.race([enableNetworkPromise, networkTimeout]);
    } catch (networkError) {
      // Continue anyway - network might already be enabled
    }
    
    // Create the post in Firestore (no timeout - let it complete naturally)
    const postRef = await addDoc(collection(db, 'posts'), postToCreate);
    
    return { postId: postRef.id, error: null };
  } catch (error) {
    console.error('❌ Error creating post:', error);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error message:', error.message);
    return { postId: null, error: error.message };
  }
};

// Get all posts (feed) - one-time fetch
export const getPosts = async (lastPostId = null, pageSize = 20) => {
  try {
    const now = new Date();
    const nowTimestamp = Timestamp.fromDate(now);
    
    let q = query(
      collection(db, 'posts'),
      where('expiresAt', '>', nowTimestamp), // Only show posts that haven't expired
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
// radiusKm: radius in kilometers for nearby posts (default: 10km)
export const subscribeToPosts = (callback, pageSize = 20, userLocation = null, userId = null, userLat = null, userLng = null, radiusKm = null, friendsList = []) => {
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

    // Build query with filters
    // Temporarily simplify query to avoid index issues - filter only by expiration
    // Location filtering will be done client-side
    let constraints = [];
    
    // Filter expired posts only (no location filter in query to avoid index issues)
    constraints.push(where('expiresAt', '>', nowTimestamp));
    
    // Order by creation date
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
        
        // Check for Firestore index error - fall back to simple query without orderBy
        if (error.code === 'failed-precondition' || error.message.includes('index') || error.message.includes('requires an index')) {
          console.warn('⚠️ Index error - trying fallback query without orderBy...');
          
          // Fallback: query without orderBy (no index needed)
          // Still filter expired posts client-side
          let fallbackConstraints = [
            where('expiresAt', '>', Timestamp.fromDate(new Date())), // Filter expired posts
          ];
          
          fallbackConstraints.push(limit(pageSize));
          
          const fallbackQ = query(collection(db, 'posts'), ...fallbackConstraints);
          
          // Replace unsubscribe function with fallback query
          if (unsubscribeFn) unsubscribeFn();
          unsubscribeFn = onSnapshot(
            fallbackQ,
            (snapshot) => {
              const now = new Date();
                  const posts = snapshot.docs
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
                      // Check expiration first
                      if (post.expiresAt) {
                        const expiresAtTime = post.expiresAt.getTime ? post.expiresAt.getTime() : new Date(post.expiresAt).getTime();
                        const nowTime = now.getTime();
                        if (expiresAtTime <= nowTime) {
                          return false;
                        }
                      }
                      
                      // Filter by visibility setting
                      if (post.visibility === 'friends') {
                        const isPostAuthorFriend = friendsList.includes(post.userId);
                        const isOwnPost = userId === post.userId;
                        if (!isOwnPost && !isPostAuthorFriend) {
                          return false;
                        }
                        // For friends-only posts, skip location filtering
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
            (fallbackError) => {
              console.error('❌ Fallback query also failed:', fallbackError);
              const indexUrl = `https://console.firebase.google.com/project/goingout-8b2e0/firestore/indexes?create_composite=Clhwcm9qZWN0cy9nb2luZ291dC04YjJlMC9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvcG9zdHMvaW5kZXhlcy9fEAEaCgoGdXNlcklkEAEaDAoKY3JlYXRlZEF0EAIaDAoIZGVmYXVsdBABGi8KCmNyZWF0ZWRBdBAIGgwKCHN0YXJ0QXQQBBoKCgZ1c2VySWQQAQ`;
              callback({ 
                posts: [], 
                error: `Firestore error. Please check your Firebase configuration or create an index:\n${indexUrl}` 
              });
            }
          );
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
export const likePost = async (postId, userId, isLiked) => {
  try {
    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);
    
    if (!postDoc.exists()) {
      return { error: 'Post not found' };
    }

    const currentLikes = postDoc.data().likes || 0;
    const newLikes = isLiked ? currentLikes - 1 : currentLikes + 1;

    await updateDoc(postRef, {
      likes: newLikes,
      updatedAt: serverTimestamp(),
    });

    // Update user's liked posts
    // This would require a subcollection or array update
    return { error: null };
  } catch (error) {
    return { error: error.message };
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

