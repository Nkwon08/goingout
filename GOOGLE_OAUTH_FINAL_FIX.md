# Final Fix for Google OAuth "Access Blocked" Error

## The Problem

You're getting "Access blocked: Authorization Error" because:
1. Your iOS client ID is the same as your web client ID (you haven't created a separate iOS client)
2. OR the redirect URI isn't configured correctly in Google Cloud Console

## Solution: Two Options

### Option 1: Create a Proper iOS OAuth Client (Recommended for Production)

This is the proper way for App Store builds:

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/apis/credentials
   - Project: **goingout-8b2e0**

2. **Create iOS OAuth Client**
   - Click **+ CREATE CREDENTIALS** > **OAuth client ID**
   - Choose **iOS** as application type
   - **Name**: Roll iOS Client
   - **Bundle ID**: `com.anonymous.roll` (must match your app.json exactly)
   - Click **CREATE**

3. **Copy the NEW iOS Client ID** (it will be different from your web client ID)

4. **Update `config/firebase.js`**
   - Replace `GOOGLE_IOS_CLIENT_ID` with the new iOS client ID

5. **Rebuild your app**
   - `eas build --platform ios --profile preview`
   - Install and test

**Note**: For iOS OAuth clients, you DON'T need to configure redirect URIs - they're handled automatically by Google.

### Option 2: Add Redirect URI to Web Client (Quick Fix)

If you want to keep using the web client for now:

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/apis/credentials
   - Project: **goingout-8b2e0**
   - Find your **Web Client**: `861094736123-v0qb4hdkq5e7r46sse6cr4sjk62abuvk.apps.googleusercontent.com`
   - Click to edit

2. **Add Authorized Redirect URIs**
   - Scroll to "Authorized redirect URIs"
   - Click **+ ADD URI**
   - Add: `https://auth.expo.io/@natkwon/roll`
     - Replace `@natkwon` with your Expo username (check with `expo whoami`)
     - Replace `roll` with your app slug
   - Also add: `roll://` (your app scheme)
   - Click **SAVE**

3. **Wait 2-5 minutes** for changes to propagate

4. **Test again**

## Check Your Expo Username

Run this to find your Expo username:
```bash
expo whoami
```

Then use: `https://auth.expo.io/@YOUR_USERNAME/roll`

## Verify Your Setup

1. **Check if you have a separate iOS client**:
   - Go to Google Cloud Console > Credentials
   - Look for an OAuth client with type "iOS"
   - If you don't have one, create it (Option 1)

2. **If using web client, check redirect URIs**:
   - Web client should have: `https://auth.expo.io/@natkwon/roll`
   - Make sure there are no typos

3. **Check your app.json**:
   - `slug: "roll"`
   - `scheme: "roll"`
   - `ios.bundleIdentifier: "com.anonymous.roll"`

## Why This Happens

- **Production builds** (EAS Build) use different redirect URIs than Expo Go
- **iOS OAuth clients** don't need redirect URI configuration (handled automatically)
- **Web OAuth clients** require explicit redirect URI configuration
- If your iOS client ID = web client ID, you're using the web client, which needs redirect URIs

## Recommended Solution

**Create a proper iOS OAuth client** (Option 1). This is the correct setup for production App Store builds and will avoid redirect URI issues entirely.

