# Google Sign-In Setup Guide

Follow these steps to enable Google Sign-In in your app.

## Step 1: Enable Google Sign-In in Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Authentication** > **Sign-in method**
4. Click on **Google** provider
5. Click **Enable**
6. Set your project support email
7. Click **Save**

## Step 2: Get Google OAuth Client ID

### Option A: From Firebase Console (Recommended)

1. In Firebase Console, go to **Authentication** > **Sign-in method**
2. Click on **Google** provider
3. Look for **Web SDK configuration**
4. Copy the **Web Client ID** (looks like: `123456789-abcdefghijklmnop.apps.googleusercontent.com`)

### Option B: From Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Go to **APIs & Services** > **Credentials**
4. Find or create an **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Copy the **Client ID**

## Step 3: Update Config

Open `config/firebase.js` and update:

```javascript
export const GOOGLE_CLIENT_ID = 'YOUR_ACTUAL_GOOGLE_CLIENT_ID_HERE';
```

**Important**: Use the **Web Client ID**, not the iOS or Android client ID.

## Step 4: Configure OAuth Redirect URI

### For Expo Go (Development)

Expo's proxy automatically handles redirect URIs. No additional configuration needed.

### For Production Build

1. In Google Cloud Console, go to your OAuth 2.0 Client
2. Add these **Authorized redirect URIs**:
   ```
   https://auth.expo.io/@your-username/your-app-slug
   exp://localhost:8081
   ```
   Replace `your-username` and `your-app-slug` with your Expo credentials.

## Step 5: Test Google Sign-In

1. Restart your Expo app
2. Navigate to Login or Sign Up screen
3. Tap "Continue with Google"
4. Select your Google account
5. Grant permissions
6. You should be signed in!

## 🔧 Troubleshooting

### Error: "Google Client ID not configured"
**Solution**: Make sure `GOOGLE_CLIENT_ID` is set in `config/firebase.js`

### Error: "redirect_uri_mismatch"
**Solution**: 
1. Check Google Cloud Console
2. Add your Expo redirect URI to authorized URIs
3. For Expo Go, use: `https://auth.expo.io/@your-username/your-app-slug`

### Error: "Google sign in cancelled"
**Solution**: This is normal if user cancels the OAuth flow

### Error: "Firebase not configured"
**Solution**: Complete Firebase setup first (see `FIREBASE_SETUP.md`)

## 📱 How It Works

1. User taps "Continue with Google"
2. App opens Google OAuth in browser
3. User selects Google account and grants permission
4. Google returns ID token
5. Firebase creates/authenticates user with ID token
6. User document created in Firestore (if new user)
7. User is signed in and navigated to main app

## ✅ Features

- ✅ Automatic user creation in Firestore
- ✅ Profile data from Google (name, email, photo)
- ✅ Username auto-generated from email
- ✅ Works on both iOS and Android
- ✅ Works in Expo Go (development)

---

**Note**: Google Sign-In requires Firebase to be fully configured. Make sure you've completed the Firebase setup first.

