# Apple Sign-In Troubleshooting: Audience Mismatch

## Error Message
```
Apple Sign In configuration error. The ID token audience (com.anonymous.roll) doesn't match your Firebase Service ID.
```

## What This Means

The Apple ID token has an audience of `com.anonymous.roll` (your bundle identifier), but Firebase is expecting a different Service ID. This happens when:

1. The Service ID in Firebase doesn't match what's configured in Apple Developer Portal
2. For native iOS apps, the Service ID might need special configuration

## Solution: Verify and Fix Configuration

### Step 1: Check Apple Developer Portal

1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigate to **Certificates, Identifiers & Profiles** > **Identifiers**
3. Find your **Service ID** (e.g., `com.anonymous.roll.signin`)
4. Click on it and verify:
   - ✅ "Sign In with Apple" is enabled
   - ✅ **Primary App ID** is set to `com.anonymous.roll`
   - ✅ **Return URLs** includes: `https://goingout-8b2e0.firebaseapp.com/__/auth/handler`
5. **Copy the exact Service ID** (e.g., `com.anonymous.roll.signin`)

### Step 2: Check Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `goingout-8b2e0`
3. Go to **Authentication** > **Sign-in method** > **Apple**
4. Check the **Service ID** field
5. **It should EXACTLY match** the Service ID from Apple Developer Portal (Step 1)

### Step 3: Common Fixes

#### Option A: Service ID Mismatch (Most Common)

**Problem**: The Service ID in Firebase doesn't match Apple Developer Portal.

**Solution**:
1. Copy the exact Service ID from Apple Developer Portal (e.g., `com.anonymous.roll.signin`)
2. Paste it into Firebase Console > Authentication > Sign-in method > Apple > Service ID
3. Make sure there are no extra spaces or typos
4. Click **Save**
5. Try signing in again

#### Option B: Use Bundle Identifier as Service ID (For Native Apps)

**Problem**: For native iOS apps using `expo-apple-authentication`, the ID token audience is the bundle identifier.

**Solution**:
1. In Firebase Console > Authentication > Sign-in method > Apple
2. Try setting the **Service ID** to `com.anonymous.roll` (your bundle identifier)
3. **BUT FIRST**: Make sure in Apple Developer Portal, you have a Service ID that matches this, OR
4. Create a new Service ID with identifier `com.anonymous.roll` (same as bundle ID)

**Note**: This is less common but might be needed for native apps.

#### Option C: Verify Service ID Configuration in Apple Developer Portal

**Problem**: The Service ID exists but isn't configured correctly.

**Solution**:
1. In Apple Developer Portal, edit your Service ID
2. Make sure:
   - ✅ "Sign In with Apple" is checked
   - ✅ Primary App ID is `com.anonymous.roll`
   - ✅ Return URL is: `https://goingout-8b2e0.firebaseapp.com/__/auth/handler`
3. Save the configuration
4. Wait a few minutes for changes to propagate
5. Try again

### Step 4: Verify All Settings Match

**Checklist**:
- [ ] App Bundle ID: `com.anonymous.roll` (in `app.json`)
- [ ] Apple App ID: `com.anonymous.roll` (in Apple Developer Portal)
- [ ] Apple Service ID: `com.anonymous.roll.signin` (or whatever you named it)
- [ ] Firebase Service ID: **Must match Apple Service ID exactly**
- [ ] Service ID Return URL: `https://goingout-8b2e0.firebaseapp.com/__/auth/handler`
- [ ] Apple Team ID matches in both places
- [ ] Key ID matches in both places
- [ ] Private Key (.p8 file) is uploaded to Firebase

### Step 5: Test Again

1. Rebuild your app: `eas build --platform ios --profile preview`
2. Install the new build on your device
3. Try signing in with Apple
4. Check the console logs for the exact error message

## Still Not Working?

### Check Console Logs

The app now logs detailed error information. Look for:
- `Error code: ...`
- `Error message: ...`
- `Full error: ...`

This will help identify the exact issue.

### Common Mistakes

1. ❌ **Using App ID instead of Service ID in Firebase**
   - App ID: `com.anonymous.roll`
   - Service ID: `com.anonymous.roll.signin` (different!)

2. ❌ **Extra spaces or typos in Service ID**
   - `com.anonymous.roll.signin` ✅
   - `com.anonymous.roll.signin ` ❌ (extra space)
   - `com.anonymous.roll.SignIn` ❌ (wrong capitalization)

3. ❌ **Wrong Return URL**
   - Correct: `https://goingout-8b2e0.firebaseapp.com/__/auth/handler`
   - Wrong: `https://goingout-8b2e0.firebaseapp.com/__/auth/handler/` (trailing slash)
   - Wrong: `http://goingout-8b2e0.firebaseapp.com/__/auth/handler` (http instead of https)

4. ❌ **Using Expo Go instead of production build**
   - Apple Sign-In requires a production build
   - Use: `eas build --platform ios --profile preview`

## Quick Verification Steps

1. **Apple Developer Portal**:
   - Service ID: `com.anonymous.roll.signin` (or your actual Service ID)
   - Return URL: `https://goingout-8b2e0.firebaseapp.com/__/auth/handler`

2. **Firebase Console**:
   - Service ID: **Must match exactly** the Service ID from Apple Developer Portal
   - Team ID: Your Apple Team ID
   - Key ID: Your Key ID
   - Private Key: Your `.p8` file

3. **Your App**:
   - Bundle ID: `com.anonymous.roll` (in `app.json`)

If all three match correctly, Apple Sign-In should work!

