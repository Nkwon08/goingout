// Login screen - user authentication
import * as React from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text, Snackbar, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useThemeColors } from '../hooks/useThemeColors';
import { signIn, signInWithGoogle, signInWithApple } from '../services/authService';
import { GOOGLE_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, GOOGLE_ANDROID_CLIENT_ID } from '../config/firebase';

const IU_CRIMSON = '#CC0000';

export default function LoginScreen({ navigation }) {
  // State for form inputs
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [snackbarVisible, setSnackbarVisible] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [appleLoading, setAppleLoading] = React.useState(false);

  // Google Auth Request hook
  // Uses platform-specific client IDs for production App Store builds
  // Falls back to web client ID if platform-specific IDs are not set
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID, // Web client ID (for Firebase backend)
    iosClientId: GOOGLE_IOS_CLIENT_ID !== 'YOUR_IOS_CLIENT_ID_HERE' ? GOOGLE_IOS_CLIENT_ID : GOOGLE_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID !== 'YOUR_ANDROID_CLIENT_ID_HERE' ? GOOGLE_ANDROID_CLIENT_ID : GOOGLE_CLIENT_ID,
  });

  // Get theme colors - must be called unconditionally (React hooks rule)
  const themeColors = useThemeColors();
  const { background, surface, text, subText } = themeColors;

  // Handle Google response
  const handleGoogleResponse = React.useCallback(async (response) => {
    try {
      const { id_token } = response.params;
      if (!id_token) {
        setGoogleLoading(false);
        setError('No ID token received from Google');
        setSnackbarVisible(true);
        return;
      }

      const result = await signInWithGoogle(id_token);
      setGoogleLoading(false);

      if (result.error) {
        setError(result.error);
        setSnackbarVisible(true);
      } else {
        // Navigation handled by auth state change in App.js
      }
    } catch (error) {
      setGoogleLoading(false);
      setError(error.message || 'Failed to sign in with Google');
      setSnackbarVisible(true);
    }
  }, []);

  // Handle Google response effect
  React.useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleResponse(response);
    } else if (response?.type === 'error') {
      setGoogleLoading(false);
      setError('Google sign in failed');
      setSnackbarVisible(true);
    }
  }, [response, handleGoogleResponse]);

  // Handle login
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      setSnackbarVisible(true);
      return;
    }

    setLoading(true);
    setError(null);

    const result = await signIn(email.trim(), password);
    
    setLoading(false);

    if (result.error) {
      setError(result.error);
      setSnackbarVisible(true);
    } else {
      // Navigation handled by auth state change in App.js
    }
  };

  // Handle Google sign in
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      await promptAsync();
    } catch (error) {
      setGoogleLoading(false);
      setError(error.message || 'Failed to start Google sign in');
      setSnackbarVisible(true);
    }
  };


  // Handle Apple sign in
  const handleAppleSignIn = async () => {
    if (Platform.OS !== 'ios') {
      setError('Apple Sign In is only available on iOS');
      setSnackbarVisible(true);
      return;
    }

    setAppleLoading(true);
    setError(null);

    const result = await signInWithApple();
    
    setAppleLoading(false);

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
            Welcome
          </Text>
          <Text style={[styles.subtitle, { color: text }]}>
            Sign in to continue
          </Text>
        </View>

        <View style={styles.form}>
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
            autoComplete="password"
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

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading || googleLoading || appleLoading}
            buttonColor={IU_CRIMSON}
            textColor="#FFFFFF"
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            Sign In
          </Button>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <Divider style={styles.divider} />
            <Text style={[styles.dividerText, { color: subText }]}>OR</Text>
            <Divider style={styles.divider} />
          </View>

          {/* Google Sign In Button */}
          <Button
            mode="contained"
            onPress={handleGoogleSignIn}
            loading={googleLoading}
            disabled={loading || googleLoading || appleLoading || !request}
            buttonColor="#FFFFFF"
            textColor="#000000"
            style={[styles.googleButton, { borderColor: '#E0E0E0', borderWidth: 1 }]}
            contentStyle={styles.googleButtonContent}
            icon={() => (
              <MaterialCommunityIcons name="google" size={20} color="#4285F4" />
            )}
          >
            Continue with Google
          </Button>

          {/* Apple Sign In Button (iOS only) */}
          {Platform.OS === 'ios' && (
            <>
              <View style={styles.dividerContainer}>
                <Divider style={styles.divider} />
                <Text style={[styles.dividerText, { color: subText }]}>OR</Text>
                <Divider style={styles.divider} />
              </View>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={8}
                style={styles.appleButton}
                onPress={handleAppleSignIn}
                disabled={loading || googleLoading || appleLoading}
              />
            </>
          )}

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: text }]}>
              Don't have an account?{' '}
            </Text>
            <Text
              style={[styles.link, { color: IU_CRIMSON }]}
              onPress={() => navigation.navigate('SignUp')}
            >
              Sign up
            </Text>
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
  appleButton: {
    width: '100%',
    height: 48,
    marginTop: 8,
    borderRadius: 8,
  },
});

