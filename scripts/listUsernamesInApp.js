// Utility to list all usernames - call this from your app
// Usage: Import this in your app and call listAllUsernames()

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * List all usernames from Firestore
 * Call this from anywhere in your app (e.g., a screen or component)
 * @returns {Promise<Array>} Array of user objects with username, name, email, uid
 */
export const listAllUsernames = async () => {
  try {
    console.log('📋 Fetching all usernames from Firestore...');

    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);

    if (snapshot.empty) {
      console.log('❌ No users found in database');
      return [];
    }

    const users = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      users.push({
        uid: doc.id,
        username: data.username || data.email?.split('@')[0] || 'N/A',
        name: data.name || 'N/A',
        email: data.email || 'N/A',
        bio: data.bio || null,
        age: data.age || null,
        gender: data.gender || null,
      });
    });

    // Sort by username
    users.sort((a, b) => a.username.localeCompare(b.username));

    console.log(`\n✅ Found ${users.length} users:\n`);
    console.log('═'.repeat(90));
    console.log(`${'Username'.padEnd(25)} ${'Name'.padEnd(25)} ${'Email'.padEnd(30)}`);
    console.log('═'.repeat(90));

    users.forEach((user) => {
      console.log(`${user.username.padEnd(25)} ${user.name.padEnd(25)} ${user.email.padEnd(30)}`);
    });

    console.log('═'.repeat(90));
    console.log(`\n📊 Total: ${users.length} users`);
    
    console.log('\n📝 Usernames only:');
    users.forEach((user, index) => {
      console.log(`  ${(index + 1).toString().padStart(3)}. ${user.username}`);
    });

    return users;
  } catch (error) {
    console.error('❌ Error fetching usernames:', error);
    console.error('Error details:', error.message);
    return [];
  }
};

