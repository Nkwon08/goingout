// Temporary screen to run username migration
// Add this screen temporarily to migrate all users, then remove it
//
// To use:
// 1. Import this screen in your navigation
// 2. Add a button in AccountScreen to navigate to this screen
// 3. Click "Migrate All Usernames" button
// 4. Wait for completion
// 5. Remove this screen and button after migration is done

import * as React from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { Appbar, Button, Text, ActivityIndicator } from 'react-native-paper';
import { useThemeColors } from '../hooks/useThemeColors';
import { migrateUsernames } from '../scripts/migrateUsernames';
import { useAuth } from '../context/AuthContext';

export default function MigrateUsernamesScreen({ navigation }) {
  const [migrating, setMigrating] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const { background, text, surface } = useThemeColors();
  const { user } = useAuth();

  const handleMigrate = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be signed in to run migration');
      return;
    }

    Alert.alert(
      'Confirm Migration',
      'This will update all users in the database. This may take a few moments. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Migrate',
          onPress: async () => {
            setMigrating(true);
            setResult(null);
            
            try {
              console.log('🚀 Starting migration...');
              await migrateUsernames();
              setResult('Migration completed successfully! Check console for details.');
              Alert.alert('Success', 'Migration completed! Check console for details.');
            } catch (error) {
              console.error('❌ Migration error:', error);
              setResult(`Error: ${error.message}`);
              Alert.alert('Error', `Migration failed: ${error.message}`);
            } finally {
              setMigrating(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      <Appbar.Header mode="center-aligned" style={{ backgroundColor: background }}>
        <Appbar.Action icon="arrow-left" onPress={() => navigation.goBack()} color={text} />
        <Appbar.Content title="Migrate Usernames" color={text} />
      </Appbar.Header>

      <ScrollView style={{ flex: 1, padding: 16 }}>
        <View style={{ backgroundColor: surface, borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <Text style={{ color: text, fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
            Username Migration
          </Text>
          <Text style={{ color: text, fontSize: 14, marginBottom: 12 }}>
            This will add the `usernameLowercase` field to all users who don't have it.
            This is needed for the username search feature to work.
          </Text>
          <Text style={{ color: text, fontSize: 12, fontStyle: 'italic', marginBottom: 16 }}>
            Note: New users automatically get this field. Only existing users need migration.
          </Text>

          <Button
            mode="contained"
            onPress={handleMigrate}
            disabled={migrating}
            loading={migrating}
            buttonColor="#990000"
            textColor="#FFFFFF"
            style={{ marginBottom: 16 }}
          >
            {migrating ? 'Migrating...' : 'Migrate All Usernames'}
          </Button>

          {migrating && (
            <View style={{ alignItems: 'center', padding: 16 }}>
              <ActivityIndicator size="large" color="#990000" />
              <Text style={{ color: text, marginTop: 12 }}>
                Updating users... This may take a moment.
              </Text>
            </View>
          )}

          {result && (
            <View style={{ backgroundColor: background, borderRadius: 12, padding: 12, marginTop: 12 }}>
              <Text style={{ color: text, fontSize: 14 }}>{result}</Text>
            </View>
          )}
        </View>

        <View style={{ backgroundColor: surface, borderRadius: 16, padding: 16 }}>
          <Text style={{ color: text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
            What this does:
          </Text>
          <Text style={{ color: text, fontSize: 12, marginBottom: 4 }}>
            • Scans all users in the database
          </Text>
          <Text style={{ color: text, fontSize: 12, marginBottom: 4 }}>
            • For users with `username` but no `usernameLowercase`
          </Text>
          <Text style={{ color: text, fontSize: 12, marginBottom: 4 }}>
            • Adds `usernameLowercase` field (lowercase version of username)
          </Text>
          <Text style={{ color: text, fontSize: 12, marginBottom: 4 }}>
            • Skips users who already have the field
          </Text>
          <Text style={{ color: text, fontSize: 12 }}>
            • Shows results in console
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

