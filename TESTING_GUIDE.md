# Testing Guide

## 🚀 Quick Start Testing

### Option 1: Test with Development Mode (No Firebase Required)

The app will automatically run in development mode if Firebase credentials are not configured. This lets you test the UI and navigation.

**What works:**
- ✅ UI/UX flow
- ✅ Navigation between screens
- ✅ Theme switching (dark/light mode)
- ✅ Form validation
- ❌ Data persistence (needs Firebase)
- ❌ Authentication (needs Firebase)

**To test:**
1. Run `npm start` or `expo start`
2. Scan QR code with Expo Go app
3. Navigate through screens

### Option 2: Test with Firebase (Full Functionality)

Follow these steps to test with real Firebase backend:

#### Step 1: Set Up Firebase (5 minutes)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select existing
3. Enable these services:
   - **Authentication**: Email/Password
   - **Firestore Database**: Test mode
   - **Storage**: Test mode

#### Step 2: Get Firebase Config

1. In Firebase Console → Project Settings
2. Scroll to "Your apps"
3. Add iOS/Android app if not already added
4. Copy config values (web config works for React Native)

#### Step 3: Update Config

Open `outlink/config/firebase.js` and replace:
```javascript
const firebaseConfig = {
  apiKey: 'YOUR_ACTUAL_API_KEY',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abc123',
};
```

#### Step 4: Restart App

```bash
npm start
# Or press 'r' in the terminal to reload
```

## 📱 Testing Scenarios

### 1. Authentication Flow
- [ ] Launch app → Should show Login screen
- [ ] Tap "Sign up" → Should navigate to SignUp screen
- [ ] Fill form → Should validate inputs
- [ ] Submit → Should create account (if Firebase configured)
- [ ] Login → Should navigate to main app

### 2. Posts Feed
- [ ] View feed → Should show posts (or empty state)
- [ ] Pull to refresh → Should reload posts
- [ ] Tap FAB → Should open compose modal
- [ ] Create post → Should upload images and create post
- [ ] See new post → Should appear in feed in real-time

### 3. Account Screen
- [ ] View profile → Should show user info
- [ ] Toggle dark mode → Should switch theme
- [ ] Tap logout → Should sign out and show login

### 4. Error Handling
- [ ] Invalid login → Should show error message
- [ ] Network error → Should show snackbar
- [ ] Missing fields → Should validate form

## 🐛 Common Issues

### Issue: "Firebase not initialized"
**Solution**: Check that `config/firebase.js` has valid credentials

### Issue: "Auth domain error"
**Solution**: Ensure `authDomain` matches your Firebase project domain

### Issue: "Permission denied" in Firestore
**Solution**: Set Firestore rules to test mode temporarily:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Issue: App crashes on startup
**Solution**: 
1. Check console for errors
2. Ensure all dependencies installed: `npm install`
3. Clear cache: `expo start --clear`

## 📊 Testing Checklist

- [ ] App launches without errors
- [ ] Login screen displays correctly
- [ ] Sign up form validates inputs
- [ ] Can create account (with Firebase)
- [ ] Can log in (with Firebase)
- [ ] Feed loads posts (with Firebase)
- [ ] Can create new post (with Firebase)
- [ ] Images upload successfully (with Firebase)
- [ ] Real-time updates work (with Firebase)
- [ ] Logout works
- [ ] Dark mode toggle works
- [ ] Error messages display correctly
- [ ] Loading states show appropriately

## 🔍 Debug Mode

To see Firebase logs:
- Check Metro bundler console
- Check device/emulator logs
- Use React Native Debugger
- Check Firebase Console for errors

## ✅ Ready for Production

Before production, ensure:
- [ ] Firebase security rules are set
- [ ] Production Firebase project created
- [ ] Bundle ID/Package name configured
- [ ] Error tracking implemented
- [ ] Privacy policy added
- [ ] Terms of service added

---

**Current Status**: Ready for Firebase configuration and testing!

