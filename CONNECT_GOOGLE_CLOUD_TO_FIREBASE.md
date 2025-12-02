# Connecting Google Cloud to Firebase - Step by Step

## Step 1: Verify Your Firebase Project

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com/
   - Sign in with your Google account
   - Select your project: `goingout-8b2e0`

2. **Check Project Settings**
   - Click the gear icon ⚙️ next to "Project Overview"
   - Select "Project settings"
   - Scroll down to "Your apps" section
   - Your project ID is: `goingout-8b2e0`

## Step 2: Link Google Cloud Project (If Not Already Linked)

Your Firebase project is automatically linked to a Google Cloud project, but let's verify:

1. **In Firebase Console**
   - Go to "Project settings" (gear icon)
   - Scroll to "General" tab
   - Look for "Project ID": `goingout-8b2e0`
   - This is your Google Cloud project ID

2. **Verify in Google Cloud Console**
   - Go to: https://console.cloud.google.com/
   - In the project selector at the top, search for `goingout-8b2e0`
   - If you see it, it's already linked ✅
   - If not, select it or create a new project with this ID

## Step 3: Enable Billing in Google Cloud Console

1. **Navigate to Billing**
   - In Google Cloud Console, click the hamburger menu ☰
   - Go to "Billing"
   - Or visit: https://console.cloud.google.com/billing

2. **Link Billing Account**
   - Click "Link a billing account"
   - If you don't have one:
     - Click "Create billing account"
     - Fill in your information
     - Add a payment method (required, but you get $200 free credit/month)
   - Select your billing account
   - Click "Set account"

3. **Link to Project**
   - Make sure `goingout-8b2e0` project is selected
   - The billing account should now be linked

## Step 4: Enable Places API (New)

1. **Go to APIs & Services**
   - In Google Cloud Console, click ☰ menu
   - Go to "APIs & Services" > "Library"
   - Or visit: https://console.cloud.google.com/apis/library

2. **Search for Places API (New)**
   - In the search bar, type: `Places API (New)`
   - **Important:** Make sure it says "(New)" - not the old "Places API"
   - Click on "Places API (New)"

3. **Enable the API**
   - Click the blue "Enable" button
   - Wait a few seconds for it to enable
   - You should see "API enabled" message

## Step 5: Verify Your API Key

1. **Go to Credentials**
   - In Google Cloud Console, go to "APIs & Services" > "Credentials"
   - Or visit: https://console.cloud.google.com/apis/credentials

2. **Find Your API Key**
   - Look for API keys in the list
   - Your current key: `AIzaSyA4LjGDNcL_MnTKN28zhtVB3Tc8T5G3Gkk`
   - If you see it, click on it to configure
   - If not, create a new one:
     - Click "+ CREATE CREDENTIALS" > "API key"
     - Copy the key

3. **Configure API Key Restrictions** (Recommended)
   - Click on your API key to edit
   - Under "API restrictions":
     - Select "Restrict key"
     - Check ✅ "Places API (New)"
     - Check ✅ "Places API" (for fallback)
   - Under "Application restrictions":
     - For production: Restrict to your app bundle IDs
     - For development: You can leave as "None" temporarily
   - Click "Save"

## Step 6: Test the Connection

1. **Check API is Enabled**
   - Go to "APIs & Services" > "Dashboard"
   - You should see "Places API (New)" in the list
   - Status should be "Enabled"

2. **Verify Billing**
   - Go to "Billing" > "Account management"
   - Your project should show as linked to a billing account

3. **Test in Your App**
   - The API should now work in your app
   - Try using the location autocomplete feature

## Troubleshooting

### "API key not valid" error
- ✅ Make sure Places API (New) is enabled
- ✅ Check that billing is linked
- ✅ Verify the API key in `services/placesService.js` matches your Google Cloud key

### "Billing not enabled" error
- ✅ Go to Billing and make sure an account is linked
- ✅ Check that the billing account is active (not suspended)

### "Permission denied" error
- ✅ Check API key restrictions - make sure Places API (New) is allowed
- ✅ Verify you're using the correct project

## Quick Checklist

- [ ] Google Cloud project `goingout-8b2e0` is selected
- [ ] Billing account is created and linked
- [ ] Places API (New) is enabled
- [ ] API key exists and is configured
- [ ] API key restrictions allow Places API (New)
- [ ] Test the API in your app

## Next Steps

Once everything is connected:
1. Your existing code in `services/placesService.js` should work
2. The API key is already in your code
3. Test the autocomplete feature in your app
4. Monitor usage in Google Cloud Console > APIs & Services > Dashboard

