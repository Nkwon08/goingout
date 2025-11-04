// Migration script to add usernameLowercase field to all existing users
// Run this once to update all users in your database
//
// How to run:
// 1. Make sure your Firebase is configured in config/firebase.js
// 2. Run: node scripts/migrateUsernames.js
// OR run it in your app's code once

import { collection, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

// Export function for use in React Native app
export const migrateUsernames = async () => {
  try {
    console.log('🚀 Starting username migration...');
    console.log('📡 Connecting to Firestore...');
    
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      console.error('❌ Firestore not configured. Please check your Firebase configuration.');
      return;
    }
    
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    console.log(`📦 Found ${snapshot.docs.length} users in database`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Process each user document
    for (const userDoc of snapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      // Check if user has username but missing usernameLowercase
      if (userData.username && !userData.usernameLowercase) {
        try {
          const usernameLowercase = String(userData.username).trim().toLowerCase();
          
          await updateDoc(doc(db, 'users', userId), {
            usernameLowercase: usernameLowercase,
            updatedAt: serverTimestamp(),
          });
          
          console.log(`✅ Updated user ${userId}: "${userData.username}" → usernameLowercase: "${usernameLowercase}"`);
          updatedCount++;
        } catch (error) {
          console.error(`❌ Error updating user ${userId}:`, error.message);
          errorCount++;
        }
      } else if (userData.usernameLowercase) {
        console.log(`⏭️  Skipped user ${userId}: already has usernameLowercase`);
        skippedCount++;
      } else if (!userData.username) {
        console.log(`⏭️  Skipped user ${userId}: no username field`);
        skippedCount++;
      }
    }
    
    console.log('\n✅ Migration completed!');
    console.log(`📊 Results:`);
    console.log(`   - Updated: ${updatedCount} users`);
    console.log(`   - Skipped: ${skippedCount} users`);
    console.log(`   - Errors: ${errorCount} users`);
    
    if (updatedCount > 0) {
      console.log('\n🎉 Successfully added usernameLowercase to', updatedCount, 'users!');
      console.log('🔍 Username search should now work for all users.');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('❌ Error details:', error.message);
    throw error; // Re-throw so caller can handle it
  }
};

// For use in React Native app  
export default migrateUsernames;

