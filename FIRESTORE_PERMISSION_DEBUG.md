# Debugging Firestore Permission Errors

## Current Error
```
❌ Error sending friend request: [FirebaseError: Missing or insufficient permissions.]
```

## Step 1: Verify Rules Are Published

1. Go to: https://console.firebase.google.com/project/goingout-8b2e0/firestore/rules
2. Check that you see the `friendRequests` section in your rules
3. **IMPORTANT**: Click "Publish" button (even if rules look correct)
4. Wait 30 seconds after publishing

## Step 2: Verify Rule Syntax

Copy your entire rules file and check for:
- ✅ All braces `{}` are matched
- ✅ All parentheses `()` are matched  
- ✅ No extra commas or semicolons
- ✅ Rules are properly indented

## Step 3: Test Rule Directly

The create rule should be:
```javascript
allow create: if request.auth != null && 
  request.resource.data.fromUserId == request.auth.uid;
```

**This checks:**
- User is authenticated (`request.auth != null`)
- The `fromUserId` in the new document matches the current user's UID

## Step 4: Verify User Authentication

Make sure you're signed in. Check in your app:
- Are you logged in?
- Is `user.uid` available?
- Try logging out and back in

## Step 5: Alternative Rule (If Still Not Working)

If the above doesn't work, try this slightly more permissive create rule:

```javascript
match /friendRequests/{requestId} {
  // More permissive - allows any authenticated user to create
  // if they're the sender (this is what we want anyway)
  allow create: if request.auth != null && 
    request.resource.data.fromUserId == request.auth.uid &&
    request.resource.data.toUserId != request.auth.uid;
  
  // Keep other rules the same
  allow read: if request.auth != null && (
    resource.data.toUserId == request.auth.uid ||
    resource.data.fromUserId == request.auth.uid
  );
  
  allow update, delete: if request.auth != null && 
    resource.data.toUserId == request.auth.uid;
}
```

## Step 6: Test with Simpler Rules (Temporary)

If still not working, try this **temporary test rule** (less secure, for debugging only):

```javascript
match /friendRequests/{requestId} {
  // TEMPORARY: Very permissive for testing
  allow read, write: if request.auth != null;
}
```

**If this works**, then the issue is with your specific rule conditions.
**If this doesn't work**, then the issue is with authentication or rules not being published.

## Step 7: Check Firebase Console Logs

1. Go to: https://console.firebase.google.com/project/goingout-8b2e0/firestore/usage
2. Check "Denied requests" tab
3. Look for the specific error and which rule failed

## Common Issues

### Issue 1: Rules Not Published
- **Solution**: Click "Publish" button in Firebase Console

### Issue 2: User Not Authenticated
- **Solution**: Make sure user is signed in before trying to send request

### Issue 3: Document Already Exists
- **Solution**: The code now handles this - it checks if request exists first

### Issue 4: Rule Condition Mismatch
- **Solution**: Make sure `request.resource.data.fromUserId == request.auth.uid` matches your actual data

## Final Checklist

- [ ] Rules are published (clicked "Publish" button)
- [ ] Waited 30 seconds after publishing
- [ ] User is authenticated in the app
- [ ] Rule syntax is correct (no syntax errors)
- [ ] The `friendRequests` collection exists in Firestore
- [ ] Try logging out and back in

