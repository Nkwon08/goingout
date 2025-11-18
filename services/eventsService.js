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
    
    // Log input data for debugging
    console.log('📅 Creating event with data:', {
      startDate: eventData.startDate,
      startTime: eventData.startTime,
      endDate: eventData.endDate,
      endTime: eventData.endTime,
      startDateType: typeof eventData.startDate,
      startTimeType: typeof eventData.startTime,
      endDateType: typeof eventData.endDate,
      endTimeType: typeof eventData.endTime,
    });

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
    
    // Combine startDate with startTime to create full start datetime
    let startDateTime;
    if (eventData.startTime && eventData.startDate) {
      // Get startDate as a Date object
      let startDateObj;
      if (eventData.startDate instanceof Date) {
        startDateObj = new Date(eventData.startDate);
      } else if (eventData.startDate?.toDate) {
        startDateObj = eventData.startDate.toDate();
      } else if (eventData.startDate) {
        startDateObj = new Date(eventData.startDate);
      } else {
        throw new Error('startDate is required');
      }
      
      // Get startTime as a Date object
      let startTimeObj;
      if (eventData.startTime instanceof Date) {
        startTimeObj = new Date(eventData.startTime);
      } else if (eventData.startTime?.toDate) {
        startTimeObj = eventData.startTime.toDate();
      } else if (eventData.startTime) {
        startTimeObj = new Date(eventData.startTime);
      } else {
        throw new Error('startTime is required');
      }
      
      // Validate dates are valid
      if (isNaN(startDateObj.getTime())) {
        throw new Error('Invalid startDate');
      }
      if (isNaN(startTimeObj.getTime())) {
        throw new Error('Invalid startTime');
      }
      
      // Combine date and time
      try {
        // Create a new Date from the startDate to avoid mutating the original
        startDateTime = new Date(startDateObj.getTime());
        
        // Extract only the time components (hours, minutes, seconds) from startTime
        // This ensures we're not affected by any date component in startTime
        const hours = startTimeObj.getHours();
        const minutes = startTimeObj.getMinutes();
        const seconds = startTimeObj.getSeconds();
        
        // Validate time components are within valid ranges
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
          throw new Error(`Invalid time components: ${hours}:${minutes}:${seconds}`);
        }
        
        startDateTime.setHours(hours);
        startDateTime.setMinutes(minutes);
        startDateTime.setSeconds(seconds);
        startDateTime.setMilliseconds(0);
        
        // Validate combined datetime
        if (isNaN(startDateTime.getTime())) {
          throw new Error(`Invalid combined startDateTime. startDate: ${startDateObj.toISOString()}, startTime: ${startTimeObj.toISOString()}`);
        }
      } catch (error) {
        console.error('Error combining startDate and startTime:', error);
        console.error('startDateObj:', startDateObj, 'isValid:', !isNaN(startDateObj.getTime()));
        console.error('startTimeObj:', startTimeObj, 'isValid:', !isNaN(startTimeObj.getTime()));
        throw new Error(`Failed to combine startDate and startTime: ${error.message}`);
      }
    } else if (eventData.startDate) {
      // Fallback: use startDate as startTime
      if (eventData.startDate instanceof Date) {
        startDateTime = new Date(eventData.startDate);
      } else if (eventData.startDate?.toDate) {
        startDateTime = eventData.startDate.toDate();
      } else {
        startDateTime = new Date(eventData.startDate);
      }
    } else {
      throw new Error('startDate and startTime are required');
    }
    
    // Combine endDate with endTime to create full end datetime
    let endDateTime;
    if (eventData.endTime && eventData.endDate) {
      // Get endDate as a Date object
      let endDateObj;
      if (eventData.endDate instanceof Date) {
        endDateObj = new Date(eventData.endDate);
      } else if (eventData.endDate?.toDate) {
        endDateObj = eventData.endDate.toDate();
      } else if (eventData.endDate) {
        endDateObj = new Date(eventData.endDate);
      } else {
        throw new Error('endDate is required');
      }
      
      // Get endTime as a Date object
      let endTimeObj;
      if (eventData.endTime instanceof Date) {
        endTimeObj = new Date(eventData.endTime);
      } else if (eventData.endTime?.toDate) {
        endTimeObj = eventData.endTime.toDate();
      } else if (eventData.endTime) {
        endTimeObj = new Date(eventData.endTime);
      } else {
        throw new Error('endTime is required');
      }
      
      // Validate dates are valid
      if (isNaN(endDateObj.getTime())) {
        throw new Error('Invalid endDate');
      }
      if (isNaN(endTimeObj.getTime())) {
        throw new Error('Invalid endTime');
      }
      
      // Combine date and time
      try {
        // Create a new Date from the endDate to avoid mutating the original
        endDateTime = new Date(endDateObj.getTime());
        
        // Extract only the time components (hours, minutes, seconds) from endTime
        // This ensures we're not affected by any date component in endTime
        const hours = endTimeObj.getHours();
        const minutes = endTimeObj.getMinutes();
        const seconds = endTimeObj.getSeconds();
        
        // Validate time components are within valid ranges
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
          throw new Error(`Invalid time components: ${hours}:${minutes}:${seconds}`);
        }
        
        endDateTime.setHours(hours);
        endDateTime.setMinutes(minutes);
        endDateTime.setSeconds(seconds);
        endDateTime.setMilliseconds(0);
        
        // Validate combined datetime
        if (isNaN(endDateTime.getTime())) {
          throw new Error(`Invalid combined endDateTime. endDate: ${endDateObj.toISOString()}, endTime: ${endTimeObj.toISOString()}`);
        }
      } catch (error) {
        console.error('Error combining endDate and endTime:', error);
        console.error('endDateObj:', endDateObj, 'isValid:', !isNaN(endDateObj.getTime()));
        console.error('endTimeObj:', endTimeObj, 'isValid:', !isNaN(endTimeObj.getTime()));
        throw new Error(`Failed to combine endDate and endTime: ${error.message}`);
      }
    } else if (eventData.endDate) {
      // Fallback: use endDate as endTime
      if (eventData.endDate instanceof Date) {
        endDateTime = new Date(eventData.endDate);
      } else if (eventData.endDate?.toDate) {
        endDateTime = eventData.endDate.toDate();
      } else {
        endDateTime = new Date(eventData.endDate);
      }
    } else {
      throw new Error('endDate and endTime are required');
    }
    
    // Convert combined datetimes to Firestore Timestamps
    let startTimeTimestamp, endTimeTimestamp;
    try {
      startTimeTimestamp = Timestamp.fromDate(startDateTime);
      console.log('✅ Created startTimeTimestamp:', startTimeTimestamp.toDate().toISOString());
    } catch (error) {
      console.error('❌ Error creating startTimeTimestamp:', error);
      console.error('startDateTime:', startDateTime, 'isValid:', !isNaN(startDateTime.getTime()));
      throw new Error(`Failed to create startTimeTimestamp: ${error.message}`);
    }
    
    try {
      endTimeTimestamp = Timestamp.fromDate(endDateTime);
      console.log('✅ Created endTimeTimestamp:', endTimeTimestamp.toDate().toISOString());
    } catch (error) {
      console.error('❌ Error creating endTimeTimestamp:', error);
      console.error('endDateTime:', endDateTime, 'isValid:', !isNaN(endDateTime.getTime()));
      throw new Error(`Failed to create endTimeTimestamp: ${error.message}`);
    }

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
      startTime: startDateTime,
      endTime: endDateTime,
      coverPhoto: eventToCreate.image || null, // Use event photo as group cover photo
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
      // Combine startDate + startTime and endDate + endTime to create full datetimes
      const startDateObj = eventData.startDate?.toDate ? eventData.startDate.toDate() : (eventData.startDate || (eventData.date?.toDate ? eventData.date.toDate() : eventData.date));
      const endDateObj = eventData.endDate?.toDate ? eventData.endDate.toDate() : (eventData.endDate || (eventData.date?.toDate ? eventData.date.toDate() : eventData.date));
      const startTimeObj = eventData.startTime?.toDate ? eventData.startTime.toDate() : eventData.startTime;
      const endTimeObj = eventData.endTime?.toDate ? eventData.endTime.toDate() : eventData.endTime;
      
      // Combine dates and times
      const startDateTime = new Date(startDateObj);
      if (startTimeObj) {
        startDateTime.setHours(startTimeObj.getHours());
        startDateTime.setMinutes(startTimeObj.getMinutes());
        startDateTime.setSeconds(startTimeObj.getSeconds());
        startDateTime.setMilliseconds(0);
      }
      
      const endDateTime = new Date(endDateObj);
      if (endTimeObj) {
        endDateTime.setHours(endTimeObj.getHours());
        endDateTime.setMinutes(endTimeObj.getMinutes());
        endDateTime.setSeconds(endTimeObj.getSeconds());
        endDateTime.setMilliseconds(0);
      }
      
      const groupResult = await createGroup({
        name: eventData.title,
        description: `Group for ${eventData.title}`,
        creator: eventData.userId, // Event creator is group creator
        members: [], // Empty - creator is automatically added by createGroup
        startTime: startDateTime,
        endTime: endDateTime,
        coverPhoto: eventData.image || null, // Use event photo as group cover photo
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
    
    // Combine startDate with startTime to create full start datetime
    let startDateTime;
    if (eventData.startTime) {
      const startDateObj = eventData.startDate instanceof Date 
        ? new Date(eventData.startDate) 
        : (eventData.startDate?.toDate ? eventData.startDate.toDate() : (eventData.startDate || (existingEventData.startDate?.toDate ? existingEventData.startDate.toDate() : existingEventData.startDate)));
      const startTimeObj = eventData.startTime instanceof Date 
        ? eventData.startTime 
        : (eventData.startTime?.toDate ? eventData.startTime.toDate() : new Date(eventData.startTime));
      
      startDateTime = new Date(startDateObj);
      startDateTime.setHours(startTimeObj.getHours());
      startDateTime.setMinutes(startTimeObj.getMinutes());
      startDateTime.setSeconds(startTimeObj.getSeconds());
      startDateTime.setMilliseconds(0);
    } else {
      // Fallback: use startDate as startTime
      startDateTime = eventData.startDate instanceof Date 
        ? eventData.startDate 
        : (eventData.startDate?.toDate ? eventData.startDate.toDate() : (eventData.startDate || (existingEventData.startDate?.toDate ? existingEventData.startDate.toDate() : existingEventData.startDate)));
    }
    
    // Combine endDate with endTime to create full end datetime
    let endDateTime;
    if (eventData.endTime) {
      const endDateObj = eventData.endDate instanceof Date 
        ? new Date(eventData.endDate) 
        : (eventData.endDate?.toDate ? eventData.endDate.toDate() : (eventData.endDate || (existingEventData.endDate?.toDate ? existingEventData.endDate.toDate() : existingEventData.endDate)));
      const endTimeObj = eventData.endTime instanceof Date 
        ? eventData.endTime 
        : (eventData.endTime?.toDate ? eventData.endTime.toDate() : new Date(eventData.endTime));
      
      endDateTime = new Date(endDateObj);
      endDateTime.setHours(endTimeObj.getHours());
      endDateTime.setMinutes(endTimeObj.getMinutes());
      endDateTime.setSeconds(endTimeObj.getSeconds());
      endDateTime.setMilliseconds(0);
    } else {
      // Fallback: use endDate as endTime
      endDateTime = eventData.endDate instanceof Date 
        ? eventData.endDate 
        : (eventData.endDate?.toDate ? eventData.endDate.toDate() : (eventData.endDate || (existingEventData.endDate?.toDate ? existingEventData.endDate.toDate() : existingEventData.endDate)));
    }
    
    const startTimeTimestamp = Timestamp.fromDate(startDateTime);
    const endTimeTimestamp = Timestamp.fromDate(endDateTime);

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

    if (!userId) {
      return { error: 'User ID is required' };
    }

    const eventRef = doc(db, 'events', eventId);
    const eventDoc = await getDoc(eventRef);
    
    if (!eventDoc.exists()) {
      return { error: 'Event not found' };
    }

    const eventData = eventDoc.data();
    
    // Log for debugging
    console.log('🔍 Delete event check:', {
      eventId,
      eventUserId: eventData.userId,
      currentUserId: userId,
      match: eventData.userId === userId,
      hasUserId: !!eventData.userId
    });
    
    if (!eventData.userId) {
      return { error: 'Event does not have a userId field. Cannot verify ownership.' };
    }
    
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
    console.log('✅ Event deleted successfully');
    return { error: null };
  } catch (error) {
    console.error('❌ Error deleting event:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    return { error: error.message };
  }
};

