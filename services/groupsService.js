// Groups service - handles group creation, reading, updating, deletion with real-time updates
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
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../config/firebase';

// Create a new group
export const createGroup = async (groupData) => {
  try {
    // Check if Firestore is configured
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { groupId: null, error: 'Firestore not configured. Please check your Firebase configuration and restart the app: expo start --clear' };
    }

    const {
      name,
      description,
      creator,
      members, // Array of invited member UIDs (not including creator)
      startTime,
      endTime,
    } = groupData;

    // Creator is automatically a member, invited friends will be added after accepting
    const membersArray = [creator]; // Start with only creator
    const invitedMembers = Array.isArray(members) ? [...new Set(members.filter(id => id !== creator))] : [];

    // Convert Date objects to Firestore Timestamps
    const startTimeTimestamp = startTime instanceof Date 
      ? Timestamp.fromDate(startTime) 
      : Timestamp.fromMillis(startTime.getTime ? startTime.getTime() : startTime);
    
    const endTimeTimestamp = endTime instanceof Date 
      ? Timestamp.fromDate(endTime) 
      : Timestamp.fromMillis(endTime.getTime ? endTime.getTime() : endTime);

    const groupToCreate = {
      name: name.trim(),
      description: description ? description.trim() : '',
      creator,
      members: membersArray,
      memberCount: membersArray.length,
      startTime: startTimeTimestamp,
      endTime: endTimeTimestamp,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    console.log('📝 Creating group:', groupToCreate.name);

    // Create the group in Firestore
    const groupRef = await addDoc(collection(db, 'groups'), groupToCreate);
    const groupId = groupRef.id;
    
    // Send group invitation notifications to invited friends
    if (invitedMembers.length > 0) {
      try {
        const { createNotification } = await import('./notificationsService');
        const { getAuthUidFromUsername } = await import('./friendsService');
        
        // Convert usernames to userIds (authUids) before sending notifications
        const notificationPromises = invitedMembers.map(async (memberIdentifier) => {
          // Friends list contains usernames (document IDs), so convert to authUid
          console.log(`🔄 Converting username "${memberIdentifier}" to userId...`);
          const authUid = await getAuthUidFromUsername(memberIdentifier);
          
          if (!authUid) {
            console.error(`❌ Could not find userId for username: ${memberIdentifier}`);
            return { success: false, error: `User not found: ${memberIdentifier}` };
          }
          
          console.log(`✅ Converted username "${memberIdentifier}" to userId: ${authUid}`);
          console.log(`📨 Sending group invitation to userId: ${authUid}`);
          
          const result = await createNotification(authUid, {
            type: 'group_invitation',
            groupId: groupId,
            fromUserId: creator,
            message: `invited you to join "${groupToCreate.name}"`,
          });
          
          if (result.error) {
            console.error(`❌ Failed to send notification to ${authUid}:`, result.error);
          } else {
            console.log(`✅ Successfully sent notification to ${authUid}`);
          }
          
          return result;
        });
        
        const results = await Promise.all(notificationPromises);
        const successCount = results.filter(r => r.success && !r.error).length;
        const errorCount = results.filter(r => r.error).length;
        
        console.log(`📨 Sent ${successCount}/${invitedMembers.length} group invitation notifications`);
        if (errorCount > 0) {
          console.error(`❌ Failed to send ${errorCount} notification(s)`);
        }
      } catch (error) {
        console.error('❌ Error sending group invitations:', error);
        console.error('❌ Error stack:', error.stack);
        // Don't fail group creation if notifications fail
      }
    }
    
    return { groupId, error: null };
  } catch (error) {
    console.error('❌ Error creating group:', error);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error message:', error.message);
    return { groupId: null, error: error.message };
  }
};

// Get groups for a user (where user is a member)
export const getUserGroups = async (userId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { groups: [], error: 'Firestore not configured' };
    }

    // Query without orderBy to avoid needing composite index
    // We'll sort client-side instead
    const q = query(
      collection(db, 'groups'),
      where('members', 'array-contains', userId)
    );

    const querySnapshot = await getDocs(q);
    const groups = querySnapshot.docs
      .map((doc) => {
        const data = doc.data();
        return formatGroupData(doc.id, data);
      })
      // Sort by createdAt descending (newest first) - client-side sorting
      .sort((a, b) => {
        const aTime = a.createdAt?.getTime ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime();
        const bTime = b.createdAt?.getTime ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });

    return { groups, error: null };
  } catch (error) {
    console.error('❌ Error getting user groups:', error);
    return { groups: [], error: error.message };
  }
};

// Subscribe to user groups in real-time
export const subscribeToUserGroups = (userId, callback) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      callback({ groups: [], error: 'Firestore not configured' });
      return () => {};
    }

    // Query without orderBy to avoid needing composite index
    // We'll sort client-side instead
    const q = query(
      collection(db, 'groups'),
      where('members', 'array-contains', userId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const groups = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            return formatGroupData(doc.id, data);
          })
          // Sort by createdAt descending (newest first) - client-side sorting
          .sort((a, b) => {
            const aTime = a.createdAt?.getTime ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime();
            const bTime = b.createdAt?.getTime ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime();
            return bTime - aTime;
          });
        
        callback({ groups, error: null });
      },
      (error) => {
        console.error('❌ Error subscribing to user groups:', error);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error message:', error.message);
        
        // Check for Firestore index error
        if (error.code === 'failed-precondition' || error.message.includes('index') || error.message.includes('requires an index')) {
          console.error('❌ Index error - make sure the composite index is created and enabled in Firebase Console');
          
          // Extract index URL from error message if available
          let indexUrl = 'https://console.firebase.google.com/project/goingout-8b2e0/firestore/indexes';
          const urlMatch = error.message.match(/https:\/\/[^\s]+/);
          if (urlMatch) {
            indexUrl = urlMatch[0];
          }
          
          // Note: We're sorting client-side now, so this error shouldn't occur
          // But keep the error handling in case we need it in the future
          console.error('❌ Index URL:', indexUrl);
          
          callback({ 
            groups: [], 
            error: `Firestore index error. Please check the Firebase Console for details.\n\n${indexUrl}` 
          });
        } else {
          callback({ groups: [], error: error.message });
        }
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('❌ Error setting up user groups subscription:', error);
    callback({ groups: [], error: error.message });
    return () => {};
  }
};

// Get a single group by ID
export const getGroupById = async (groupId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { group: null, error: 'Firestore not configured' };
    }

    const groupRef = doc(db, 'groups', groupId);
    const groupDoc = await getDoc(groupRef);

    if (!groupDoc.exists()) {
      return { group: null, error: 'Group not found' };
    }

    const group = formatGroupData(groupDoc.id, groupDoc.data());
    return { group, error: null };
  } catch (error) {
    console.error('❌ Error getting group:', error);
    return { group: null, error: error.message };
  }
};

// Subscribe to a single group by ID for real-time updates
export const subscribeToGroup = (groupId, callback) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      callback({ group: null, error: 'Firestore not configured' });
      return () => {};
    }

    if (!groupId) {
      callback({ group: null, error: 'Group ID is required' });
      return () => {};
    }

    const groupRef = doc(db, 'groups', groupId);

    const unsubscribe = onSnapshot(
      groupRef,
      (groupDoc) => {
        if (!groupDoc.exists()) {
          callback({ group: null, error: 'Group not found' });
          return;
        }

        const group = formatGroupData(groupDoc.id, groupDoc.data());
        callback({ group, error: null });
      },
      (error) => {
        console.error('❌ Error subscribing to group:', error);
        callback({ group: null, error: error.message });
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('❌ Error setting up group subscription:', error);
    callback({ group: null, error: error.message });
    return () => {};
  }
};

// Add a member to a group
export const addMemberToGroup = async (groupId, userId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { error: 'Firestore not configured' };
    }

    const groupRef = doc(db, 'groups', groupId);
    const groupDoc = await getDoc(groupRef);

    if (!groupDoc.exists()) {
      return { error: 'Group not found' };
    }

    const currentMembers = groupDoc.data().members || [];
    if (currentMembers.includes(userId)) {
      return { error: 'User is already a member' };
    }

    await updateDoc(groupRef, {
      members: arrayUnion(userId),
      memberCount: currentMembers.length + 1,
      updatedAt: serverTimestamp(),
    });

    return { error: null };
  } catch (error) {
    console.error('❌ Error adding member to group:', error);
    return { error: error.message };
  }
};

// Remove a member from a group
export const removeMemberFromGroup = async (groupId, userId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { error: 'Firestore not configured' };
    }

    const groupRef = doc(db, 'groups', groupId);
    const groupDoc = await getDoc(groupRef);

    if (!groupDoc.exists()) {
      return { error: 'Group not found' };
    }

    const currentMembers = groupDoc.data().members || [];
    if (!currentMembers.includes(userId)) {
      return { error: 'User is not a member' };
    }

    await updateDoc(groupRef, {
      members: arrayRemove(userId),
      memberCount: currentMembers.length - 1,
      updatedAt: serverTimestamp(),
    });

    return { error: null };
  } catch (error) {
    console.error('❌ Error removing member from group:', error);
    return { error: error.message };
  }
};

// Accept a group invitation
export const acceptGroupInvitation = async (groupId, userId, notificationId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured' };
    }

    const groupRef = doc(db, 'groups', groupId);
    const groupDoc = await getDoc(groupRef);

    if (!groupDoc.exists()) {
      return { success: false, error: 'Group not found' };
    }

    const currentMembers = groupDoc.data().members || [];
    if (currentMembers.includes(userId)) {
      // Already a member, just delete the notification
      if (notificationId) {
        const { getUsernameFromAuthUid } = await import('./friendsService');
        const username = await getUsernameFromAuthUid(userId);
        if (username) {
          const notificationRef = doc(db, 'users', username, 'notifications', notificationId);
          await deleteDoc(notificationRef);
        }
      }
      return { success: true, error: null };
    }

    // Add user to group members
    await updateDoc(groupRef, {
      members: arrayUnion(userId),
      memberCount: currentMembers.length + 1,
      updatedAt: serverTimestamp(),
    });

    // Delete the notification
    if (notificationId) {
      const { getUsernameFromAuthUid } = await import('./friendsService');
      const username = await getUsernameFromAuthUid(userId);
      if (username) {
        const notificationRef = doc(db, 'users', username, 'notifications', notificationId);
        await deleteDoc(notificationRef);
      }
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('❌ Error accepting group invitation:', error);
    return { success: false, error: error.message };
  }
};

// Send group invitation to a user
export const sendGroupInvitation = async (groupId, fromUserId, toUserId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured' };
    }

    // Get group data
    const groupRef = doc(db, 'groups', groupId);
    const groupDoc = await getDoc(groupRef);

    if (!groupDoc.exists()) {
      return { success: false, error: 'Group not found' };
    }

    const groupData = groupDoc.data();
    const groupName = groupData.name || 'the group';

    // Check if user is already a member
    const currentMembers = groupData.members || [];
    if (currentMembers.includes(toUserId)) {
      return { success: false, error: 'User is already a member' };
    }

    // Send notification
    const { createNotification } = await import('./notificationsService');
    const result = await createNotification(toUserId, {
      type: 'group_invitation',
      groupId: groupId,
      fromUserId: fromUserId,
      message: `invited you to join "${groupName}"`,
    });

    if (result.error) {
      return { success: false, error: result.error };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('❌ Error sending group invitation:', error);
    return { success: false, error: error.message };
  }
};

// Decline a group invitation
export const declineGroupInvitation = async (notificationId, userId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured' };
    }

    // Get user's username (document ID is username, not authUid)
    const { getUsernameFromAuthUid } = await import('./friendsService');
    const username = await getUsernameFromAuthUid(userId);
    
    if (!username) {
      return { success: false, error: 'User not found' };
    }

    // Delete the notification
    if (notificationId) {
      const notificationRef = doc(db, 'users', username, 'notifications', notificationId);
      await deleteDoc(notificationRef);
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('❌ Error declining group invitation:', error);
    return { success: false, error: error.message };
  }
};

// Delete a group (only creator can delete)
export const deleteGroup = async (groupId, userId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { error: 'Firestore not configured' };
    }

    if (!userId) {
      return { error: 'User ID is required' };
    }

    // Get the group to verify ownership
    const groupRef = doc(db, 'groups', groupId);
    const groupDoc = await getDoc(groupRef);

    if (!groupDoc.exists()) {
      return { error: 'Group not found' };
    }

    const groupData = groupDoc.data();
    
    // Verify that the user is the group creator
    if (groupData.creator !== userId) {
      return { error: 'Only the group creator can delete the group' };
    }

    // Delete all messages in the messages subcollection first
    const messagesRef = collection(db, 'groups', groupId, 'messages');
    const messagesSnapshot = await getDocs(messagesRef);
    
    // Delete all messages
    const deleteMessagePromises = messagesSnapshot.docs.map((messageDoc) => 
      deleteDoc(doc(db, 'groups', groupId, 'messages', messageDoc.id))
    );
    await Promise.all(deleteMessagePromises);

    // Delete all locations in the locations subcollection
    const locationsRef = collection(db, 'groups', groupId, 'locations');
    const locationsSnapshot = await getDocs(locationsRef);
    
    const deleteLocationPromises = locationsSnapshot.docs.map((locationDoc) => 
      deleteDoc(doc(db, 'groups', groupId, 'locations', locationDoc.id))
    );
    await Promise.all(deleteLocationPromises);

    // Delete all polls in the polls subcollection
    const pollsRef = collection(db, 'groups', groupId, 'polls');
    const pollsSnapshot = await getDocs(pollsRef);
    
    const deletePollPromises = pollsSnapshot.docs.map((pollDoc) => 
      deleteDoc(doc(db, 'groups', groupId, 'polls', pollDoc.id))
    );
    await Promise.all(deletePollPromises);

    // Delete the group document
    await deleteDoc(groupRef);
    
    return { error: null };
  } catch (error) {
    console.error('❌ Error deleting group:', error);
    return { error: error.message };
  }
};

// Helper function to format group data from Firestore
const formatGroupData = (id, data) => {
  const startTime = data.startTime?.toDate ? data.startTime.toDate() : (data.startTime ? new Date(data.startTime) : null);
  const endTime = data.endTime?.toDate ? data.endTime.toDate() : (data.endTime ? new Date(data.endTime) : null);
  const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date());
  
  // Format time for display (e.g., "Dec 15, 2024 8:00 PM")
  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return {
    id,
    name: data.name || '',
    description: data.description || '',
    creator: data.creator || '',
    members: data.members || [], // Array of member UIDs
    memberCount: data.memberCount || (data.members ? data.members.length : 0), // Number of members
    startTime,
    endTime,
    createdAt,
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : null),
    profilePicture: data.profilePicture || null, // Group profile picture URL
    coverPhoto: data.coverPhoto || null, // Group cover photo URL
    // Format for GroupCard component
    time: formatTime(startTime),
    // GroupCard expects members to be a number for display
    // But we'll keep the array in members field and use memberCount for display
  };
};

// Update group profile picture
// All group members can update the profile picture
export const updateGroupProfilePicture = async (groupId, userId, imageUri) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { error: 'Firestore not configured' };
    }

    if (!storage || typeof storage !== 'object' || Object.keys(storage).length === 0) {
      return { error: 'Storage not configured' };
    }

    // Get the group to verify user is a member
    const groupRef = doc(db, 'groups', groupId);
    const groupDoc = await getDoc(groupRef);

    if (!groupDoc.exists()) {
      return { error: 'Group not found' };
    }

    const groupData = groupDoc.data();
    
    // Verify that the user is a member of the group
    if (!groupData.members || !groupData.members.includes(userId)) {
      return { error: 'You must be a member of the group to change the profile picture' };
    }

    // Upload image to Firebase Storage
    const filename = `groups/${groupId}/profile.jpg`;
    const storageRef = ref(storage, filename);
    
    // Fetch image and convert to blob
    const response = await fetch(imageUri);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error('Image file is empty');
    }

    // Upload blob
    const uploadTask = uploadBytesResumable(storageRef, blob);
    
    await new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        null,
        (error) => reject(error),
        () => resolve()
      );
    });

    // Get download URL
    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

    // Update group document with new profile picture URL
    await updateDoc(groupRef, {
      profilePicture: downloadURL,
      updatedAt: serverTimestamp(),
    });

    console.log('✅ Updated group profile picture:', downloadURL);
    return { error: null, profilePicture: downloadURL };
  } catch (error) {
    console.error('❌ Error updating group profile picture:', error);
    return { error: error.message || 'Failed to update group profile picture' };
  }
};

// Update group cover photo
// All group members can update the cover photo
export const updateGroupCoverPhoto = async (groupId, userId, imageUri) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { error: 'Firestore not configured' };
    }

    if (!storage || typeof storage !== 'object' || Object.keys(storage).length === 0) {
      return { error: 'Storage not configured' };
    }

    // Get the group to verify user is a member
    const groupRef = doc(db, 'groups', groupId);
    const groupDoc = await getDoc(groupRef);

    if (!groupDoc.exists()) {
      return { error: 'Group not found' };
    }

    const groupData = groupDoc.data();
    
    // Verify that the user is a member of the group
    if (!groupData.members || !groupData.members.includes(userId)) {
      return { error: 'You must be a member of the group to change the cover photo' };
    }

    // Upload image to Firebase Storage
    const filename = `groups/${groupId}/cover.jpg`;
    const storageRef = ref(storage, filename);
    
    // Fetch image and convert to blob
    const response = await fetch(imageUri);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error('Image file is empty');
    }

    // Upload blob
    const uploadTask = uploadBytesResumable(storageRef, blob);
    
    await new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        null,
        (error) => reject(error),
        () => resolve()
      );
    });

    // Get download URL
    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

    // Update group document with new cover photo URL
    await updateDoc(groupRef, {
      coverPhoto: downloadURL,
      updatedAt: serverTimestamp(),
    });

    console.log('✅ Updated group cover photo:', downloadURL);
    return { error: null, coverPhoto: downloadURL };
  } catch (error) {
    console.error('❌ Error updating group cover photo:', error);
    return { error: error.message || 'Failed to update group cover photo' };
  }
};

