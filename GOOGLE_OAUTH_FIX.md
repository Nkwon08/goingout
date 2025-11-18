# Fix Google OAuth "Custom scheme URIs not allowed" Error

## Error Message
```
Access blocked: Authorization Error
Custom scheme URIs are not allowed for 'WEB' client type.
Error 400: invalid_request
```

## What This Means

Google Cloud Console doesn't allow custom scheme URIs (like `roll://`) for OAuth clients configured as "Web application" type. Expo's `expo-auth-session` might be trying to use a custom scheme, but your OAuth client is set up as a web client.

## Solution: Configure Redirect URIs in Google Cloud Console

### Step 1: Go to Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Make sure you're in the correct project: **goingout-8b2e0**
3. Navigate to **APIs & Services** > **Credentials**
4. Find your OAuth 2.0 Client ID: `861094736123-v0qb4hdkq5e7r46sse6cr4sjk62abuvk.apps.googleusercontent.com`
5. Click on it to edit

### Step 2: Add Authorized Redirect URIs

In the **Authorized redirect URIs** section, add these URIs (one at a time):

#### For Expo Go (Development):
```
https://auth.expo.io/@anonymous/roll
exp://localhost:8081
exp://127.0.0.1:8081
```

#### For Production Builds:
```
https://auth.expo.io/@anonymous/roll
```

**Important Notes:**
- Replace `@anonymous` with your Expo username if you're logged in
- Replace `roll` with your app slug (check `app.json` - it's `"slug": "roll"`)
- Do NOT add custom scheme URIs like `roll://` - they're not allowed for web clients
- Use HTTPS URIs or Expo's proxy URIs instead

### Step 3: Save and Wait

1. Click **SAVE** at the bottom
2. Wait 2-5 minutes for changes to propagate
3. Try signing in again

## Alternative: Use Expo's Proxy (Recommended)

Expo's `expo-auth-session` automatically uses Expo's proxy server when available. The proxy URI format is:
```
https://auth.expo.io/@your-username/your-app-slug
```

For your app:
```
https://auth.expo.io/@anonymous/roll
```

Make sure this URI is added to your Google Cloud Console OAuth client.

## Verify Your Configuration

1. **Google Cloud Console**:
   - OAuth Client Type: **Web application**
   - Authorized redirect URIs include: `https://auth.expo.io/@anonymous/roll`

2. **Your App** (`app.json`):
   - `slug: "roll"`
   - Scheme: `roll` (this is fine for deep linking, but not for OAuth redirects)

3. **Expo Auth Session**:
   - Will automatically use Expo's proxy if available
   - Falls back to custom schemes if proxy isn't available

## Still Not Working?

### Check the Exact Redirect URI

When you try to sign in, check the console logs. The error message will show the exact redirect URI that was attempted. Add that exact URI to Google Cloud Console.

### Common Issues:

1. **Wrong Project**: Make sure you're editing the OAuth client in the correct Google Cloud project (`goingout-8b2e0`)

2. **Wrong Client ID**: Make sure you're using the Web Client ID (not iOS or Android client ID)

3. **Typo in URI**: The URI must match exactly, including:
   - Protocol (`https://` not `http://`)
   - Domain (`auth.expo.io`)
   - Path (`/@anonymous/roll`)
   - No trailing slashes

4. **Changes Not Propagated**: Wait 2-5 minutes after saving changes in Google Cloud Console

## Quick Fix Checklist

- [ ] Go to Google Cloud Console > APIs & Services > Credentials
- [ ] Find OAuth client: `861094736123-v0qb4hdkq5e7r46sse6cr4sjk62abuvk.apps.googleusercontent.com`
- [ ] Add redirect URI: `https://auth.expo.io/@anonymous/roll`
- [ ] Save changes
- [ ] Wait 2-5 minutes
- [ ] Try signing in again

## For Production Builds

If you're building a standalone app (not Expo Go), you might need to:

1. Create a separate OAuth client for production
2. Or use a different redirect URI format
3. Check Expo's documentation for production OAuth setup

The current setup should work for both Expo Go and production builds if you use Expo's proxy URI.

