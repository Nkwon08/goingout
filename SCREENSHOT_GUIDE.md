# App Store Screenshot Guide

## Required Screenshot Sizes

Apple requires screenshots for these iPhone sizes:

1. **6.7" Display (iPhone 14 Pro Max)**: 1290 x 2796 pixels
2. **6.5" Display (iPhone 11 Pro Max)**: 1242 x 2688 pixels  
3. **5.5" Display (iPhone 8 Plus)**: 1242 x 2208 pixels

## Recommended Screens to Capture

Capture these key screens to showcase your app's features:

1. **Feed Screen** - Shows the main social feed
2. **Groups Screen** - Shows group list/chat
3. **Events/Activity Screen** - Shows events and trending locations
4. **Create Event Screen** - Shows event creation
5. **Group Chat Screen** - Shows real-time messaging
6. **Location Map Screen** - Shows location sharing feature

## How to Take Screenshots

### Option 1: Using iOS Simulator (Recommended)

1. **Open your app in the simulator:**
   ```bash
   npm start
   # Press 'i' to open iOS simulator
   ```

2. **Set simulator to correct device:**
   - In Xcode: Device → Manage Devices
   - Or use these commands:
     ```bash
     # For iPhone 14 Pro Max (6.7")
     xcrun simctl boot "iPhone 14 Pro Max"
     
     # For iPhone 11 Pro Max (6.5")
     xcrun simctl boot "iPhone 11 Pro Max"
     
     # For iPhone 8 Plus (5.5")
     xcrun simctl boot "iPhone 8 Plus"
     ```

3. **Take screenshots:**
   - Press `Cmd + S` in simulator to save screenshot
   - Or: Device → Screenshot in simulator menu
   - Screenshots save to Desktop by default

### Option 2: Using Command Line

Run these commands to take screenshots automatically:

```bash
# Take screenshot of current simulator
xcrun simctl io booted screenshot ~/Desktop/screenshot.png
```

### Option 3: Using EAS Build Preview

1. Build a preview build:
   ```bash
   eas build --platform ios --profile preview
   ```

2. Install on TestFlight or device
3. Take screenshots directly from device

## Screenshot Checklist

For each device size, capture:

- [ ] **Screenshot 1**: Feed screen with posts
- [ ] **Screenshot 2**: Groups list screen
- [ ] **Screenshot 3**: Group chat with messages
- [ ] **Screenshot 4**: Events/Activity screen
- [ ] **Screenshot 5**: Location map view
- [ ] **Screenshot 6**: Create event screen (optional)

## Tips for Great Screenshots

1. **Use real data** - Make sure screens show actual content, not empty states
2. **Show key features** - Highlight location sharing, group chats, events
3. **Clean UI** - Remove any debug info, test data, or personal info
4. **Consistent styling** - Use same theme (light or dark) across all screenshots
5. **Show variety** - Different screens showcase different features

## Uploading to App Store Connect

1. Go to App Store Connect → Your App → App Store → iOS App
2. Scroll to "Screenshots"
3. Drag and drop screenshots for each device size
4. Order them (first screenshot is most important)
5. Add captions if needed (optional)

## Quick Commands

```bash
# List available simulators
xcrun simctl list devices available

# Boot specific device
xcrun simctl boot "iPhone 14 Pro Max"

# Take screenshot
xcrun simctl io booted screenshot ~/Desktop/iphone-14-pro-max-1.png

# Open Photos app to view screenshots
open ~/Desktop
```

