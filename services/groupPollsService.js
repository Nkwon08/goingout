// Group Polls service - handles creating polls and voting in groups
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  increment,
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Create a new poll in a group
 * @param {string} groupId - The group ID
 * @param {string} creatorId - The user ID who created the poll
 * @param {string} question - The poll question
 * @param {Array<string>} options - Array of option labels
 * @param {Object} creatorData - Creator user data (name, avatar, etc.)
 * @returns {Promise<{ pollId: string|null, error: string|null }>}
 */
export const createGroupPoll = async (groupId, creatorId, question, options, creatorData) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { pollId: null, error: 'Firestore not configured' };
    }

    if (!groupId || !creatorId || !question || !options || options.length < 2) {
      return { pollId: null, error: 'Group ID, creator ID, question, and at least 2 options are required' };
    }

    const pollOptions = options.map((label, index) => ({
      id: `option_${index}`,
      label: label.trim(),
      votes: 0,
      voters: [], // Array of user IDs who voted for this option
    }));

    const pollData = {
      groupId,
      creatorId,
      creatorName: creatorData?.name || 'User',
      creatorAvatar: creatorData?.photoURL || creatorData?.avatar || null,
      question: question.trim(),
      options: pollOptions,
      totalVotes: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const pollsRef = collection(db, 'groups', groupId, 'polls');
    const pollRef = await addDoc(pollsRef, pollData);

    // Send poll message to chat
    try {
      const { sendPollMessage } = await import('./groupChatService');
      await sendPollMessage(
        groupId,
        creatorId,
        pollRef.id,
        question.trim(),
        pollOptions, // Pass the formatted options array
        creatorData
      );
    } catch (error) {
      console.error('⚠️ Error sending poll message to chat (non-fatal):', error);
      // Don't fail poll creation if message fails
    }

    return { pollId: pollRef.id, error: null };
  } catch (error) {
    console.error('❌ Error creating group poll:', error);
    return { pollId: null, error: error.message };
  }
};

/**
 * Vote on a poll option
 * @param {string} groupId - The group ID
 * @param {string} pollId - The poll ID
 * @param {string} optionId - The option ID to vote for
 * @param {string} userId - The user ID voting
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export const voteOnGroupPoll = async (groupId, pollId, optionId, userId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured' };
    }

    if (!groupId || !pollId || !optionId || !userId) {
      return { success: false, error: 'Group ID, poll ID, option ID, and user ID are required' };
    }

    const pollRef = doc(db, 'groups', groupId, 'polls', pollId);
    const pollDoc = await getDoc(pollRef);

    if (!pollDoc.exists()) {
      return { success: false, error: 'Poll not found' };
    }

    const pollData = pollDoc.data();
    const options = pollData.options || [];
    
    // Find the option being voted for
    const optionIndex = options.findIndex(opt => opt.id === optionId);
    if (optionIndex === -1) {
      return { success: false, error: 'Option not found' };
    }

    // Check if user already voted for this option (remove vote)
    const currentOption = options[optionIndex];
    const hasVotedForThis = currentOption.voters?.includes(userId);
    
    // Check if user voted for any other option
    let previousOptionIndex = -1;
    for (let i = 0; i < options.length; i++) {
      if (i !== optionIndex && options[i].voters?.includes(userId)) {
        previousOptionIndex = i;
        break;
      }
    }

    // Update options array
    const updatedOptions = [...options];
    
    if (hasVotedForThis) {
      // Remove vote from this option
      updatedOptions[optionIndex] = {
        ...currentOption,
        votes: Math.max(0, (currentOption.votes || 0) - 1),
        voters: (currentOption.voters || []).filter(id => id !== userId),
      };
    } else {
      // Remove vote from previous option if exists
      if (previousOptionIndex !== -1) {
        const previousOption = updatedOptions[previousOptionIndex];
        updatedOptions[previousOptionIndex] = {
          ...previousOption,
          votes: Math.max(0, (previousOption.votes || 0) - 1),
          voters: (previousOption.voters || []).filter(id => id !== userId),
        };
      }
      
      // Add vote to new option
      updatedOptions[optionIndex] = {
        ...currentOption,
        votes: (currentOption.votes || 0) + 1,
        voters: [...(currentOption.voters || []), userId],
      };
    }

    // Calculate total votes
    const totalVotes = updatedOptions.reduce((sum, opt) => sum + (opt.votes || 0), 0);

    await updateDoc(pollRef, {
      options: updatedOptions,
      totalVotes,
      updatedAt: serverTimestamp(),
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('❌ Error voting on group poll:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Subscribe to polls for a group
 * @param {string} groupId - The group ID
 * @param {Function} callback - Callback function that receives polls array
 * @returns {Function} Unsubscribe function
 */
export const subscribeToGroupPolls = (groupId, callback) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      callback({ polls: [], error: 'Firestore not configured' });
      return () => {};
    }

    if (!groupId) {
      callback({ polls: [], error: 'Group ID is required' });
      return () => {};
    }

    const pollsRef = collection(db, 'groups', groupId, 'polls');
    const q = query(pollsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const polls = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : null),
          };
        });

        callback({ polls, error: null });
      },
      (error) => {
        console.error('❌ Error subscribing to group polls:', error);
        callback({ polls: [], error: error.message });
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('❌ Error setting up group polls subscription:', error);
    callback({ polls: [], error: error.message });
    return () => {};
  }
};

/**
 * Delete a poll (only creator can delete)
 * @param {string} groupId - The group ID
 * @param {string} pollId - The poll ID
 * @param {string} userId - The user ID requesting deletion
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export const deleteGroupPoll = async (groupId, pollId, userId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured' };
    }

    if (!groupId || !pollId || !userId) {
      return { success: false, error: 'Group ID, poll ID, and user ID are required' };
    }

    const pollRef = doc(db, 'groups', groupId, 'polls', pollId);
    const pollDoc = await getDoc(pollRef);

    if (!pollDoc.exists()) {
      return { success: false, error: 'Poll not found' };
    }

    const pollData = pollDoc.data();
    if (pollData.creatorId !== userId) {
      return { success: false, error: 'Only the poll creator can delete it' };
    }

    await deleteDoc(pollRef);

    return { success: true, error: null };
  } catch (error) {
    console.error('❌ Error deleting group poll:', error);
    return { success: false, error: error.message };
  }
};

