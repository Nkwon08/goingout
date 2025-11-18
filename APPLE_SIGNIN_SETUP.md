# Apple Sign-In Setup Guide

Follow these steps to enable Apple Sign-In in your app. You'll need to configure both your Apple Developer account and Firebase.

## Prerequisites
- Apple Developer Account (paid membership required)
- Firebase project set up
- Your app's bundle identifier: `com.anonymous.roll`

## Step 1: Enable Sign in with Apple in App ID

1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click on **Identifiers** in the left sidebar
4. Find or create your App ID:
   - If it doesn't exist, click the **+** button to create a new App ID
   - **Description**: Roll (or your app name)
   - **Bundle ID**: `com.anonymous.roll` (must match your `app.json`)
   - **Capabilities**: Check **Sign In with Apple**
5. Click **Continue** and then **Register**
6. **Important**: Make sure "Sign In with Apple" is enabled for this App ID

## Step 2: Create a Service ID for Sign in with Apple

1. Still in **Identifiers**, click the **+** button again
2. Select **Services IDs** and click **Continue**
3. Fill in:
   - **Description**: Roll Sign In with Apple (or any descriptive name)
   - **Identifier**: Something like `com.anonymous.roll.signin` (this will be your Service ID)
4. Click **Continue** and then **Register**
5. **Edit** the Service ID you just created
6. Check **Sign In with Apple**
7. Click **Configure** next to "Sign In with Apple"
8. In the configuration:
   - **Primary App ID**: Select your App ID (`com.anonymous.roll`)
   - **Website URLs**:
     - **Domains**: `goingout-8b2e0.firebaseapp.com` (your Firebase auth domain)
     - **Return URLs**: `https://goingout-8b2e0.firebaseapp.com/__/auth/handler`
   - Click **Save**
9. Click **Continue** and then **Save**

## Step 3: Create a Key for Sign in with Apple

1. In Apple Developer Portal, go to **Keys** (under Certificates, Identifiers & Profiles)
2. Click the **+** button to create a new key
3. Fill in:
   - **Key Name**: Roll Apple Sign In Key (or any name)
   - **Enable**: Check **Sign In with Apple**
4. Click **Continue** and then **Register**
5. **IMPORTANT**: Download the key file (`.p8` file) - you can only download it once!
6. Note down the **Key ID** (you'll need this for Firebase)

## Step 4: Configure Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `goingout-8b2e0`
3. Go to **Authentication** > **Sign-in method**
4. Click on **Apple** provider
5. Click **Enable**
6. Fill in the configuration:
   - **Service ID**: The Service ID you created in Step 2 (e.g., `com.anonymous.roll.signin`)
   - **Apple Team ID**: Your Apple Team ID (found in Apple Developer Portal > Membership)
   - **Key ID**: The Key ID from Step 3
   - **Private Key**: Upload the `.p8` key file you downloaded in Step 3
7. Click **Save**

## Step 5: Verify Configuration

Your configuration should match:
- **App Bundle ID**: `com.anonymous.roll` (in `app.json`)
- **Apple App ID**: `com.anonymous.roll` (in Apple Developer Portal)
- **Apple Service ID**: `com.anonymous.roll.signin` (or whatever you named it)
- **Firebase Service ID**: Must match the Apple Service ID

## Step 6: Test Apple Sign-In

1. **Important**: Apple Sign-In only works in production builds, not in Expo Go
2. Build your app with EAS:
   ```bash
   eas build --platform ios --profile preview
   ```
3. Install the build on your device
4. Try signing in with Apple
5. It should work!

## 🔧 Troubleshooting

### Step-by-Step Verification

**First, check the console logs** - The error message will now show more details. Look for:
- The exact error code
- The audience value (if it's an audience mismatch)
- Any specific configuration issues

### Error: "Apple Sign In configuration error" or "audience doesn't match"

**Most Common Cause**: The Service ID in Firebase doesn't match what Apple is sending.

**Step-by-Step Fix**:

1. **Verify Your Bundle ID**:
   - Open `app.json` in your project
   - Check `expo.ios.bundleIdentifier` - it should be `com.anonymous.roll`
   - If it's different, update it and rebuild

2. **Check Apple Developer Portal - App ID**:
   - Go to [Apple Developer Portal](https://developer.apple.com/account/) > Certificates, Identifiers & Profiles > Identifiers
   - Find your App ID: `com.anonymous.roll`
   - Click on it and verify:
     - ✅ "Sign In with Apple" is checked/enabled
     - ✅ Bundle ID is exactly `com.anonymous.roll` (no spaces, correct capitalization)

3. **Check Apple Developer Portal - Service ID**:
   - Still in Identifiers, find your Service ID (e.g., `com.anonymous.roll.signin`)
   - Click on it and verify:
     - ✅ "Sign In with Apple" is checked
     - ✅ Primary App ID is set to `com.anonymous.roll`
     - ✅ Return URLs includes: `https://goingout-8b2e0.firebaseapp.com/__/auth/handler`
     - ⚠️ **IMPORTANT**: Copy the exact Service ID identifier (e.g., `com.anonymous.roll.signin`)

4. **Check Firebase Console**:
   - Go to [Firebase Console](https://console.firebase.google.com/) > Authentication > Sign-in method > Apple
   - Verify:
     - ✅ Apple provider is **Enabled**
     - ✅ **Service ID** matches EXACTLY the Service ID from Apple Developer Portal (step 3)
     - ✅ **Apple Team ID** is correct (found in Apple Developer Portal > Membership)
     - ✅ **Key ID** matches the key you created
     - ✅ **Private Key** is uploaded (the `.p8` file)

5. **Common Mistakes**:
   - ❌ Using the App ID (`com.anonymous.roll`) as the Service ID in Firebase - **WRONG!**
   - ✅ Use the Service ID (e.g., `com.anonymous.roll.signin`) in Firebase - **CORRECT!**
   - ❌ Service ID has extra spaces or different capitalization
   - ❌ Return URL is missing or incorrect
   - ❌ Using Expo Go instead of a production build

### Error: "Key ID not found" or "Invalid Key"
**Solution**: 
- Go to Apple Developer Portal > Keys
- Find your Sign In with Apple key
- Verify the Key ID matches exactly in Firebase (case-sensitive)
- If you lost the `.p8` file, you'll need to create a new key and update Firebase

### Error: "Service ID not found"
**Solution**: 
- Verify the Service ID in Firebase **exactly** matches the one in Apple Developer Portal (character-by-character)
- Check that the Service ID has "Sign In with Apple" enabled in Apple Developer Portal
- Verify the return URL is: `https://goingout-8b2e0.firebaseapp.com/__/auth/handler`

### Still Not Working?

1. **Check if you're using Expo Go**:
   - Apple Sign-In will NOT work in Expo Go
   - You MUST build with EAS Build: `eas build --platform ios --profile preview`
   - Install the build on your device and test

2. **Verify the error in console**:
   - The updated code now logs detailed error information
   - Check your console/terminal for the full error details
   - Look for the "audience" value - it should match your Service ID

3. **Double-check all IDs match exactly**:
   - App Bundle ID: `com.anonymous.roll`
   - Apple App ID: `com.anonymous.roll`
   - Apple Service ID: `com.anonymous.roll.signin` (or whatever you named it)
   - Firebase Service ID: Must match Apple Service ID exactly

## 📝 Quick Checklist

- [ ] App ID created with `com.anonymous.roll` bundle ID
- [ ] Sign In with Apple enabled in App ID
- [ ] Service ID created (e.g., `com.anonymous.roll.signin`)
- [ ] Service ID configured with return URL: `https://goingout-8b2e0.firebaseapp.com/__/auth/handler`
- [ ] Key created for Sign In with Apple
- [ ] Key file (`.p8`) downloaded and saved
- [ ] Key ID noted
- [ ] Firebase Apple provider enabled
- [ ] Service ID, Team ID, Key ID, and Private Key added to Firebase
- [ ] App built with EAS Build (not using Expo Go)

---

**Note**: Apple Sign-In requires a paid Apple Developer account ($99/year). It will NOT work in Expo Go - you must build the app with EAS Build.

