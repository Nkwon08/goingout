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
    const dateTimestamp = eventData.date instanceof Date 
      ? Timestamp.fromDate(eventData.date) 
      : Timestamp.fromMillis(eventData.date.getTime ? eventData.date.getTime() : eventData.date);
    
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
      date: dateTimestamp,
      startTime: startTimeTimestamp,
      endTime: endTimeTimestamp,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    console.log('📅 Creating event:', eventToCreate.title);

    // Create the event in Firestore
    const eventRef = await addDoc(collection(db, 'events'), eventToCreate);
    
    return { eventId: eventRef.id, error: null };
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
        date: data.date?.toDate ? data.date.toDate() : data.date,
        startTime: data.startTime?.toDate ? data.startTime.toDate() : data.startTime,
        endTime: data.endTime?.toDate ? data.endTime.toDate() : data.endTime,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
        userId: data.userId,
        creatorName: data.creatorName,
        creatorUsername: data.creatorUsername,
        creatorAvatar: data.creatorAvatar,
        // Format time string for display
        time: formatDateTime(
          data.date?.toDate ? data.date.toDate() : data.date,
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

// Helper function to format date and time for display
const formatDateTime = (date, time) => {
  if (!date || !time) return '';
  
  const dateObj = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  const timeObj = time instanceof Date ? time : time.toDate ? time.toDate() : new Date(time);
  
  const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeStr = timeObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${dateStr} at ${timeStr}`;
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

    if (eventDoc.data().userId !== userId) {
      return { error: 'You can only delete your own events' };
    }

    await deleteDoc(eventRef);
    return { error: null };
  } catch (error) {
    console.error('❌ Error deleting event:', error);
    return { error: error.message };
  }
};

