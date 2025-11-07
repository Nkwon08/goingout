// Sign up screen - user registration
import * as React from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text, Snackbar, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';
import { signUp, signInWithGoogle, checkUsernameAvailability } from '../services/authService';

const IU_CRIMSON = '#DC143C';

export default function SignUpScreen({ navigation }) {
  // State for form inputs
  const [name, setName] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [snackbarVisible, setSnackbarVisible] = React.useState(false);
  const [emailInUse, setEmailInUse] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [usernameAvailable, setUsernameAvailable] = React.useState(null); // null = not checked, true = available, false = taken
  const [checkingUsername, setCheckingUsername] = React.useState(false);
  const [usernameTouched, setUsernameTouched] = React.useState(false); // Track if user has interacted with username field
  const [usernameCheckError, setUsernameCheckError] = React.useState(null); // Track errors during username check
  const usernameCheckTimeoutRef = React.useRef(null);

  const { background, text, subText } = useThemeColors();

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

    // Set checking state
    setCheckingUsername(true);
    setUsernameAvailable(null);

    // Debounce the check - wait 500ms after user stops typing
    usernameCheckTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await checkUsernameAvailability(username.trim());
        if (result.error) {
          // If there's an error checking, don't set availability (keep as null)
          setUsernameCheckError(result.error);
          setUsernameAvailable(null);
        } else {
          setUsernameAvailable(result.available);
          setUsernameCheckError(null);
        }
      } catch (error) {
        console.error('Error checking username availability:', error);
        setUsernameAvailable(null); // Reset on error
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

  // Force check username availability when user leaves the field (onBlur)
  const handleUsernameBlur = async () => {
    setUsernameTouched(true);
    
    // If username is empty, reset state
    if (!username.trim()) {
      setUsernameAvailable(null);
      setCheckingUsername(false);
      return;
    }

    // Clear any pending timeout and check immediately
    if (usernameCheckTimeoutRef.current) {
      clearTimeout(usernameCheckTimeoutRef.current);
    }

    setCheckingUsername(true);
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
  };

  // Handle sign up
  const handleSignUp = async () => {
    // Validation
    if (!name.trim() || !username.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      setSnackbarVisible(true);
      return;
    }

    // Ensure username has been checked and is available
    if (checkingUsername) {
      setError('Please wait while we check username availability...');
      setSnackbarVisible(true);
      return;
    }

    // If username hasn't been checked yet (null), check it now
    if (usernameAvailable === null && username.trim()) {
      setCheckingUsername(true);
      try {
        const result = await checkUsernameAvailability(username.trim());
        setUsernameAvailable(result.available);
        setCheckingUsername(false);
        
        if (!result.available) {
          setError('This username is already taken. Please choose a different username.');
          setSnackbarVisible(true);
          return;
        }
      } catch (error) {
        console.error('Error checking username availability:', error);
        setCheckingUsername(false);
        setError('Unable to verify username availability. Please try again.');
        setSnackbarVisible(true);
        return;
      }
    }

    // Check if username is available
    if (usernameAvailable === false) {
      setError('This username is already taken. Please choose a different username.');
      setSnackbarVisible(true);
      return;
    }

    // Username must be explicitly available (true) to proceed
    if (usernameAvailable !== true) {
      setError('Please ensure your username is available before continuing.');
      setSnackbarVisible(true);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setSnackbarVisible(true);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setSnackbarVisible(true);
      return;
    }

    setLoading(true);
    setError(null);

    const result = await signUp(email.trim(), password, name.trim(), username.trim());
    
    setLoading(false);

    if (result.error) {
      // Check if error is email already in use
      const isEmailInUse = result.errorCode === 'email-already-in-use' || 
                          result.error.includes('already exists') || 
                          result.error.includes('email-already-in-use');
      
      // Check if error is username taken
      const isUsernameTaken = result.error === 'username_taken' || 
                             result.errorCode === 'username_taken';
      
      setEmailInUse(isEmailInUse);
      
      if (isUsernameTaken) {
        setError('This username is already taken. Please choose a different username.');
      } else {
        setError(result.error);
      }
      
      setSnackbarVisible(true);
    } else {
      // Navigation handled by auth state change in App.js
      setEmailInUse(false);
    }
  };

  // Handle Google sign in
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);

    const result = await signInWithGoogle();
    
    setGoogleLoading(false);

    if (result.error) {
      setError(result.error);
      setSnackbarVisible(true);
    } else {
      // Navigation handled by auth state change in App.js
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text variant="displaySmall" style={[styles.title, { color: text }]}>
            Create account
          </Text>
          <Text style={[styles.subtitle, { color: text }]}>
            Sign up to get started
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="Full Name"
            value={name}
            onChangeText={setName}
            mode="outlined"
            autoCapitalize="words"
            style={styles.input}
            textColor={text}
            disabled={loading}
          />

          <View>
            <TextInput
              label="Username"
              value={username}
              onChangeText={(text) => {
                setUsername(text);
                setUsernameTouched(true);
              }}
              onBlur={handleUsernameBlur}
              mode="outlined"
              autoCapitalize="none"
              autoComplete="username"
              style={styles.input}
              textColor={text}
              disabled={loading}
              error={usernameAvailable === false}
            />
            {usernameAvailable === false && (
              <Text style={styles.errorText}>Username not available</Text>
            )}
            {usernameCheckError && (
              <Text style={styles.errorText}>{usernameCheckError}</Text>
            )}
            {checkingUsername && username.trim() && !usernameCheckError && (
              <Text style={[styles.checkingText, { color: subText }]}>Checking availability...</Text>
            )}
          </View>

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            style={styles.input}
            textColor={text}
            disabled={loading}
          />

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowPassword(!showPassword)}
              />
            }
            style={styles.input}
            textColor={text}
            disabled={loading}
          />

          <TextInput
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            mode="outlined"
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            right={
              <TextInput.Icon
                icon={showConfirmPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              />
            }
            style={styles.input}
            textColor={text}
            disabled={loading}
          />

          <Button
            mode="contained"
            onPress={handleSignUp}
            loading={loading}
            disabled={loading || googleLoading || usernameAvailable === false || checkingUsername || (username.trim() && usernameAvailable !== true)}
            buttonColor={IU_CRIMSON}
            textColor="#FFFFFF"
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            Sign Up
          </Button>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <Divider style={styles.divider} />
            <Text style={[styles.dividerText, { color: subText }]}>OR</Text>
            <Divider style={styles.divider} />
          </View>

          {/* Google Sign In Button */}
          <Button
            mode="outlined"
            onPress={handleGoogleSignIn}
            loading={googleLoading}
            disabled={loading || googleLoading}
            buttonColor="transparent"
            textColor={text}
            style={[styles.googleButton, { borderColor: subText }]}
            contentStyle={styles.googleButtonContent}
            icon={() => (
              <MaterialCommunityIcons name="google" size={20} color="#4285F4" />
            )}
          >
            Continue with Google
          </Button>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: text }]}>
              Already have an account?{' '}
            </Text>
            <Text
              style={[styles.link, { color: IU_CRIMSON }]}
              onPress={() => navigation.navigate('Login')}
            >
              Sign in
            </Text>
          </View>
        </View>
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => {
          setSnackbarVisible(false);
          setEmailInUse(false);
        }}
        duration={emailInUse ? 5000 : 3000}
        action={
          emailInUse
            ? {
                label: 'Sign In',
                onPress: () => {
                  setSnackbarVisible(false);
                  setEmailInUse(false);
                  navigation.navigate('Login');
                },
              }
            : {
                label: 'Dismiss',
                onPress: () => {
                  setSnackbarVisible(false);
                  setEmailInUse(false);
                },
              }
        }
      >
        {error || 'An error occurred'}
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
  form: {
    width: '100%',
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
  },
  googleButton: {
    marginTop: 8,
    borderRadius: 8,
  },
  googleButtonContent: {
    paddingVertical: 8,
  },
  errorText: {
    color: '#FF0000',
    fontSize: 12,
    marginTop: -12,
    marginBottom: 8,
    marginLeft: 16,
  },
  checkingText: {
    fontSize: 12,
    marginTop: -12,
    marginBottom: 8,
    marginLeft: 16,
    fontStyle: 'italic',
  },
});

