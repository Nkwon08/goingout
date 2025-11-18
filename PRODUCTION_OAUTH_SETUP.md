# Production OAuth Setup for App Store

This guide will help you set up production-ready Google OAuth for App Store submission.

## Why This Is Needed

- Expo's development proxy (`https://auth.expo.io/...`) cannot be used in App Store production builds
- You need platform-specific OAuth clients (iOS and Android) for standalone apps
- This ensures Google Sign-In works for real users in the App Store

## Step 1: Create iOS OAuth Client

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Make sure you're in project: **goingout-8b2e0**
3. Navigate to **APIs & Services** > **Credentials**
4. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
5. Choose **iOS** as the application type
6. Fill in:
   - **Name**: Roll iOS Client (or any name)
   - **Bundle ID**: `com.anonymous.roll` (must match your `app.json`)
7. Click **CREATE**
8. **Copy the iOS Client ID** (looks like: `123456789-abcdefghijklmnop.apps.googleusercontent.com`)

## Step 2: Create Android OAuth Client

1. Still in **APIs & Services** > **Credentials**
2. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
3. Choose **Android** as the application type
4. Fill in:
   - **Name**: Roll Android Client (or any name)
   - **Package name**: `com.anonymous.roll` (must match your `app.json`)
   - **SHA-1 certificate fingerprint**: You'll need to get this from your Android keystore
     - For now, you can add it later or use EAS to get it
5. Click **CREATE**
6. **Copy the Android Client ID**

**Note**: For Android, you'll need the SHA-1 fingerprint. You can get it later when building with EAS.

## Step 3: Update Your Code

After creating the OAuth clients, update `config/firebase.js`:

```javascript
// Web Client ID (for Firebase backend)
export const GOOGLE_CLIENT_ID = '861094736123-v0qb4hdkq5e7r46sse6cr4sjk62abuvk.apps.googleusercontent.com';

// iOS Client ID (for App Store builds)
export const GOOGLE_IOS_CLIENT_ID = 'YOUR_IOS_CLIENT_ID_HERE';

// Android Client ID (for Play Store builds)
export const GOOGLE_ANDROID_CLIENT_ID = 'YOUR_ANDROID_CLIENT_ID_HERE';
```

Then update `screens/LoginScreen.js` and `screens/SignUpScreen.js` to use:

```javascript
const [request, response, promptAsync] = Google.useAuthRequest({
  clientId: GOOGLE_CLIENT_ID, // Web client ID (still needed for Firebase)
  iosClientId: GOOGLE_IOS_CLIENT_ID, // iOS-specific client
  androidClientId: GOOGLE_ANDROID_CLIENT_ID, // Android-specific client
});
```

## Step 4: Verify Your Bundle IDs Match

Make sure these match exactly:

- **app.json** `ios.bundleIdentifier`: `com.anonymous.roll`
- **app.json** `android.package`: `com.anonymous.roll`
- **Google Cloud Console iOS OAuth Client Bundle ID**: `com.anonymous.roll`
- **Google Cloud Console Android OAuth Client Package Name**: `com.anonymous.roll`

## Step 5: Test the Configuration

1. Update the code with your new client IDs
2. Build a preview build: `eas build --platform ios --profile preview`
3. Install on your device
4. Test Google Sign-In
5. It should work without the "Custom scheme URIs not allowed" error

## Important Notes

- **Web Client ID** is still needed for Firebase backend authentication
- **iOS Client ID** is used when running on iOS devices
- **Android Client ID** is used when running on Android devices
- **No Expo proxy needed** - this works in standalone production builds
- **App Store ready** - this configuration works for App Store submission

## Troubleshooting

### Error: "Invalid client"
- Make sure the Bundle ID/Package Name matches exactly in Google Cloud Console
- Check that you copied the correct Client ID

### Error: "redirect_uri_mismatch"
- For iOS/Android OAuth clients, redirect URIs are handled automatically
- You don't need to configure redirect URIs for native clients
- This error shouldn't occur with platform-specific clients

### Android SHA-1 Fingerprint
- You'll need to add the SHA-1 fingerprint for Android
- Get it from your keystore or EAS build logs
- Add it in Google Cloud Console > Android OAuth Client > SHA-1 certificate fingerprints

## Next Steps

1. Create the iOS and Android OAuth clients in Google Cloud Console
2. Copy the Client IDs
3. Update `config/firebase.js` with the new IDs
4. Update `screens/LoginScreen.js` and `screens/SignUpScreen.js`
5. Test with a preview build
6. Submit to App Store!

