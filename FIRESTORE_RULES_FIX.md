# Firestore Security Rules Fix for Friend Requests

## Problem
The read rule is too restrictive for queries. When querying with `where('toUserId', '==', userId)`, Firestore needs to evaluate the rule for the query, not just individual documents.

## Solution: Update the Read Rule

Replace your current `friendRequests` read rule with this version that allows queries:

```javascript
match /friendRequests/{requestId} {
  // Allow read if user is the sender or receiver
  // This works for both individual document reads and queries
  allow read: if request.auth != null && (
    resource == null || // Document doesn't exist yet (for queries)
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
```

## Alternative: Simpler Query-Friendly Rule

If the above doesn't work, try this simpler version that allows queries on `toUserId` and `fromUserId`:

```javascript
match /friendRequests/{requestId} {
  // Allow read for queries where user is involved
  allow read: if request.auth != null && (
    // Check if querying by toUserId (incoming requests)
    (request.query.limit != null && resource.data.toUserId == request.auth.uid) ||
    // Check if querying by fromUserId (outgoing requests)  
    (request.query.limit != null && resource.data.fromUserId == request.auth.uid) ||
    // Allow individual document reads
    (!request.query.limit && (
      resource.data.fromUserId == request.auth.uid ||
      resource.data.toUserId == request.auth.uid
    ))
  );
  
  allow create: if request.auth != null && 
    request.resource.data.fromUserId == request.auth.uid;
  
  allow update, delete: if request.auth != null && 
    resource.data.toUserId == request.auth.uid;
}
```

## Recommended: Most Flexible Rule

This is the most permissive but still secure - it allows any authenticated user to read friend requests where they're involved:

```javascript
match /friendRequests/{requestId} {
  // Allow read if user is the sender or receiver (works for queries too)
  allow read: if request.auth != null && (
    resource.data.toUserId == request.auth.uid ||
    resource.data.fromUserId == request.auth.uid
  );
  
  allow create: if request.auth != null && 
    request.resource.data.fromUserId == request.auth.uid;
  
  allow update, delete: if request.auth != null && 
    resource.data.toUserId == request.auth.uid;
}
```

## Complete Updated Rules

Here's your complete rules file with the fixed friendRequests section:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users collection - users can read any profile, update only their own
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Friend Requests collection - FIXED VERSION
    match /friendRequests/{requestId} {
      // Allow read if user is the sender or receiver
      allow read: if request.auth != null && (
        resource.data.toUserId == request.auth.uid ||
        resource.data.fromUserId == request.auth.uid
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

## How to Apply

1. Go to [Firebase Console - Firestore Rules](https://console.firebase.google.com/project/goingout-8b2e0/firestore/rules)
2. Replace the `friendRequests` section with the recommended version above
3. Click **"Publish"**
4. Wait 10-30 seconds for rules to propagate
5. Try sending a friend request again

## Testing

After updating:
1. Try sending a friend request - should work now
2. Check NotificationsTab - should see incoming requests
3. Try accepting/declining - should work

