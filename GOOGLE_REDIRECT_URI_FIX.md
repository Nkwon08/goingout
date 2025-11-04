# Fix Google OAuth Redirect URI Error

## Error
```
Error 400: invalid_request
Request details: redirect_uri=exp://192.168.201.221:8082
```

## Solution

You need to add the redirect URI to your Google OAuth Client in Google Cloud Console.

### Steps:

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/apis/credentials
   - Make sure you're in the correct project (goingout-8b2e0)

2. **Find your OAuth 2.0 Client ID**
   - Look for the client ID: `861094736123-v0qb4hdkq5e7r46sse6cr4sjk62abuvk.apps.googleusercontent.com`
   - Click on it to edit

3. **Add Redirect URIs**
   - Scroll to "Authorized redirect URIs"
   - Click "+ ADD URI"
   - Add these URIs (one at a time):

   **For Expo Go (development):**
   - `exp://192.168.201.221:8082` (your specific IP, check the error message)
   - `exp://127.0.0.1:8082` (localhost)
   - `exp://192.168.*:*` (wildcard for all local network IPs)
   - `https://auth.expo.io/@anonymous/outlink` (Expo proxy)

   **For production (if building standalone app):**
   - `outlink://` (your app scheme)

4. **Save**
   - Click "SAVE" at the bottom

5. **Restart your Expo app**
   - The changes may take a few minutes to propagate
   - Try signing in again

### Alternative: Use Expo Proxy (Recommended for Expo Go)

Instead of using the `exp://` URI, you can configure to use Expo's proxy server. This is already set in the code with `useProxy: true`, but you need to add the proxy URI to Google Cloud Console.

Add this URI:
- `https://auth.expo.io/@anonymous/outlink`

### Check Console Logs

When you try to sign in, check the console for the exact redirect URI being used. The code will log all possible redirect URIs. Add all of them to Google Cloud Console.

### Common Issues:

- **"Invalid redirect_uri"** - The exact URI in the error must be added to Google Cloud Console
- **Takes a few minutes** - Changes to OAuth settings can take 2-5 minutes to propagate
- **Wrong project** - Make sure you're editing the OAuth client in the correct Google Cloud project
