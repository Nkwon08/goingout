// Edit Profile screen - allows users to edit their profile information
import * as React from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Image, TouchableOpacity, Alert } from 'react-native';
import { Appbar, TextInput, Button, Avatar, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useThemeColors } from '../hooks/useThemeColors';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { uploadImages } from '../services/storageService';
import { getCurrentUserData } from '../services/authService';

const IU_CRIMSON = '#DC143C';

export default function EditProfileScreen({ navigation }) {
  // Get current user data
  const { user, userData, refreshUserData } = useAuth();
  const { background, text, subText, surface, border } = useThemeColors();

  // Form state
  const [name, setName] = React.useState(userData?.name || user?.displayName || '');
  const [username, setUsername] = React.useState(userData?.username || '');
  const [bio, setBio] = React.useState(userData?.bio || '');
  const [age, setAge] = React.useState(userData?.age?.toString() || '');
  const [gender, setGender] = React.useState(userData?.gender || '');
  const [profilePicture, setProfilePicture] = React.useState(userData?.photoURL || userData?.avatar || user?.photoURL || '');
  const [saving, setSaving] = React.useState(false);
  const [hasLocalImageChange, setHasLocalImageChange] = React.useState(false); // Track if user selected a new image

  // Update profile picture when userData changes (e.g., after refresh)
  // But only if user hasn't made a local change
  React.useEffect(() => {
    if (!hasLocalImageChange) {
      const newPhotoURL = userData?.photoURL || userData?.avatar || user?.photoURL || '';
      if (newPhotoURL && newPhotoURL !== profilePicture) {
        setProfilePicture(newPhotoURL);
      }
    }
  }, [userData?.photoURL, userData?.avatar, user?.photoURL]);

  // Gender options
  const genderOptions = ['', 'Male', 'Female', 'Non-binary', 'Prefer not to say'];

  // Handle profile picture selection from library
  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to change your profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Store the local file URI - it will be uploaded when saving
        // This ensures it's uploaded to the correct path (avatar.jpg) via upsertUserProfile
        const imageUri = result.assets[0].uri;
        setProfilePicture(imageUri);
        setHasLocalImageChange(true); // Mark that user has made a local change
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
      setUploadingImage(false);
    }
  };

  // Handle taking photo with camera
  const handleTakePicture = async () => {
    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera permissions to take a photo for your profile picture.');
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        let imageUri = result.assets[0].uri;
        
        // Flip the image horizontally to correct mirroring from front camera
        // Front camera images are typically mirrored, so we need to flip them back
        try {
          console.log('🔄 Flipping image to correct mirroring...');
          const manipulatedImage = await ImageManipulator.manipulateAsync(
            imageUri,
            [{ flip: ImageManipulator.FlipType.Horizontal }],
            {
              compress: 0.8,
              format: ImageManipulator.SaveFormat.JPEG,
            }
          );
          imageUri = manipulatedImage.uri;
          console.log('✅ Image flipped successfully:', imageUri.substring(0, 50));
        } catch (flipError) {
          console.error('❌ Error flipping image:', flipError);
          // Continue with original image if flipping fails
        }
        
        // Store the local file URI - it will be uploaded when saving
        setProfilePicture(imageUri);
        setHasLocalImageChange(true); // Mark that user has made a local change
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to take picture. Please try again.');
    }
  };

  // Handle save profile
  const handleSave = async () => {
    if (!user || !user.uid) {
      Alert.alert('Error', 'You must be signed in to update your profile.');
      return;
    }

    // Validation
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required.');
      return;
    }

    if (!username.trim()) {
      Alert.alert('Error', 'Username is required.');
      return;
    }

    if (age && isNaN(parseInt(age))) {
      Alert.alert('Error', 'Age must be a valid number.');
      return;
    }

    setSaving(true);

    try {
      console.log('💾 Starting profile update...');
      
      // Import upsertUserProfile
      const { upsertUserProfile } = await import('../services/authService');
      
      // Determine if profile picture is a local URI that needs uploading
      // If it's a local file URI, we'll upload it via pfpUri
      // If it's already a URL, we'll use it as photoURL
      const pfpUri = profilePicture && profilePicture.startsWith('file://') ? profilePicture : null;
      const photoURL = profilePicture && !profilePicture.startsWith('file://') ? profilePicture : null;
      
      console.log('💾 Saving profile with:', { 
        hasPfpUri: !!pfpUri, 
        hasPhotoURL: !!photoURL, 
        profilePictureType: profilePicture ? (profilePicture.startsWith('file://') ? 'file' : 'url') : 'none',
        profilePicture: profilePicture?.substring(0, 50) + '...' // Log first 50 chars
      });
      
      // Use upsertUserProfile (handles username reservation, avatar upload, etc.)
      // Don't include username in updates - it's locked and cannot be changed
      const result = await upsertUserProfile(user.uid, {
        name: name.trim(),
        // username: username.trim(), // Username is locked - don't include in updates
        bio: bio.trim() || null,
        age: age ? parseInt(age) : null,
        gender: gender || null,
        pfpUri, // Upload local avatar if provided
        photoURL, // Use existing URL if provided
      });
      
      console.log('💾 upsertUserProfile result:', result);
      
      if (!result.success) {
        // Handle username_taken error
        if (result.error === 'username_taken') {
          Alert.alert('Username Taken', 'This username is already taken. Please choose a different username.');
          setSaving(false);
          return;
        }
        
        // Handle username_change_limit error
        if (result.error === 'username_change_limit') {
          Alert.alert('Username Change Limit', 'You can only change your username once. Please keep your current username.');
          setSaving(false);
          return;
        }
        
        throw new Error(result.error || 'Failed to update profile');
      }

      // Update Firebase Auth display name (non-blocking)
      if (auth && !auth._isMock && user) {
        try {
          // Get the photoURL from the result or wait for upload to complete
          const finalPhotoURL = photoURL || (result.photoURL ? result.photoURL : null);
          await updateProfile(user, {
            displayName: name.trim(),
            photoURL: finalPhotoURL || null,
          });
        } catch (authError) {
          console.warn('⚠️ Firebase Auth update failed (non-critical):', authError.message);
          // Continue - Firestore update is more important
        }
      }

      // Success - refresh user data to get updated profile picture
      console.log('✅ Profile update completed');
      
      // Reset the local image change flag since we've saved
      setHasLocalImageChange(false);
      
      // Wait for Firestore to update and propagate (reduced from 3000ms)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh user data to get the updated profile picture (force refresh from server)
      try {
        await refreshUserData(user.uid);
        console.log('✅ User data refreshed after profile update');
        console.log('✅ Current photoURL:', userData?.photoURL);
        
        // Quick second refresh to ensure we have the latest (reduced from 1500ms)
        await new Promise(resolve => setTimeout(resolve, 500));
        await refreshUserData(user.uid);
        console.log('✅ Second refresh completed');
        console.log('✅ Final photoURL:', userData?.photoURL);
      } catch (refreshError) {
        console.warn('⚠️ Failed to refresh user data after profile update:', refreshError.message);
        // Continue anyway - the profile was updated successfully
      }
      
      setSaving(false);
      
      Alert.alert('Success', 'Profile updated successfully!', [
        {
          text: 'OK',
          onPress: () => {
            // Navigate back - ProfileScreen will refresh on focus with shorter delay
            navigation.goBack();
          },
        },
      ]);
    } catch (error) {
      console.error('❌ Error updating profile:', error);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error message:', error.message);
      setSaving(false);
      Alert.alert('Error', error.message || 'Failed to update profile. Please check your connection and try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <Appbar.Header mode="center-aligned" style={{ backgroundColor: background }}>
        <Appbar.Action icon="arrow-left" onPress={() => navigation.goBack()} color={text} />
        <Appbar.Content title="Edit Profile" color={text} />
        <Appbar.Action
          icon="check"
          onPress={handleSave}
          disabled={saving}
          color={saving ? subText : IU_CRIMSON}
        />
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile Picture Section */}
        <View style={styles.profilePictureSection}>
          <View style={{ position: 'relative' }}>
            <TouchableOpacity onPress={handlePickImage} disabled={saving}>
              {profilePicture ? (
                <Image
                  source={{ uri: profilePicture }}
                  style={styles.profilePicture}
                />
              ) : (
                <View style={[styles.profilePicture, styles.profilePicturePlaceholder]}>
                  <MaterialCommunityIcons name="camera" size={40} color={subText} />
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.cameraIconContainer}
              onPress={handleTakePicture}
              disabled={saving}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="camera"
                size={20}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
          {saving && profilePicture && profilePicture.startsWith('file://') && (
            <Text style={[styles.uploadingText, { color: subText }]}>Uploading...</Text>
          )}
        </View>

        {/* Form Fields */}
        <View style={[styles.formContainer, { backgroundColor: surface, borderColor: border }]}>
          <TextInput
            label="Name"
            value={name}
            onChangeText={setName}
            mode="outlined"
            style={styles.input}
            textColor={text}
            disabled={saving}
          />

          <TextInput
            label="Username"
            value={username}
            onChangeText={setUsername}
            mode="outlined"
            autoCapitalize="none"
            style={styles.input}
            textColor={text}
            disabled={true}
            helperText="Username cannot be changed"
            helperTextEnabled={true}
          />

          <TextInput
            label="Bio"
            value={bio}
            onChangeText={setBio}
            mode="outlined"
            multiline
            numberOfLines={4}
            placeholder="Tell us about yourself..."
            placeholderTextColor={subText}
            style={[styles.input, styles.bioInput]}
            textColor={text}
            disabled={saving}
          />

          <TextInput
            label="Age"
            value={age}
            onChangeText={setAge}
            mode="outlined"
            keyboardType="numeric"
            placeholder="Optional"
            placeholderTextColor={subText}
            style={styles.input}
            textColor={text}
            disabled={saving}
          />

          {/* Gender Picker */}
          <View style={styles.genderContainer}>
            <Text style={[styles.label, { color: text }]}>Gender</Text>
            <View style={styles.genderOptions}>
              {genderOptions.map((option) => (
                <TouchableOpacity
                  key={option || 'none'}
                  style={[
                    styles.genderOption,
                    { backgroundColor: gender === option ? IU_CRIMSON : surface, borderColor: border },
                    gender === option && { borderColor: IU_CRIMSON },
                  ]}
                  onPress={() => setGender(option)}
                  disabled={saving}
                >
                  <Text
                    style={[
                      styles.genderOptionText,
                      { color: gender === option ? '#FFFFFF' : text },
                    ]}
                  >
                    {option || 'Not specified'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Save Button */}
        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={saving || !name.trim() || !username.trim()}
          buttonColor={IU_CRIMSON}
          textColor="#FFFFFF"
          style={styles.saveButton}
          contentStyle={styles.saveButtonContent}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  profilePictureSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#D0CFCD',
  },
  profilePicturePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: '40%',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: IU_CRIMSON,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  uploadingText: {
    marginTop: 8,
    fontSize: 12,
  },
  formContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  input: {
    marginBottom: 16,
  },
  bioInput: {
    minHeight: 100,
  },
  genderContainer: {
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  genderOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genderOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 100,
    alignItems: 'center',
  },
  genderOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 8,
  },
  saveButtonContent: {
    paddingVertical: 8,
  },
});

