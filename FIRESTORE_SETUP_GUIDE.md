# Firestore Database Setup Guide

## Problem: "Database doesn't exist" Error

If you're getting a "database doesn't exist" error, it means **Firestore hasn't been enabled** in your Firebase Console yet.

## Solution: Enable Firestore in Firebase Console

### Step 1: Go to Firebase Console
1. Open [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **goingout-8b2e0**

### Step 2: Enable Firestore Database
1. In the left sidebar, click **"Firestore Database"** (or "Build" → "Firestore Database")
2. If you see a **"Create database"** button, click it
3. If Firestore is already enabled, you'll see your collections

### Step 3: Choose Database Mode
- Select **"Start in production mode"** (Native mode) - this is what we need
- **OR** choose **"Start in test mode"** (for development - less secure but easier to start)

### Step 4: Choose Database Location
- Select a location close to your users (e.g., **us-central**, **us-east1**, etc.)
- Click **"Enable"**

### Step 5: Set Up Security Rules (Important!)

After enabling, you'll need to set up security rules. Go to the **"Rules"** tab and set:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - users can read any profile, update only their own
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Friend Requests collection
    // Users can:
    // - Create friend requests (send requests)
    // - Read incoming requests (where toUserId == their uid)
    // - Read outgoing requests (where fromUserId == their uid)
    // - Update/delete requests they can act on (accept/decline)
    match /friendRequests/{requestId} {
      // Allow read if user is the sender or receiver
      allow read: if request.auth != null && (
        resource.data.fromUserId == request.auth.uid ||
        resource.data.toUserId == request.auth.uid
      );
      
      // Allow create if user is the sender
      allow create: if request.auth != null && 
        request.resource.data.fromUserId == request.auth.uid;
      
      // Allow update/delete if user is the receiver (can accept/decline)
      allow update, delete: if request.auth != null && 
        resource.data.toUserId == request.auth.uid;
    }
    
    // Usernames collection - for username reservation
    match /usernames/{username} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Posts collection - users can read public posts, write their own
    match /posts/{postId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.resource.data.userId == request.auth.uid;
    }
    
    // Groups collection
    match /groups/{groupId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

**For Testing (Less Secure - Development Only):**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## What Happens After Enabling?

Once Firestore is enabled:
- ✅ Collections (`users`, `posts`, `groups`, `usernames`) are **automatically created** when you write to them
- ✅ Documents are **automatically created** when you write to them
- ✅ No manual database creation needed!

## Verify It's Working

After enabling Firestore:
1. Try signing up a new user in your app
2. Check Firebase Console → Firestore Database → `users` collection
3. You should see a document with the user's UID

## Common Errors After Setup

### "Permission denied"
- Check your security rules (Step 5 above)
- Make sure the user is authenticated (`request.auth != null`)

### "Collection doesn't exist"
- This is normal! Collections are created automatically on first write
- Just try creating a user/post and the collection will appear

## Need Help?

If you're still getting errors:
1. Check the browser console for the exact error message
2. Verify Firestore is enabled in Firebase Console
3. Verify your security rules allow the operation
4. Make sure you're signed in to the app

