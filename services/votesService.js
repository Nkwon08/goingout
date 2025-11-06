// Votes service - handles location-based public voting for "tonight" polls
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Vote for a location/bar option (tonight poll)
 * Each user can only vote once per location per day
 * @param {string} userId - User ID (authUid)
 * @param {string} location - User's location (city, e.g., "Bloomington, IN")
 * @param {string} option - Bar/location name to vote for
 * @param {Object} userData - User data (name, username, avatar)
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export const voteForOption = async (userId, location, option, userData) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured' };
    }

    if (!option || !option.trim()) {
      return { success: false, error: 'Option is required' };
    }

    if (!location || !location.trim()) {
      return { success: false, error: 'Location is required' };
    }

    // Get today's date string (YYYY-MM-DD) for daily polls
    const today = new Date().toISOString().split('T')[0];
    const locationKey = location.trim();
    const optionKey = option.trim();

    // Check if user already voted today for this location
    const votesRef = collection(db, 'votes');
    const existingVoteQuery = query(
      votesRef,
      where('userId', '==', userId),
      where('location', '==', locationKey),
      where('date', '==', today)
    );

    const existingVotes = await getDocs(existingVoteQuery);

    if (!existingVotes.empty) {
      // User already voted - update their vote
      const existingVote = existingVotes.docs[0];
      const existingData = existingVote.data();

      // If voting for the same option, remove vote
      if (existingData.option === optionKey) {
        await deleteDoc(existingVote.ref);
        return { success: true, error: null, action: 'removed' };
      }

      // Update to new option
      await updateDoc(existingVote.ref, {
        option: optionKey,
        userName: userData.name || 'User',
        userUsername: userData.username || 'user',
        userAvatar: userData.photoURL || userData.avatar || null,
        updatedAt: serverTimestamp(),
      });

      return { success: true, error: null, action: 'updated' };
    }

    // Create new vote
    const voteData = {
      userId,
      location: locationKey,
      option: optionKey,
      date: today,
      userName: userData.name || 'User',
      userUsername: userData.username || 'user',
      userAvatar: userData.photoURL || userData.avatar || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await addDoc(votesRef, voteData);

    return { success: true, error: null, action: 'created' };
  } catch (error) {
    console.error('Error voting for option:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all votes for a location (today's poll)
 * @param {string} location - Location (city, e.g., "Bloomington, IN")
 * @returns {Promise<{ votes: Array, error: string|null }>}
 */
export const getVotesForLocation = async (location) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { votes: [], error: 'Firestore not configured' };
    }

    if (!location || !location.trim()) {
      return { votes: [], error: 'Location is required' };
    }

    const today = new Date().toISOString().split('T')[0];
    const locationKey = location.trim();

    const votesRef = collection(db, 'votes');
    const q = query(
      votesRef,
      where('location', '==', locationKey),
      where('date', '==', today),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const votes = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
      };
    });

    return { votes, error: null };
  } catch (error) {
    console.error('Error getting votes for location:', error);
    return { votes: [], error: error.message };
  }
};

/**
 * Get vote counts aggregated by option for a location
 * @param {string} location - Location (city, e.g., "Bloomington, IN")
 * @returns {Promise<{ voteCounts: Object, voters: Object, error: string|null }>}
 * voteCounts: { "option1": 5, "option2": 3, ... }
 * voters: { "option1": [user objects], "option2": [user objects], ... }
 */
export const getVoteCountsForLocation = async (location) => {
  try {
    const { votes, error } = await getVotesForLocation(location);
    
    if (error) {
      return { voteCounts: {}, voters: {}, error };
    }

    // Aggregate votes by option
    const voteCounts = {};
    const voters = {};

    votes.forEach((vote) => {
      const option = vote.option;
      voteCounts[option] = (voteCounts[option] || 0) + 1;
      
      if (!voters[option]) {
        voters[option] = [];
      }
      voters[option].push({
        userId: vote.userId,
        userName: vote.userName,
        userUsername: vote.userUsername,
        userAvatar: vote.userAvatar,
      });
    });

    return { voteCounts, voters, error: null };
  } catch (error) {
    console.error('Error getting vote counts:', error);
    return { voteCounts: {}, voters: {}, error: error.message };
  }
};

/**
 * Subscribe to votes for a location (real-time updates)
 * @param {string} location - Location (city, e.g., "Bloomington, IN")
 * @param {Function} callback - Callback function (result) => {}
 * @returns {Function} Unsubscribe function
 */
export const subscribeToVotesForLocation = (location, callback) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      callback({ votes: [], error: 'Firestore not configured' });
      return () => {};
    }

    if (Object.keys(db).length === 0) {
      callback({ votes: [], error: 'Firestore not configured' });
      return () => {};
    }

    if (!location || !location.trim()) {
      callback({ votes: [], error: 'Location is required' });
      return () => {};
    }

    const today = new Date().toISOString().split('T')[0];
    const locationKey = location.trim();

    const votesRef = collection(db, 'votes');
    const q = query(
      votesRef,
      where('location', '==', locationKey),
      where('date', '==', today),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const votes = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
          };
        });

        // Aggregate votes by option
        const voteCounts = {};
        const voters = {};

        votes.forEach((vote) => {
          const option = vote.option;
          voteCounts[option] = (voteCounts[option] || 0) + 1;
          
          if (!voters[option]) {
            voters[option] = [];
          }
          voters[option].push({
            userId: vote.userId,
            userName: vote.userName,
            userUsername: vote.userUsername,
            userAvatar: vote.userAvatar,
          });
        });

        callback({ votes, voteCounts, voters, error: null });
      },
      (error) => {
        console.error('Error subscribing to votes:', error);
        callback({ votes: [], voteCounts: {}, voters: {}, error: error.message });
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up votes subscription:', error);
    callback({ votes: [], voteCounts: {}, voters: {}, error: error.message });
    return () => {};
  }
};

/**
 * Get user's current vote for a location (today)
 * @param {string} userId - User ID (authUid)
 * @param {string} location - Location (city, e.g., "Bloomington, IN")
 * @returns {Promise<{ vote: Object|null, error: string|null }>}
 */
export const getUserVoteForLocation = async (userId, location) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { vote: null, error: 'Firestore not configured' };
    }

    if (!location || !location.trim()) {
      return { vote: null, error: 'Location is required' };
    }

    const today = new Date().toISOString().split('T')[0];
    const locationKey = location.trim();

    const votesRef = collection(db, 'votes');
    const q = query(
      votesRef,
      where('userId', '==', userId),
      where('location', '==', locationKey),
      where('date', '==', today),
      limit(1)
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const data = doc.data();
      return {
        vote: {
          id: doc.id,
          option: data.option,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
        },
        error: null,
      };
    }

    return { vote: null, error: null };
  } catch (error) {
    console.error('Error getting user vote:', error);
    return { vote: null, error: error.message };
  }
};

