// Username selection screen - shown after OAuth sign-in when username is needed
import * as React from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text, Snackbar } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../hooks/useThemeColors';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { checkUsernameAvailability, upsertUserProfile } from '../services/authService';
import { useNavigation } from '@react-navigation/native';

const IU_CRIMSON = '#CC0000';

export default function UsernameSelectionScreen({ route }) {
  const navigation = useNavigation();
  const { user, refreshUserData } = useAuth();
  const { isDarkMode } = useTheme();
  const { background, surface, text, subText } = useThemeColors();
  
  const [username, setUsername] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [snackbarVisible, setSnackbarVisible] = React.useState(false);
  const [usernameAvailable, setUsernameAvailable] = React.useState(null); // null = not checked, true = available, false = taken
  const [checkingUsername, setCheckingUsername] = React.useState(false);
  const [usernameTouched, setUsernameTouched] = React.useState(false);
  const [usernameCheckError, setUsernameCheckError] = React.useState(null);
  const usernameCheckTimeoutRef = React.useRef(null);

  // Check username availability with debouncing
  React.useEffect(() => {
    // Clear previous timeout
    if (usernameCheckTimeoutRef.current) {
      clearTimeout(usernameCheckTimeoutRef.current);
    }

    // Reset state if username is empty
    if (!username.trim()) {
      setUsernameAvailable(null);
      setCheckingUsername(false);
      setUsernameCheckError(null);
      return;
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username.trim())) {
      setUsernameAvailable(false);
      setCheckingUsername(false);
      setUsernameCheckError('Username can only contain letters, numbers, and underscores');
      return;
    }

    if (username.trim().length < 3) {
      setUsernameAvailable(false);
      setCheckingUsername(false);
      setUsernameCheckError('Username must be at least 3 characters');
      return;
    }

    if (username.trim().length > 20) {
      setUsernameAvailable(false);
      setCheckingUsername(false);
      setUsernameCheckError('Username must be 20 characters or less');
      return;
    }

    // Set checking state
    setCheckingUsername(true);
    setUsernameAvailable(null);
    setUsernameCheckError(null);

    // Debounce the check - wait 500ms after user stops typing
    usernameCheckTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await checkUsernameAvailability(username.trim());
        if (result.error) {
          setUsernameCheckError(result.error);
          setUsernameAvailable(null);
        } else {
          setUsernameAvailable(result.available);
          setUsernameCheckError(null);
        }
      } catch (error) {
        console.error('Error checking username availability:', error);
        setUsernameAvailable(null);
        setUsernameCheckError(error.message || 'Failed to check username');
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    // Cleanup timeout on unmount
    return () => {
      if (usernameCheckTimeoutRef.current) {
        clearTimeout(usernameCheckTimeoutRef.current);
      }
    };
  }, [username]);

  const handleContinue = async () => {
    if (!username.trim()) {
      setError('Please enter a username');
      setSnackbarVisible(true);
      return;
    }

    if (usernameAvailable !== true) {
      setError('Please choose an available username');
      setSnackbarVisible(true);
      return;
    }

    if (!user?.uid) {
      setError('User not authenticated');
      setSnackbarVisible(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Update user profile with username
      const result = await upsertUserProfile(user.uid, {
        username: username.trim(),
      });

      if (result.error) {
        if (result.error === 'username_taken') {
          setError('This username is already taken. Please choose another.');
        } else {
          setError(result.error || 'Failed to set username');
        }
        setSnackbarVisible(true);
        setLoading(false);
      } else {
        // Username set successfully
        // Verify the username was set correctly by checking user data
        try {
          const { getCurrentUserData } = await import('../services/authService');
          const { userData } = await getCurrentUserData(user.uid, true);
          
          if (userData?.username && userData.username.trim()) {
            console.log('✅ Username successfully set:', userData.username);
            // Refresh user data in AuthContext to update needsUsername flag
            // This will cause App.js to switch from AuthStack to RootNavigator
            await refreshUserData(user.uid, true);
            // Navigation will be handled by auth state change
            // The app will automatically navigate to the main screen
          } else {
            console.warn('⚠️ Username may not have been set correctly');
            // Still allow navigation - the profile update should have worked
            // Refresh user data anyway to update state
            await refreshUserData(user.uid, true);
          }
        } catch (verifyError) {
          console.error('Error verifying username:', verifyError);
          // Continue anyway - the upsertUserProfile should have worked
        }
      }
    } catch (error) {
      console.error('Error setting username:', error);
      setError(error.message || 'Failed to set username');
      setSnackbarVisible(true);
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={isDarkMode ? ['#1a0000', '#121212', '#0a0000'] : ['#ffe5e5', '#FAFAFA', '#fff5f5']}
      style={{ flex: 1 }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <Text style={[styles.title, { color: text }]}>Choose Your Username</Text>
            <Text style={[styles.subtitle, { color: subText }]}>
              Pick a unique username that others can use to find you
            </Text>

            <View style={styles.form}>
              <View>
                <TextInput
                  label="Username"
                  value={username}
                  onChangeText={(text) => {
                    setUsername(text);
                    setUsernameTouched(true);
                  }}
                  mode="outlined"
                  autoCapitalize="none"
                  autoComplete="username"
                  autoFocus
                  style={styles.input}
                  textColor={text}
                  disabled={loading}
                  error={usernameAvailable === false || (usernameCheckError && usernameTouched)}
                  right={
                    checkingUsername ? (
                      <TextInput.Icon icon="loading" />
                    ) : usernameAvailable === true ? (
                      <TextInput.Icon icon="check-circle" color={IU_CRIMSON} />
                    ) : null
                  }
                />
                {usernameCheckError && usernameTouched && (
                  <Text style={[styles.errorText, { color: IU_CRIMSON }]}>
                    {usernameCheckError}
                  </Text>
                )}
                {usernameAvailable === false && !usernameCheckError && (
                  <Text style={[styles.errorText, { color: IU_CRIMSON }]}>
                    Username not available
                  </Text>
                )}
                {checkingUsername && username.trim() && !usernameCheckError && (
                  <Text style={[styles.checkingText, { color: subText }]}>
                    Checking availability...
                  </Text>
                )}
                {usernameAvailable === true && (
                  <Text style={[styles.successText, { color: IU_CRIMSON }]}>
                    Username available!
                  </Text>
                )}
              </View>

              <Text style={[styles.hint, { color: subText }]}>
                • 3-20 characters{'\n'}
                • Letters, numbers, and underscores only{'\n'}
                • This can be changed later in your profile
              </Text>

              <Button
                mode="contained"
                onPress={handleContinue}
                loading={loading}
                disabled={loading || usernameAvailable !== true || !username.trim()}
                buttonColor={IU_CRIMSON}
                textColor="#FFFFFF"
                style={styles.button}
                contentStyle={styles.buttonContent}
              >
                Continue
              </Button>
            </View>
          </View>
        </ScrollView>

        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={3000}
          action={{
            label: 'Dismiss',
            onPress: () => setSnackbarVisible(false),
          }}
        >
          {error || 'An error occurred'}
        </Snackbar>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  input: {
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  checkingText: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  successText: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 18,
  },
  button: {
    borderRadius: 12,
    marginTop: 8,
  },
  buttonContent: {
    paddingVertical: 8,
  },
});

