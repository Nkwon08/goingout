# iOS Push Notifications Setup Guide

This guide explains how to enable push notifications on iOS devices when the app is not in the foreground.

## What's Already Configured

✅ **Code Configuration:**
- `expo-notifications` plugin configured in `app.json`
- Background mode `remote-notification` added to `UIBackgroundModes` in `app.json`
- Notification handler configured in `services/notificationsService.js`
- Push token registration function implemented
- Notification response listener added in `App.js` to handle taps

## Required Steps to Enable Push Notifications

### 1. Configure APNs Credentials in EAS

You need to upload your Apple Push Notification service (APNs) credentials to EAS:

1. **Get APNs Key from Apple Developer:**
   - Go to [Apple Developer Portal](https://developer.apple.com/account/resources/authkeys/list)
   - Create a new Key (or use existing) with "Apple Push Notifications service (APNs)" enabled
   - Download the `.p8` key file
   - Note the Key ID and Team ID

2. **Upload to EAS:**
   ```bash
   eas credentials
   ```
   - Select your iOS project
   - Choose "Push Notifications"
   - Upload your `.p8` key file
   - Enter your Key ID and Team ID

   Or use the EAS web dashboard:
   - Go to [expo.dev](https://expo.dev)
   - Navigate to your project
   - Go to Credentials → iOS → Push Notifications
   - Upload your APNs key

### 2. Build with EAS (Not Expo Go)

⚠️ **Important:** Push notifications **do NOT work** in Expo Go. You must build a standalone app with EAS Build.

```bash
# For development/testing
eas build --profile preview --platform ios

# For production (App Store)
eas build --profile production --platform ios
```

### 3. Update Entitlements for Production

The `ios/Roll/Roll.entitlements` file currently has:
```xml
<key>aps-environment</key>
<string>development</string>
```

For App Store builds, EAS will automatically change this to `production`. For local builds, you may need to update it manually.

### 4. Test Push Notifications

1. **Build and install the app** on a physical iOS device (push notifications don't work in simulator)
2. **Grant notification permissions** when prompted
3. **Verify push token is saved:**
   - The app automatically registers for push notifications on login
   - Check Firestore: `users/{username}/pushToken` should contain the Expo push token
4. **Send a test notification:**
   - Close the app completely (swipe up from app switcher)
   - Have someone send you a friend request, comment, or group message
   - You should receive a push notification

### 5. Verify Background Notifications Work

To test that notifications work when the app is closed:

1. **Close the app completely** (not just backgrounded)
2. **Send a notification** (friend request, comment, etc.)
3. **Check your lock screen** - you should see the notification
4. **Tap the notification** - the app should open and navigate to the relevant screen

## Troubleshooting

### Notifications not appearing when app is closed:

1. **Check APNs credentials:**
   ```bash
   eas credentials
   ```
   Verify push notification credentials are configured

2. **Check device permissions:**
   - Settings → Roll → Notifications
   - Ensure "Allow Notifications" is enabled
   - Check that "Lock Screen", "Notification Center", and "Banners" are enabled

3. **Verify push token:**
   - Check Firestore: `users/{username}/pushToken`
   - Should contain a token starting with `ExponentPushToken[...]`

4. **Check build type:**
   - Must be built with EAS Build (not Expo Go)
   - Must be installed on a physical device (not simulator)

5. **Check logs:**
   - Look for errors in `services/notificationsService.js`
   - Check console for "Error sending push notification" messages

### Notifications work in foreground but not background:

- Ensure `UIBackgroundModes` includes `remote-notification` in `app.json` ✅ (already done)
- Rebuild the app after making changes to `app.json`

### Notifications appear but tapping doesn't navigate:

- Check that `App.js` has the notification response listener ✅ (already added)
- Verify navigation routes exist for the notification types

## Additional Notes

- **Development vs Production:** 
  - Development builds use APNs sandbox
  - Production builds use APNs production
  - EAS automatically handles this based on build profile

- **Expo Push Notification Service:**
  - Your app uses Expo's push notification service (not direct APNs)
  - Expo handles the APNs communication for you
  - Tokens are Expo push tokens, not native APNs tokens

- **Testing:**
  - Use a physical iOS device (simulator doesn't support push notifications)
  - Test with app completely closed (not just backgrounded)
  - Test with app in background
  - Test with app in foreground

## Summary

The code is already configured correctly. To enable push notifications:

1. ✅ Upload APNs credentials to EAS
2. ✅ Build with EAS (not Expo Go)
3. ✅ Install on physical device
4. ✅ Grant notification permissions
5. ✅ Test by closing app and sending a notification

Once these steps are complete, push notifications will work when the app is not in the foreground!

