// Helper function to debug user search issues
// Can be called from console to check if a username exists
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export const debugUsernameSearch = async (searchUsername) => {
  try {
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      console.error('❌ Firestore not configured');
      return;
    }

    console.log('🔍 DEBUG: Searching for username:', searchUsername);
    const searchTerm = String(searchUsername).trim().toLowerCase();
    console.log('🔍 Normalized search term:', searchTerm);

    const usersRef = collection(db, 'users');
    const querySnapshot = await getDocs(usersRef);
    
    console.log('📊 Total users in database:', querySnapshot.docs.length);
    
    const allUsers = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        uid: doc.id,
        username: data.username || null,
        name: data.name || null,
        email: data.email || null,
        normalizedUsername: data.username ? String(data.username).toLowerCase().trim() : null,
      };
    });

    console.log('📋 All usernames in database:');
    allUsers.forEach((u) => {
      console.log('  -', {
        uid: u.uid,
        username: u.username || 'NULL',
        normalized: u.normalizedUsername || 'NULL',
        matches: u.normalizedUsername === searchTerm ? '✅ EXACT MATCH' : 
                 u.normalizedUsername?.includes(searchTerm) ? '✅ PARTIAL MATCH' : '❌ NO MATCH',
      });
    });

    const matches = allUsers.filter((u) => {
      if (!u.normalizedUsername) return false;
      return u.normalizedUsername === searchTerm || u.normalizedUsername.includes(searchTerm);
    });

    console.log('✅ Matching users:', matches.length);
    matches.forEach((u) => {
      console.log('  ✅', {
        uid: u.uid,
        username: u.username,
        name: u.name,
        email: u.email,
      });
    });

    return matches;
  } catch (error) {
    console.error('❌ Error in debug search:', error);
    return [];
  }
};

