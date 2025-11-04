# Firebase Setup Guide

Follow these steps to set up Firebase for your app.

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard
4. Enable Google Analytics (optional)

## Step 2: Add Firebase to Your App

### For iOS and Android:

1. In Firebase Console, click the gear icon ⚙️ > Project Settings
2. Scroll down to "Your apps"
3. Click the iOS icon to add iOS app:
   - Bundle ID: `com.anonymous.outlink` (or your custom bundle ID)
   - Register app
4. Click the Android icon to add Android app:
   - Package name: `com.anonymous.outlink` (or your custom package name)
   - Register app

## Step 3: Enable Firebase Services

### Authentication:
1. Go to Firebase Console > Authentication
2. Click "Get started"
3. Enable these sign-in methods:
   - Email/Password (required)
   - Optional: Google, Apple, Facebook

### Firestore Database:
1. Go to Firebase Console > Firestore Database
2. Click "Create database"
3. Start in **test mode** for development (we'll add security rules later)
4. Choose a location close to your users

### Storage:
1. Go to Firebase Console > Storage
2. Click "Get started"
3. Start in **test mode** for development
4. Choose same location as Firestore

## Step 4: Get Your Firebase Config

1. Go to Firebase Console > Project Settings
2. Scroll down to "Your apps"
3. Select your app (iOS or Android)
4. Find the `firebaseConfig` object
5. Copy the values:
   - apiKey
   - authDomain
   - projectId
   - storageBucket
   - messagingSenderId
   - appId

## Step 5: Update Firebase Config in App

Open `outlink/config/firebase.js` and replace the placeholder values:

```javascript
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_AUTH_DOMAIN',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
};
```

## Step 6: Install iOS Pods (iOS only)

If using iOS, run:
```bash
cd ios && pod install && cd ..
```

## Step 7: Set Up Security Rules (Later)

Once your app is working, update Firestore and Storage security rules in Firebase Console.

### Firestore Rules (basic):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /posts/{postId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
  }
}
```

### Storage Rules (basic):
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /posts/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Database Structure

Your Firestore database should have these collections:

### `users` collection:
```
users/{userId}
  - uid: string
  - email: string
  - name: string
  - username: string
  - avatar: string (URL)
  - createdAt: timestamp
  - updatedAt: timestamp
```

### `posts` collection:
```
posts/{postId}
  - userId: string
  - name: string
  - username: string
  - avatar: string (URL)
  - text: string
  - location: string (optional)
  - image: string (URL, optional)
  - images: array (URLs, optional)
  - likes: number
  - retweets: number
  - replies: number
  - createdAt: timestamp
  - updatedAt: timestamp
```

## Next Steps

1. Update `config/firebase.js` with your Firebase credentials
2. Wrap your app with `AuthProvider` in `App.js`
3. Update screens to use Firebase services instead of mock data
4. Test authentication and data flow

