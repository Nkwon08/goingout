# Firestore Security Rules for Friend Requests

## Problem
You're getting "Missing or insufficient permissions" errors because Firestore security rules don't allow access to the `friendRequests` collection.

## Solution: Update Firestore Security Rules

Go to [Firebase Console - Firestore Rules](https://console.firebase.google.com/project/goingout-8b2e0/firestore/rules)

Replace your rules with this complete set:

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

## Rules Explanation

### Friend Requests Rules:

1. **Read**: Users can read requests where:
   - They are the sender (`fromUserId == uid`), OR
   - They are the receiver (`toUserId == uid`)

2. **Create**: Users can create requests where:
   - They are the sender (`fromUserId == uid`)

3. **Update/Delete**: Users can update/delete requests where:
   - They are the receiver (`toUserId == uid`) - allows accept/decline

## How to Apply

1. Go to [Firebase Console - Firestore Rules](https://console.firebase.google.com/project/goingout-8b2e0/firestore/rules)
2. Copy the rules above
3. Paste into the rules editor
4. Click **"Publish"**
5. Wait a few seconds for rules to propagate

## Testing After Rules Update

After updating the rules:
1. Try sending a friend request from FriendsTab
2. Check NotificationsTab - should see the request
3. Try accepting/declining - should work without errors

## Security Notes

- Users can only send requests (create), not read all requests
- Users can only accept/decline their own incoming requests
- Users can see their own incoming and outgoing requests
- Prevents users from modifying other users' requests

