# App Store Upload Guide

## Step-by-Step: Upload Build to App Store Connect

### Prerequisites
- ✅ Apple Developer account ($99/year)
- ✅ EAS CLI installed: `npm install -g eas-cli`
- ✅ Logged into EAS: `eas login`
- ✅ Bundle identifier updated: `com.roll.roll`

---

## Step 1: Build Your App for Production

Build your iOS app for App Store submission:

```bash
eas build --platform ios --profile production
```

**What happens:**
- EAS will ask about credentials (choose "Set up credentials automatically")
- You'll need your Apple Developer account credentials
- Build will take 15-30 minutes
- You'll get a build URL to track progress

**First time setup:**
- EAS will create certificates and provisioning profiles automatically
- You'll need to provide your Apple ID and app-specific password

---

## Step 2: Wait for Build to Complete

You can:
- Watch progress in the terminal
- Or check: https://expo.dev/accounts/[your-account]/projects/[project-id]/builds

When build completes, you'll see:
```
✅ Build finished
```

---

## Step 3: Submit Build to App Store Connect

### Option A: Automatic Submission (Easiest) ⭐

```bash
eas submit --platform ios --profile production
```

This will:
- Automatically upload your build to App Store Connect
- Link it to your app listing
- You can then select it in App Store Connect

### Option B: Manual Upload

1. **Download the build:**
   - Go to: https://expo.dev/accounts/[your-account]/projects/[project-id]/builds
   - Click on your completed build
   - Download the `.ipa` file

2. **Upload via Transporter app:**
   - Download "Transporter" from Mac App Store
   - Open Transporter
   - Drag and drop the `.ipa` file
   - Click "Deliver"
   - Wait for upload to complete

3. **Or upload via Xcode:**
   - Open Xcode
   - Window → Organizer
   - Click "+" → "Distribute App"
   - Select your `.ipa` file
   - Follow the wizard

---

## Step 4: Wait for Processing

After upload:
1. Go to **App Store Connect** → **Your App** → **TestFlight** tab
2. You'll see your build with status "Processing"
3. Wait 10-30 minutes for Apple to process it
4. Status will change to "Ready to Submit"

---

## Step 5: Select Build for Review

1. Go to **App Store Connect** → **Your App** → **App Store** tab
2. Click **"+ Version or Platform"** (if creating new version)
3. Or click on existing version
4. Scroll to **"Build"** section
5. Click **"+ Build"**
6. Select your processed build from the list
7. Click **"Done"**

---

## Step 6: Complete App Information

Before submitting, make sure you have:

- [ ] **App Information** filled out
- [ ] **Pricing** set (Free)
- [ ] **App Privacy** questions answered
- [ ] **Screenshots** uploaded (all 3 device sizes)
- [ ] **App Description** added
- [ ] **Promotional Text** added
- [ ] **Keywords** added
- [ ] **Support URL** added
- [ ] **Privacy Policy URL** added
- [ ] **Category** selected
- [ ] **Age Rating** completed

---

## Step 7: Submit for Review

1. Scroll to bottom of the version page
2. Click **"Add for Review"** or **"Submit for Review"**
3. Answer any final questions:
   - Export compliance
   - Advertising identifier
   - Content rights
4. Click **"Submit"**

---

## Troubleshooting

### "You must choose a build"
- Make sure you've uploaded a build (Step 3)
- Wait for processing to complete (Step 4)
- Then select it in the Build section (Step 5)

### Build fails
- Check build logs: `eas build:list`
- Common issues:
  - Missing credentials
  - Bundle identifier mismatch
  - Code signing errors

### Can't find build in App Store Connect
- Make sure build finished successfully
- Check that bundle identifier matches
- Wait a few minutes for sync

---

## Quick Command Reference

```bash
# Build for production
eas build --platform ios --profile production

# Submit automatically
eas submit --platform ios --profile production

# Check build status
eas build:list

# View build details
eas build:view [build-id]
```

---

## Timeline

- **Build time:** 15-30 minutes
- **Upload time:** 5-10 minutes
- **Processing time:** 10-30 minutes
- **Review time:** 24-48 hours (usually)

**Total:** ~1-2 hours for build/upload, then 24-48 hours for review

