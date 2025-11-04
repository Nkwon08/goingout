# Friend System Testing Guide

## Test Scenarios

### 1. Basic Friend Request Flow
- [ ] User A searches for User B by username
- [ ] User A sends friend request to User B
- [ ] User B receives request notification
- [ ] User B accepts request
- [ ] Both users see each other in friends list
- [ ] Real-time updates work (no refresh needed)

### 2. Mutual Requests (Auto-Accept)
- [ ] User A sends request to User B
- [ ] User B sends request to User A (before accepting A's request)
- [ ] System should auto-accept when B sends request
- [ ] Both users immediately become friends
- [ ] No duplicate friendship documents created

### 3. Race Conditions
- [ ] Two users send requests to each other simultaneously
- [ ] Both requests should resolve without duplicates
- [ ] Only one friendship should be created (bidirectional)
- [ ] No duplicate friendship documents

### 4. Request Status Handling
- [ ] Cannot send duplicate request (shows "Request Sent")
- [ ] Cannot send request to existing friend (shows "Friends")
- [ ] Can accept received request
- [ ] Can decline received request
- [ ] Declined request doesn't appear again

### 5. Rapid Accept/Decline
- [ ] User A sends request
- [ ] User B rapidly clicks Accept multiple times
- [ ] Should only create friendship once (no duplicates)
- [ ] Should handle gracefully without errors

### 6. Unfriend (Remove Friend)
- [ ] User A removes User B as friend
- [ ] Both friendship documents deleted
- [ ] User B's friends list updates in real-time
- [ ] User B no longer appears in User A's friends list
- [ ] Can send new friend request after unfriend

### 7. Offline Mode
- [ ] User sends friend request while offline
- [ ] Request should queue and send when online
- [ ] Accept/decline actions queue while offline
- [ ] Real-time updates resume when back online

### 8. Search and Filtering
- [ ] Search by username finds users (prefix matching)
- [ ] Current user filtered out from results
- [ ] Already-friends filtered out (or shown as "Friends")
- [ ] Pending requests shown with correct status
- [ ] Search is debounced (doesn't search on every keystroke)

### 9. UI Edge Cases
- [ ] Friend removes you - you disappear from their list automatically
- [ ] Friend removes you - your real-time listener updates
- [ ] Multiple friend requests show correctly
- [ ] Empty states show when no friends/requests

### 10. Performance
- [ ] Friend list loads quickly (parallel fetching)
- [ ] Search responds within 500ms (debounced)
- [ ] Real-time updates don't cause lag
- [ ] Large friend lists (>100) still perform well

## Expected Behavior

### Friend Request States
1. **No Request**: Shows "Add Friend" button
2. **Request Sent**: Shows "Request Sent" (disabled)
3. **Request Received**: Shows "Accept" and "Decline" buttons
4. **Already Friends**: Shows "Friends" (disabled)

### Database Consistency
- Friendship always has TWO documents (bidirectional)
- Accepted requests have `status: 'accepted'`
- No duplicate friendships for same pair
- Real-time listeners update UI automatically

### Error Handling
- Handles Firestore not configured gracefully
- Prevents self-friend requests
- Prevents duplicate requests
- Shows user-friendly error messages

## Testing Commands

```bash
# Test with multiple accounts
# Account 1: email1@test.com
# Account 2: email2@test.com

# Test scenarios:
1. Sign in as Account 1
2. Search for Account 2's username
3. Send friend request
4. Sign out and sign in as Account 2
5. Check friend requests tab
6. Accept request
7. Verify both users see each other in friends list
```

## Known Limitations

1. **Request Cleanup**: Accepted requests are kept (status='accepted') for history. To delete them, uncomment the `batch.delete(requestRef)` line in `acceptFriendRequest`.

2. **Storage**: Two friendship docs per friendship (storage vs simplicity trade-off). Alternative: single doc with compound index.

3. **Security Rules**: Firestore security rules should be implemented in production (see comments in `friendsService.js`).

