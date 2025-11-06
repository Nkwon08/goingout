// Script to list all usernames from Firestore
// Run with: node scripts/listUsernames.mjs

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA4LjGDNcL_MnTKN28zhtVB3Tc8T5G3Gkk",
  authDomain: "goingout-8b2e0.firebaseapp.com",
  projectId: "goingout-8b2e0",
  storageBucket: "goingout-8b2e0.appspot.com",
  messagingSenderId: "861094736123",
  appId: "1:861094736123:web:4e7163d87a8624b3ae805e",
  measurementId: "G-VRM4FBNHM7",
};

async function listUsernames() {
  try {
    console.log('📋 Connecting to Firestore...\n');
    
    const app = initializeApp(firebaseConfig);
    const db = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      useFetchStreams: false,
    });

    console.log('📋 Fetching all usernames from Firestore...\n');

    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);

    if (snapshot.empty) {
      console.log('❌ No users found in database');
      process.exit(0);
      return;
    }

    const usernames = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      const username = data.username || data.email?.split('@')[0] || 'N/A';
      const uid = doc.id;
      const email = data.email || 'N/A';
      const name = data.name || 'N/A';
      
      usernames.push({
        uid,
        username,
        name,
        email,
      });
    });

    // Sort by username
    usernames.sort((a, b) => a.username.localeCompare(b.username));

    console.log(`✅ Found ${usernames.length} users:\n`);
    console.log('═'.repeat(90));
    console.log(`${'Username'.padEnd(25)} ${'Name'.padEnd(25)} ${'Email'.padEnd(30)} ${'UID'.padEnd(20)}`);
    console.log('═'.repeat(90));

    usernames.forEach((user) => {
      console.log(`${user.username.padEnd(25)} ${user.name.padEnd(25)} ${user.email.padEnd(30)} ${user.uid.substring(0, 15)}...`);
    });

    console.log('═'.repeat(90));
    console.log(`\n📊 Total: ${usernames.length} users`);
    
    // Also list just usernames
    console.log('\n📝 Usernames only:');
    usernames.forEach((user, index) => {
      console.log(`  ${(index + 1).toString().padStart(3)}. ${user.username}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error fetching usernames:', error);
    console.error('Error details:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    process.exit(1);
  }
}

listUsernames();

