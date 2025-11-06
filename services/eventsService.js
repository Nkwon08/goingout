// Events service - handles event creation, reading, updating, deletion with real-time updates
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
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Create a new event
export const createEvent = async (userId, userData, eventData) => {
  try {
    // Check if Firestore is configured
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { eventId: null, error: 'Firestore not configured. Please check your Firebase configuration and restart the app: expo start --clear' };
    }

    // Convert Date objects to Firestore Timestamps
    // Handle backward compatibility: if eventData.date exists, use it for both startDate and endDate
    let startDateTimestamp, endDateTimestamp;
    
    if (eventData.startDate && eventData.endDate) {
      // New format: use startDate and endDate
      startDateTimestamp = eventData.startDate instanceof Date 
        ? Timestamp.fromDate(eventData.startDate) 
        : Timestamp.fromMillis(eventData.startDate.getTime ? eventData.startDate.getTime() : eventData.startDate);
      
      endDateTimestamp = eventData.endDate instanceof Date 
        ? Timestamp.fromDate(eventData.endDate) 
        : Timestamp.fromMillis(eventData.endDate.getTime ? eventData.endDate.getTime() : eventData.endDate);
    } else if (eventData.date) {
      // Backward compatibility: use date for both startDate and endDate
      const dateTimestamp = eventData.date instanceof Date 
        ? Timestamp.fromDate(eventData.date) 
        : Timestamp.fromMillis(eventData.date.getTime ? eventData.date.getTime() : eventData.date);
      startDateTimestamp = dateTimestamp;
      endDateTimestamp = dateTimestamp;
    } else {
      // Fallback: use current date
      const now = Timestamp.now();
      startDateTimestamp = now;
      endDateTimestamp = now;
    }
    
    const startTimeTimestamp = eventData.startTime instanceof Date 
      ? Timestamp.fromDate(eventData.startTime) 
      : Timestamp.fromMillis(eventData.startTime.getTime ? eventData.startTime.getTime() : eventData.startTime);
    
    const endTimeTimestamp = eventData.endTime instanceof Date 
      ? Timestamp.fromDate(eventData.endTime) 
      : Timestamp.fromMillis(eventData.endTime.getTime ? eventData.endTime.getTime() : eventData.endTime);

    const eventToCreate = {
      userId,
      creatorName: userData.name || 'User',
      creatorUsername: userData.username || userData.user || 'user',
      creatorAvatar: userData.photoURL || userData.avatar || null,
      title: eventData.name.trim(),
      description: eventData.description.trim(),
      location: eventData.location.trim(),
      host: eventData.host.trim(),
      image: eventData.photo || null,
      startDate: startDateTimestamp,
      endDate: endDateTimestamp,
      startTime: startTimeTimestamp,
      endTime: endTimeTimestamp,
      friendsOnly: eventData.friendsOnly || false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    console.log('📅 Creating event:', eventToCreate.title);

    // Create the event in Firestore
    const eventRef = await addDoc(collection(db, 'events'), eventToCreate);
    const eventId = eventRef.id;
    
    // Create a group associated with this event
    // The event creator is automatically the group creator and first member
    const { createGroup } = await import('./groupsService');
    const groupResult = await createGroup({
      name: eventToCreate.title,
      description: `Group for ${eventToCreate.title}`,
      creator: userId, // Event creator is group creator
      members: [], // Empty - creator is automatically added by createGroup
      startTime: eventData.startTime instanceof Date ? eventData.startTime : (eventData.startTime?.toDate ? eventData.startTime.toDate() : eventData.startTime),
      endTime: eventData.endTime instanceof Date ? eventData.endTime : (eventData.endTime?.toDate ? eventData.endTime.toDate() : eventData.endTime),
    });

    if (groupResult.error) {
      console.error('❌ Error creating group for event:', groupResult.error);
      // Still return success for event creation even if group creation fails
      // The group can be created later when someone joins
      return { eventId, error: null };
    }

    const groupId = groupResult.groupId;

    // Update event with groupId
    await updateDoc(eventRef, {
      groupId: groupId,
      updatedAt: serverTimestamp(),
    });

    console.log('✅ Event and group created successfully. Event ID:', eventId, 'Group ID:', groupId);
    
    return { eventId, groupId, error: null };
  } catch (error) {
    console.error('❌ Error creating event:', error);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error message:', error.message);
    return { eventId: null, error: error.message };
  }
};

// Get all upcoming events (not past their end time)
export const getUpcomingEvents = async (limitCount = 50) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { events: [], error: 'Firestore not configured' };
    }

    const now = Timestamp.now();
    
    // Query events where endTime is in the future
    const q = query(
      collection(db, 'events'),
      where('endTime', '>', now),
      orderBy('endTime', 'asc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    const events = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        description: data.description,
        location: data.location,
        host: data.host,
        image: data.image,
        // Handle backward compatibility: use startDate/endDate if available, otherwise fall back to date
        date: data.date?.toDate ? data.date.toDate() : data.date, // Keep for backward compatibility
        startDate: data.startDate?.toDate ? data.startDate.toDate() : (data.startDate || (data.date?.toDate ? data.date.toDate() : data.date)),
        endDate: data.endDate?.toDate ? data.endDate.toDate() : (data.endDate || (data.date?.toDate ? data.date.toDate() : data.date)),
        startTime: data.startTime?.toDate ? data.startTime.toDate() : data.startTime,
        endTime: data.endTime?.toDate ? data.endTime.toDate() : data.endTime,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
        userId: data.userId,
        creatorName: data.creatorName,
        creatorUsername: data.creatorUsername,
        creatorAvatar: data.creatorAvatar,
        groupId: data.groupId || null,
        friendsOnly: data.friendsOnly || false,
        // Format time string for display
        time: formatDateTime(
          data.startDate?.toDate ? data.startDate.toDate() : (data.date?.toDate ? data.date.toDate() : data.date),
          data.startTime?.toDate ? data.startTime.toDate() : data.startTime
        ),
      };
    });

    return { events, error: null };
  } catch (error) {
    console.error('❌ Error fetching upcoming events:', error);
    return { events: [], error: error.message };
  }
};

// Listen to upcoming events in real-time
export const subscribeToUpcomingEvents = (callback, limitCount = 50) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      callback({ events: [], error: 'Firestore not configured' });
      return () => {}; // Return empty unsubscribe function
    }

    const now = Timestamp.now();
    
    const q = query(
      collection(db, 'events'),
      where('endTime', '>', now),
      orderBy('endTime', 'asc'),
      limit(limitCount)
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const events = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title,
            description: data.description,
            location: data.location,
            host: data.host,
            image: data.image,
            date: data.date?.toDate ? data.date.toDate() : data.date,
            startTime: data.startTime?.toDate ? data.startTime.toDate() : data.startTime,
            endTime: data.endTime?.toDate ? data.endTime.toDate() : data.endTime,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
            userId: data.userId,
            creatorName: data.creatorName,
            creatorUsername: data.creatorUsername,
            creatorAvatar: data.creatorAvatar,
            groupId: data.groupId || null,
            friendsOnly: data.friendsOnly || false,
            // Format time string for display
            time: formatDateTime(
              data.date?.toDate ? data.date.toDate() : data.date,
              data.startTime?.toDate ? data.startTime.toDate() : data.startTime
            ),
          };
        });
        callback({ events, error: null });
      },
      (error) => {
        console.error('❌ Error in events subscription:', error);
        callback({ events: [], error: error.message });
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('❌ Error setting up events subscription:', error);
    callback({ events: [], error: error.message });
    return () => {}; // Return empty unsubscribe function
  }
};

// Get a single event by ID
export const getEventById = async (eventId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { event: null, error: 'Firestore not configured' };
    }

    const eventRef = doc(db, 'events', eventId);
    const eventDoc = await getDoc(eventRef);
    
    if (!eventDoc.exists()) {
      return { event: null, error: 'Event not found' };
    }

    const data = eventDoc.data();
    const event = {
      id: eventDoc.id,
      title: data.title,
      description: data.description,
      location: data.location,
      host: data.host,
      image: data.image,
      date: data.date?.toDate ? data.date.toDate() : data.date,
      startTime: data.startTime?.toDate ? data.startTime.toDate() : data.startTime,
      endTime: data.endTime?.toDate ? data.endTime.toDate() : data.endTime,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
      userId: data.userId,
      creatorName: data.creatorName,
      creatorUsername: data.creatorUsername,
      creatorAvatar: data.creatorAvatar,
      groupId: data.groupId || null,
      friendsOnly: data.friendsOnly || false,
      // Format time string for display
      time: formatDateTime(
        data.date?.toDate ? data.date.toDate() : data.date,
        data.startTime?.toDate ? data.startTime.toDate() : data.startTime
      ),
    };

    return { event, error: null };
  } catch (error) {
    console.error('❌ Error fetching event:', error);
    return { event: null, error: error.message };
  }
};

// Join an event - creates or adds user to the event's group
export const joinEvent = async (eventId, userId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { success: false, error: 'Firestore not configured' };
    }

    // Get the event
    const eventRef = doc(db, 'events', eventId);
    const eventDoc = await getDoc(eventRef);

    if (!eventDoc.exists()) {
      return { success: false, error: 'Event not found' };
    }

    const eventData = eventDoc.data();
    
    // Check if event is friends-only and if user is a friend of the creator
    if (eventData.friendsOnly && eventData.userId !== userId) {
      // Get current user's username to check friendship
      const { getUsernameFromAuthUid } = await import('./friendsService');
      const { checkFriendship } = await import('./friendsService');
      
      const currentUsername = await getUsernameFromAuthUid(userId);
      const creatorUsername = eventData.creatorUsername;
      
      if (!currentUsername) {
        return { success: false, error: 'User not found' };
      }
      
      // Check if current user is friends with event creator
      // Get current user's friends list
      const currentUserRef = doc(db, 'users', currentUsername);
      const currentUserDoc = await getDoc(currentUserRef);
      
      if (!currentUserDoc.exists()) {
        return { success: false, error: 'User profile not found' };
      }
      
      const currentUserData = currentUserDoc.data();
      const friends = currentUserData.friends || [];
      
      // Check if creator's username is in current user's friends array
      if (!friends.includes(creatorUsername)) {
        return { success: false, error: 'This event is for friends only. You must be friends with the event creator to join.' };
      }
    }
    
    let groupId = eventData.groupId;

    // If event doesn't have a group yet, create one
    // The group creator should always be the event creator
    if (!groupId) {
      const { createGroup } = await import('./groupsService');
      
      // Create group with event details
      // The event creator is automatically the group creator and first member
      // Note: createGroup automatically adds the creator to members, so we pass empty array
      const groupResult = await createGroup({
        name: eventData.title,
        description: `Group for ${eventData.title}`,
        creator: eventData.userId, // Event creator is group creator
        members: [], // Empty - creator is automatically added by createGroup
        startTime: eventData.startTime?.toDate ? eventData.startTime.toDate() : eventData.startTime,
        endTime: eventData.endTime?.toDate ? eventData.endTime.toDate() : eventData.endTime,
      });

      if (groupResult.error) {
        return { success: false, error: groupResult.error };
      }

      groupId = groupResult.groupId;

      // Update event with groupId
      // Note: This update is allowed by Firestore rules for setting groupId when it's null
      try {
        await updateDoc(eventRef, {
          groupId: groupId,
          updatedAt: serverTimestamp(),
        });
      } catch (updateError) {
        // If update fails (permission error), log it but continue
        // The group was created successfully, so we can still add the user
        console.warn('⚠️ Could not update event with groupId:', updateError.message);
        // Continue - the group exists and user can still join
      }
    }

    // Add user to the group (if not already a member)
    // Note: The event creator is already a member, so they won't be added again
    const { addMemberToGroup } = await import('./groupsService');
    const addResult = await addMemberToGroup(groupId, userId);

    if (addResult.error && addResult.error !== 'User is already a member') {
      return { success: false, error: addResult.error };
    }

    return { success: true, groupId, error: null };
  } catch (error) {
    console.error('❌ Error joining event:', error);
    return { success: false, error: error.message };
  }
};

// Check if user has joined an event
export const checkEventJoinStatus = async (eventId, userId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { joined: false, error: 'Firestore not configured' };
    }

    // Get the event
    const eventRef = doc(db, 'events', eventId);
    const eventDoc = await getDoc(eventRef);

    if (!eventDoc.exists()) {
      return { joined: false, error: 'Event not found' };
    }

    const eventData = eventDoc.data();
    const groupId = eventData.groupId;

    // If no group exists, user hasn't joined
    if (!groupId) {
      return { joined: false, error: null };
    }

    // Check if user is in the group
    const { getGroupById } = await import('./groupsService');
    const { group, error } = await getGroupById(groupId);

    if (error) {
      return { joined: false, error };
    }

    const joined = group?.members?.includes(userId) || false;
    return { joined, groupId, error: null };
  } catch (error) {
    console.error('❌ Error checking event join status:', error);
    return { joined: false, error: error.message };
  }
};

// Helper function to format date and time for display
const formatDateTime = (date, time) => {
  if (!date || !time) return '';
  
  const dateObj = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  const timeObj = time instanceof Date ? time : time.toDate ? time.toDate() : new Date(time);
  
  const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeStr = timeObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${dateStr} at ${timeStr}`;
};

// Update an event (only creator can update)
export const updateEvent = async (eventId, userId, eventData) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { error: 'Firestore not configured' };
    }

    const eventRef = doc(db, 'events', eventId);
    const eventDoc = await getDoc(eventRef);
    
    if (!eventDoc.exists()) {
      return { error: 'Event not found' };
    }

    const existingEventData = eventDoc.data();
    
    if (existingEventData.userId !== userId) {
      return { error: 'You can only update your own events' };
    }

    // Convert Date objects to Firestore Timestamps
    // Handle backward compatibility: if eventData.date exists, use it for both startDate and endDate
    let startDateTimestamp, endDateTimestamp;
    
    if (eventData.startDate && eventData.endDate) {
      // New format: use startDate and endDate
      startDateTimestamp = eventData.startDate instanceof Date 
        ? Timestamp.fromDate(eventData.startDate) 
        : Timestamp.fromMillis(eventData.startDate.getTime ? eventData.startDate.getTime() : eventData.startDate);
      
      endDateTimestamp = eventData.endDate instanceof Date 
        ? Timestamp.fromDate(eventData.endDate) 
        : Timestamp.fromMillis(eventData.endDate.getTime ? eventData.endDate.getTime() : eventData.endDate);
    } else if (eventData.date) {
      // Backward compatibility: use date for both startDate and endDate
      const dateTimestamp = eventData.date instanceof Date 
        ? Timestamp.fromDate(eventData.date) 
        : Timestamp.fromMillis(eventData.date.getTime ? eventData.date.getTime() : eventData.date);
      startDateTimestamp = dateTimestamp;
      endDateTimestamp = dateTimestamp;
    } else {
      // Keep existing dates if not provided
      startDateTimestamp = existingEventData.startDate || existingEventData.date;
      endDateTimestamp = existingEventData.endDate || existingEventData.date;
    }
    
    const startTimeTimestamp = eventData.startTime instanceof Date 
      ? Timestamp.fromDate(eventData.startTime) 
      : Timestamp.fromMillis(eventData.startTime.getTime ? eventData.startTime.getTime() : eventData.startTime);
    
    const endTimeTimestamp = eventData.endTime instanceof Date 
      ? Timestamp.fromDate(eventData.endTime) 
      : Timestamp.fromMillis(eventData.endTime.getTime ? eventData.endTime.getTime() : eventData.endTime);

    // Update the event
    await updateDoc(eventRef, {
      title: eventData.name.trim(),
      description: eventData.description.trim(),
      location: eventData.location.trim(),
      host: eventData.host.trim(),
      image: eventData.photo || existingEventData.image, // Keep existing image if no new photo
      startDate: startDateTimestamp,
      endDate: endDateTimestamp,
      startTime: startTimeTimestamp,
      endTime: endTimeTimestamp,
      friendsOnly: eventData.friendsOnly !== undefined ? eventData.friendsOnly : (existingEventData.friendsOnly || false),
      updatedAt: serverTimestamp(),
    });

    // Update the associated group's startTime and endTime to match the event
    if (existingEventData.groupId) {
      const groupRef = doc(db, 'groups', existingEventData.groupId);
      const groupDoc = await getDoc(groupRef);
      
      if (groupDoc.exists()) {
        await updateDoc(groupRef, {
          startTime: startTimeTimestamp,
          endTime: endTimeTimestamp,
          updatedAt: serverTimestamp(),
        });
        console.log('✅ Updated associated group endTime to match event');
      }
    }

    return { error: null };
  } catch (error) {
    console.error('❌ Error updating event:', error);
    return { error: error.message };
  }
};

// Delete an event (only creator can delete)
export const deleteEvent = async (eventId, userId) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      return { error: 'Firestore not configured' };
    }

    const eventRef = doc(db, 'events', eventId);
    const eventDoc = await getDoc(eventRef);
    
    if (!eventDoc.exists()) {
      return { error: 'Event not found' };
    }

    const eventData = eventDoc.data();
    
    if (eventData.userId !== userId) {
      return { error: 'You can only delete your own events' };
    }

    // Delete the associated group if it exists
    if (eventData.groupId) {
      const { deleteGroup } = await import('./groupsService');
      const deleteGroupResult = await deleteGroup(eventData.groupId, userId);
      
      if (deleteGroupResult.error) {
        console.error('❌ Error deleting associated group:', deleteGroupResult.error);
        // Continue with event deletion even if group deletion fails
        // (group might have been deleted separately or there might be a permission issue)
      } else {
        console.log('✅ Associated group deleted successfully');
      }
    }

    // Delete the event
    await deleteDoc(eventRef);
    return { error: null };
  } catch (error) {
    console.error('❌ Error deleting event:', error);
    return { error: error.message };
  }
};

