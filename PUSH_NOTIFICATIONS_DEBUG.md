# Push Notifications Debugging Guide

## Quick Checklist

### 1. Are you using Expo Go?
❌ **Push notifications DO NOT work in Expo Go**
- You must build a standalone app with EAS Build
- Run: `eas build --profile preview --platform ios` (or android)

### 2. Check Console Logs

When you open the app, look for these logs:

**On Login:**
- `📱 Registering for push notifications...`
- `📱 Current notification permission status: ...`
- `✅ Notification permissions granted`
- `✅ Push token obtained: ExponentPushToken[...]`
- `✅ Push notification token saved to user document: [username]`

**When sending a notification:**
- `📤 Attempting to send push notification to userId: ...`
- `✅ Found username for push notification: ...`
- `✅ Found push token for user: ...`
- `📨 Sending push notification: ...`
- `✅ Push notification sent successfully: ...`

### 3. Check Firestore

1. Go to Firebase Console → Firestore Database
2. Navigate to: `users/{your-username}`
3. Check if `pushToken` field exists
4. The token should start with `ExponentPushToken[...]`

### 4. Check Device Settings

**iOS:**
- Settings → Roll → Notifications
- Ensure "Allow Notifications" is ON
- Check "Lock Screen", "Notification Center", and "Banners" are enabled

**Android:**
- Settings → Apps → Roll → Notifications
- Ensure notifications are enabled

### 5. Common Issues

#### Issue: "Permission not granted"
- **Solution:** Go to device Settings → Roll → Notifications → Enable

#### Issue: "Project ID not configured"
- **Solution:** Check `app.json` has `extra.eas.projectId` set

#### Issue: "User has no push token registered"
- **Solution:** 
  1. Make sure you granted notification permissions
  2. Check console logs for token registration errors
  3. Try logging out and back in

#### Issue: "Push notification failed" with errors
- **Solution:** 
  1. Check if APNs credentials are configured (iOS)
  2. Verify the push token is valid
  3. Check if you're using a development build vs production build

### 6. Test Push Notifications

1. **Close the app completely** (swipe up from app switcher)
2. Have someone send you a friend request, comment, or group message
3. Check your lock screen for the notification
4. Check console logs for any errors

### 7. Verify APNs Setup (iOS only)

If you're on iOS and notifications aren't working:

1. **Check if APNs credentials are uploaded:**
   ```bash
   eas credentials
   ```
   - Select iOS project
   - Check "Push Notifications" section
   - Should show your APNs key

2. **If not configured:**
   - Get APNs key from Apple Developer Portal
   - Upload via `eas credentials` or expo.dev dashboard

### 8. Debug Commands

Check your push token in Firestore:
```javascript
// In Firebase Console → Firestore
// Navigate to: users/{your-username}
// Look for: pushToken field
```

Test sending a notification manually:
```javascript
// You can test by having someone send you a friend request
// or comment on your post
```

## Still Not Working?

1. **Check all console logs** - Look for any ⚠️ or ❌ errors
2. **Verify you're not using Expo Go** - Must be EAS build
3. **Check Firestore** - Verify pushToken exists
4. **Check device permissions** - Settings → Roll → Notifications
5. **Try logging out and back in** - This re-registers the push token

