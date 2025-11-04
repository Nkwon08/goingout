# Firebase Storage Rules Simulator Guide

When testing your Storage rules in Firebase Console, you need to provide a location/path for the simulation.

## In the Rules Simulator:

### For Testing Post Image Uploads:

**Location:** `posts/your-user-id-here/1234567890.jpg`

Replace `your-user-id-here` with an actual user ID from your Firebase Auth users (you can find this in Authentication > Users tab).

**Example:**
- If your user ID is `abc123xyz456`, use:
  - `posts/abc123xyz456/1234567890.jpg`

### For Testing Profile Picture Uploads:

**Location:** `profile/your-user-id-here/1234567890.jpg`

**Example:**
- If your user ID is `abc123xyz456`, use:
  - `profile/abc123xyz456/1234567890.jpg`

## Simulation Type Settings:

- **Simulation type:** Choose "Write" or "Upload"
- **Location:** Use one of the paths above (replace with your actual user ID)
- **Auth:** Select a user from your Authentication users (or leave as "unauthenticated" to test security)
- **File:** You can upload a test file (any small image file works)

## Quick Test Path Format:

The app uses this path format: `{folder}/{userId}/{timestamp}.jpg`

So for simulation:
- **Posts:** `posts/{userId}/test.jpg` (replace {userId} with actual ID)
- **Profile:** `profile/{userId}/test.jpg` (replace {userId} with actual ID)

## Note:

The exact filename doesn't matter - the rules match any file in the `posts/{userId}/` or `profile/{userId}/` folders. So you can use any filename like `test.jpg`, `image.jpg`, or `1234567890.jpg`.

