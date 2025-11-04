# Username Migration Instructions

## Quick Migration (Recommended)

The easiest way is to have users sign in again - the app will automatically add `usernameLowercase` when they sign in.

## Manual Migration Script

If you want to update all users at once, use the migration script:

### Option 1: Run Script in React Native App (Easiest)

Create a temporary admin screen or add a button to trigger the migration:

```javascript
// In your app (e.g., AccountScreen.js - temporarily add this)
import { migrateUsernames } from '../scripts/migrateUsernames';

// Add a temporary button
<Button onPress={async () => {
  Alert.alert('Migration', 'Starting migration...');
  await migrateUsernames();
  Alert.alert('Migration', 'Migration complete!');
}}>
  Migrate Usernames
</Button>
```

### Option 2: Run Script via Firebase Console

You can't directly run Node.js scripts in Firebase Console, but you can use Firebase Functions or Cloud Shell.

### Option 3: Run Script Locally

1. Install Node.js if you haven't
2. Navigate to project directory
3. Run: `node scripts/migrateUsernames.js`

**Note:** This requires setting up the Firebase config properly for Node.js environment.

## Manual Update via Firebase Console

1. Go to **Firebase Console → Firestore Database**
2. Click **`users`** collection
3. For each user document:
   - Click on the document
   - Click **"Add field"**
   - Field name: `usernameLowercase`
   - Field type: `string`
   - Field value: Lowercase version of `username` field
     - Example: If `username` is "Alex123", enter "alex123"
   - Click **"Update"**

## Verify Migration

After migration, verify:

1. Go to Firestore → `users` collection
2. Open any user document
3. Check that both fields exist:
   - `username`: "Alex123"
   - `usernameLowercase`: "alex123"
4. Try searching for that user by username
5. They should appear in search results

## Automatic Migration

The app now automatically adds `usernameLowercase` when users sign in. So:
- **New users**: Automatically get `usernameLowercase` when they sign up
- **Existing users**: Get `usernameLowercase` when they sign in again
- **No action needed**: Just wait for users to sign in

If you want to update all users immediately, use the migration script above.

