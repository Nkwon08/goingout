# Quick Places API Setup (Same Account as Firebase)

Since you're using the same Google account for Firebase, your projects are **already linked**. You just need to enable a few things:

## What You Still Need to Do:

### 1. Enable Billing (Required)
Even though it's the same account, billing needs to be enabled for Places API:

1. Go to: https://console.cloud.google.com/billing
2. Make sure project `goingout-8b2e0` is selected
3. If you see "No billing account", click "Link a billing account"
4. Create/link a billing account (you get $200 free credit/month)
5. **Note:** Billing must be enabled even for free tier usage

### 2. Enable Places API (New)
1. Go to: https://console.cloud.google.com/apis/library
2. Search for: **"Places API (New)"**
3. Click on it
4. Click the blue **"Enable"** button
5. Wait a few seconds - you should see "API enabled"

### 3. Verify API Key Permissions (Optional but Recommended)
1. Go to: https://console.cloud.google.com/apis/credentials
2. Find your API key: `AIzaSyA4LjGDNcL_MnTKN28zhtVB3Tc8T5G3Gkk`
3. Click on it
4. Under "API restrictions":
   - Select "Restrict key"
   - Check ✅ "Places API (New)"
5. Click "Save"

## That's It!

Once you've done steps 1 and 2, your Places API should work. Your code is already set up correctly - it just needs the API enabled and billing activated.

## Quick Test:
After enabling, you can test by using the location autocomplete in your app. If it works, you're all set!

## Check Status:
- Go to: https://console.cloud.google.com/apis/dashboard
- You should see "Places API (New)" listed as enabled
- Check billing status at: https://console.cloud.google.com/billing

