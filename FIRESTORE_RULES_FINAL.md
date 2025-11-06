# Final Firestore Security Rules Fix

## Problem
The read rule might be too restrictive when checking if a request exists before creating a new one. The query needs to work properly.

## Solution: Updated Rules

Here's the corrected version with better read handling:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users collection - users can read any profile, update only their own
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Friend Requests collection - FIXED FOR QUERIES
    match /friendRequests/{requestId} {
      // Allow read if user is the sender or receiver
      // This works for both individual reads and queries
      allow read: if request.auth != null && (
        resource.data.toUserId == request.auth.uid ||
        resource.data.fromUserId == request.auth.uid
      );
      
      // Allow create if user is the sender AND not sending to themselves
      allow create: if request.auth != null && 
        request.resource.data.fromUserId == request.auth.uid &&
        request.resource.data.toUserId != request.auth.uid;
      
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

## Key Changes

1. **Create rule**: Added check to ensure `toUserId != fromUserId` (can't send request to self)
2. **Read rule**: Same as before, but should work for queries

## Alternative: More Permissive Read (For Testing)

If still not working, try this more permissive read rule temporarily:

```javascript
match /friendRequests/{requestId} {
  // More permissive read - allows any authenticated user to read
  // (only for testing - less secure)
  allow read: if request.auth != null;
  
  // Keep create and update/delete rules the same
  allow create: if request.auth != null && 
    request.resource.data.fromUserId == request.auth.uid &&
    request.resource.data.toUserId != request.auth.uid;
  
  allow update, delete: if request.auth != null && 
    resource.data.toUserId == request.auth.uid;
}
```

## Steps to Apply

1. Go to: https://console.firebase.google.com/project/goingout-8b2e0/firestore/rules
2. Replace the `friendRequests` section with the updated version above
3. Click **"Publish"**
4. Wait 30 seconds
5. Try sending a friend request again

## If Still Not Working

Try this **temporary test rule** to see if it's a rule issue or something else:

```javascript
match /friendRequests/{requestId} {
  // TEMPORARY: Very permissive for testing
  allow read, write: if request.auth != null;
}
```

If this works, the issue is with your specific rule conditions.
If this doesn't work, the issue is authentication or rules not being published.

