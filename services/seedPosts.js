// Seed posts service - creates fake Bloomington bar posts for testing
import {
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Fake Bloomington bar posts
const fakePosts = [
  {
    userId: 'seed_user_1',
    name: 'Alex',
    username: 'alex_h',
    avatar: 'https://i.pravatar.cc/100?img=7',
    text: 'The Upstairs Pub has amazing vibes tonight! 🍺 The live music is fire and the crowd is awesome. Definitely checking this spot out again!',
    location: 'Upstairs Pub, Bloomington',
    image: null,
    images: null,
    likes: 24,
    retweets: 5,
    replies: 3,
    liked: false,
  },
  {
    userId: 'seed_user_2',
    name: 'Morgan',
    username: 'morgan_t',
    avatar: 'https://i.pravatar.cc/100?img=8',
    text: 'Brothers Bar & Grill never disappoints! 🎉 Just saw the best band play here. Great drinks, great atmosphere!',
    location: 'Brothers Bar & Grill, Bloomington',
    image: null,
    images: null,
    likes: 18,
    retweets: 4,
    replies: 2,
    liked: false,
  },
  {
    userId: 'seed_user_3',
    name: 'Sam',
    username: 'sam_w',
    avatar: 'https://i.pravatar.cc/100?img=9',
    text: 'Kilroy\'s on Kirkwood is packed tonight! 🎵 The DJ is spinning bangers and everyone is having a great time. This is the spot!',
    location: 'Kilroy\'s on Kirkwood, Bloomington',
    image: null,
    images: null,
    likes: 32,
    retweets: 8,
    replies: 5,
    liked: false,
  },
  {
    userId: 'seed_user_4',
    name: 'Taylor',
    username: 'taylor_r',
    avatar: 'https://i.pravatar.cc/100?img=5',
    text: 'The Vid is where it\'s at! 🔥 Amazing bartenders, great selection, and the patio is perfect for tonight. Highly recommend!',
    location: 'The Vid Restaurant & Bar, Bloomington',
    image: null,
    images: null,
    likes: 15,
    retweets: 3,
    replies: 1,
    liked: false,
  },
  {
    userId: 'seed_user_5',
    name: 'Jordan',
    username: 'jordan_k',
    avatar: 'https://i.pravatar.cc/100?img=6',
    text: 'Just discovered Crazy Horse! 🤠 This place is incredible - country vibes, great drinks, and friendly crowd. New favorite spot!',
    location: 'Crazy Horse, Bloomington',
    image: null,
    images: null,
    likes: 21,
    retweets: 6,
    replies: 4,
    liked: false,
  },
  {
    userId: 'seed_user_6',
    name: 'Casey',
    username: 'casey_m',
    avatar: 'https://i.pravatar.cc/100?img=12',
    text: 'Nick\'s English Hut for the win! 🍕 Best pizza in town and the bar scene is always lit. Perfect Friday night spot!',
    location: 'Nick\'s English Hut, Bloomington',
    image: null,
    images: null,
    likes: 28,
    retweets: 7,
    replies: 3,
    liked: false,
  },
  {
    userId: 'seed_user_7',
    name: 'Riley',
    username: 'riley_p',
    avatar: 'https://i.pravatar.cc/100?img=13',
    text: 'The Bluebird is INSANE tonight! 🎸 Live band killing it, packed dance floor, and the energy is unmatched. This is why Bloomington bars are the best!',
    location: 'The Bluebird, Bloomington',
    image: null,
    images: null,
    likes: 41,
    retweets: 12,
    replies: 6,
    liked: false,
  },
  {
    userId: 'seed_user_8',
    name: 'Avery',
    username: 'avery_l',
    avatar: 'https://i.pravatar.cc/100?img=14',
    text: 'Check out The Tap! 🍻 Great craft beer selection and the atmosphere is perfect for hanging with friends. Weekend vibes!',
    location: 'The Tap, Bloomington',
    image: null,
    images: null,
    likes: 19,
    retweets: 4,
    replies: 2,
    liked: false,
  },
];

// Seed posts to Firestore
export const seedBloomingtonPosts = async () => {
  try {
    console.log('🌱 Starting to seed Bloomington posts...');
    
    // Check if db is configured
    // Firestore v9+ doesn't have 'collection' method, check if it's empty object (development mode)
    if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
      console.error('❌ Firestore not configured');
      return { 
        success: false, 
        error: 'Firestore not configured. Please check your Firebase configuration.' 
      };
    }
    
    const results = [];
    
    for (const post of fakePosts) {
      const postData = {
        ...post,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      console.log(`📝 Creating post: ${post.location}`);
      const docRef = await addDoc(collection(db, 'posts'), postData);
      console.log(`✅ Post created with ID: ${docRef.id}`);
      results.push({ id: docRef.id, location: post.location });
    }
    
    console.log(`✅ Successfully seeded ${results.length} posts`);
    return { 
      success: true, 
      message: `Successfully seeded ${results.length} posts`,
      results 
    };
  } catch (error) {
    console.error('❌ Error seeding posts:', error);
    console.error('❌ Error message:', error.message);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

// Check if posts already exist before seeding
export const checkAndSeedPosts = async () => {
  try {
    const { getDocs, collection } = await import('firebase/firestore');
    const postsSnapshot = await getDocs(collection(db, 'posts'));
    
    if (postsSnapshot.empty) {
      return await seedBloomingtonPosts();
    } else {
      return {
        success: false,
        message: 'Posts already exist in database. Delete existing posts first or seed manually.',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

