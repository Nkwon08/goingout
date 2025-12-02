# Creating a Google Places API Key

Since you're getting "REQUEST_DENIED", you need to create an API key and configure it properly.

## Step 1: Create API Key

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/apis/credentials
   - Make sure project `goingout-8b2e0` is selected

2. **Create New API Key**
   - Click **"+ CREATE CREDENTIALS"** at the top
   - Select **"API key"**
   - A new API key will be generated
   - **Copy the key immediately** (you'll need it)

## Step 2: Configure API Key Restrictions

1. **Click on the API key** you just created (or your existing one)

2. **Set API Restrictions** (Important!)
   - Under "API restrictions"
   - Select **"Restrict key"**
   - Check these APIs:
     - ✅ **Places API** (the standard one, not "New")
     - ✅ **Places API (New)** (optional, for future)
   - Click **"Save"**

3. **Set Application Restrictions** (Optional but Recommended)
   - Under "Application restrictions"
   - For development: Select **"None"** (easier to test)
   - For production: Restrict to your app bundle IDs:
     - iOS: `com.roll.roll`
     - Android: `com.roll.roll`

## Step 3: Update Your Code

1. **Open `services/placesService.js`**
2. **Replace the API key** on line 5:
   ```javascript
   const GOOGLE_PLACES_API_KEY = 'YOUR_NEW_API_KEY_HERE';
   ```
3. **Save the file**

## Step 4: Verify APIs Are Enabled

Make sure these are enabled in Google Cloud Console:
1. Go to: https://console.cloud.google.com/apis/library
2. Search and enable:
   - ✅ **Places API** (standard)
   - ✅ **Places API (New)** (optional)

## Step 5: Check Billing

- Go to: https://console.cloud.google.com/billing
- Make sure billing is linked to your project
- Even with free tier, billing must be enabled

## Quick Checklist

- [ ] API key created in Google Cloud Console
- [ ] API key has "Places API" in restrictions
- [ ] Places API is enabled in API Library
- [ ] Billing is linked to project
- [ ] API key updated in `services/placesService.js`
- [ ] Test autocomplete in your app

## Troubleshooting

### Still getting REQUEST_DENIED?
- Wait 5-10 minutes after creating/updating the key (propagation delay)
- Check that "Places API" (not just "New") is enabled
- Verify API key restrictions include "Places API"
- Make sure billing is enabled

### Key not working?
- Try removing all restrictions temporarily to test
- Check that you're using the correct project
- Verify the key is copied correctly (no extra spaces)

