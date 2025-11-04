# Firebase Storage Rules Setup

If you're getting Firebase Storage errors when uploading images, you need to configure your Firebase Storage security rules.

## Steps to Fix:

1. **Go to Firebase Console**: https://console.firebase.google.com
2. **Select your project**: `goingout-8b2e0`
3. **Navigate to Storage**: Click "Storage" in the left menu
4. **Click "Rules" tab**: At the top of the Storage page
5. **Update the rules** to allow authenticated users to upload:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow authenticated users to upload images
    match /posts/{userId}/{allPaths=**} {
      allow read: if true; // Anyone can read posts
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow authenticated users to upload profile pictures
    match /profile/{userId}/{allPaths=**} {
      allow read: if true; // Anyone can read profiles
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Default: deny all other access
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

6. **Click "Publish"** to save the rules
7. **Restart your app**: `expo start --clear`

## What these rules do:

- **Authenticated users can upload** to their own folders (`posts/{userId}/` and `profile/{userId}/`)
- **Anyone can read** the images (public viewing)
- **Users can only write to their own folders** (security)

## Common Error Codes:

- `storage/unauthorized` - Storage rules are blocking the upload
- `storage/canceled` - Upload was canceled
- `storage/unknown` - Network or configuration issue

If you still get errors after updating the rules, check the console logs for specific error messages.

