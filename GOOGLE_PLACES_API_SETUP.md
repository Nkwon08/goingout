# Google Places API Setup Guide

This guide will walk you through setting up Google Places API (New) for location autocomplete in your app.

## Step 1: Set Up Google Cloud Project

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Create or Select a Project**
   - If you don't have a project, click "Create Project"
   - Name it (e.g., "Roll App" or use your Firebase project name)
   - Click "Create"
   - If you already have a Firebase project, select the same project

## Step 2: Enable Billing

**⚠️ IMPORTANT: Google Places API requires billing to be enabled (even for free tier)**

1. **Navigate to Billing**
   - In Google Cloud Console, go to "Billing" in the left menu
   - Or visit: https://console.cloud.google.com/billing

2. **Link a Billing Account**
   - Click "Link a billing account"
   - If you don't have one, click "Create billing account"
   - Fill in your payment information
   - **Note:** Google provides $200 free credit per month, and Places API has a generous free tier

3. **Link to Your Project**
   - Select your project
   - Link it to your billing account

## Step 3: Enable Places API (New)

1. **Go to APIs & Services**
   - In Google Cloud Console, click "APIs & Services" > "Library"
   - Or visit: https://console.cloud.google.com/apis/library

2. **Search for Places API (New)**
   - Search for "Places API (New)" (NOT the old "Places API")
   - Click on "Places API (New)"

3. **Enable the API**
   - Click the "Enable" button
   - Wait for it to enable (usually takes a few seconds)

## Step 4: Create or Get API Key

1. **Go to Credentials**
   - Navigate to "APIs & Services" > "Credentials"
   - Or visit: https://console.cloud.google.com/apis/credentials

2. **Create API Key (if needed)**
   - Click "+ CREATE CREDENTIALS" > "API key"
   - Copy the generated key (you'll need this)

3. **Or Use Existing Key**
   - If you already have an API key, find it in the list
   - Your current key in code: `AIzaSyA4LjGDNcL_MnTKN28zhtVB3Tc8T5G3Gkk`

## Step 5: Configure API Key Restrictions (Recommended)

1. **Click on Your API Key** to edit it

2. **Set Application Restrictions**
   - Under "Application restrictions", choose:
     - **For iOS:** "iOS apps" and add your bundle ID: `com.roll.roll`
     - **For Android:** "Android apps" and add package name: `com.roll.roll` and SHA-1 certificate
     - **For development:** You can use "None" temporarily, but restrict it for production

3. **Set API Restrictions**
   - Under "API restrictions", select "Restrict key"
   - Check only:
     - ✅ **Places API (New)** - This is the main one you need
     - ✅ **Places API** (old one, for fallback if needed)
   - Click "Save"

## Step 6: Update Your Code

1. **Update the API Key in `services/placesService.js`**
   ```javascript
   const GOOGLE_PLACES_API_KEY = 'YOUR_NEW_API_KEY_HERE';
   ```

2. **Or use environment variable** (recommended for production):
   - Store the key securely
   - Don't commit it to public repositories

## Step 7: Verify Setup

1. **Test the API**
   - The API should work once:
     - ✅ Billing is enabled
     - ✅ Places API (New) is enabled
     - ✅ API key is valid and has correct restrictions

2. **Check API Usage**
   - Go to "APIs & Services" > "Dashboard"
   - You should see Places API (New) listed
   - Monitor usage to stay within free tier limits

## Pricing Information

**Google Places API (New) Pricing:**
- **Autocomplete (per session):** $2.83 per 1,000 sessions
- **Place Details:** $0.017 per request
- **Free tier:** $200 credit per month (covers ~70,000 autocomplete sessions)

**Note:** The free tier is very generous for most apps. You'll only pay if you exceed the $200 monthly credit.

## Troubleshooting

### Error: "API key not valid"
- Check that the API key is correct
- Verify Places API (New) is enabled
- Check API key restrictions

### Error: "Billing not enabled"
- Make sure billing account is linked to your project
- Check that billing is active (not suspended)

### Error: "Permission denied"
- Check API key restrictions
- Make sure Places API (New) is enabled
- Verify the API key has access to Places API (New)

### API returns empty results
- Check that you're using the correct endpoint
- Verify the API key has the right permissions
- Check your request format

## Security Best Practices

1. **Restrict API Key**
   - Always set application restrictions (iOS/Android bundle IDs)
   - Restrict to only the APIs you need
   - Don't use unrestricted keys in production

2. **Monitor Usage**
   - Set up usage alerts in Google Cloud Console
   - Monitor for unexpected spikes
   - Set up budget alerts

3. **Rotate Keys**
   - If a key is compromised, regenerate it immediately
   - Update the key in your code
   - Revoke the old key

## Next Steps

Once setup is complete:
1. ✅ Test the autocomplete in your app
2. ✅ Monitor API usage in Google Cloud Console
3. ✅ Set up budget alerts if needed
4. ✅ Consider implementing caching to reduce API calls

## Support

- **Google Cloud Support:** https://cloud.google.com/support
- **Places API Documentation:** https://developers.google.com/maps/documentation/places/web-service
- **Places API (New) Docs:** https://developers.google.com/maps/documentation/places/web-service/overview

