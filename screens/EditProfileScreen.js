// Edit Profile screen - allows users to edit their profile information
import * as React from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Image, TouchableOpacity, Alert } from 'react-native';
import { Appbar, TextInput, Button, Avatar, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useThemeColors } from '../hooks/useThemeColors';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { uploadImages } from '../services/storageService';
import { getCurrentUserData } from '../services/authService';

const IU_CRIMSON = '#990000';

export default function EditProfileScreen({ navigation }) {
  // Get current user data
  const { user, userData } = useAuth();
  const { background, text, subText, surface, border } = useThemeColors();

  // Form state
  const [name, setName] = React.useState(userData?.name || user?.displayName || '');
  const [username, setUsername] = React.useState(userData?.username || '');
  const [bio, setBio] = React.useState(userData?.bio || '');
  const [age, setAge] = React.useState(userData?.age?.toString() || '');
  const [gender, setGender] = React.useState(userData?.gender || '');
  const [profilePicture, setProfilePicture] = React.useState(userData?.avatar || user?.photoURL || '');
  const [saving, setSaving] = React.useState(false);
  const [uploadingImage, setUploadingImage] = React.useState(false);

  // Gender options
  const genderOptions = ['', 'Male', 'Female', 'Non-binary', 'Prefer not to say'];

  // Handle profile picture selection
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
        setUploadingImage(true);
        const imageUri = result.assets[0].uri;
        
        // Upload image to Firebase Storage
        if (user?.uid) {
          const uploadResult = await uploadImages([imageUri], user.uid, 'profile');
          if (uploadResult.urls && uploadResult.urls.length > 0) {
            setProfilePicture(uploadResult.urls[0]);
            setUploadingImage(false);
          } else {
            Alert.alert('Error', 'Failed to upload profile picture. Please try again.');
            setUploadingImage(false);
          }
        } else {
          setProfilePicture(imageUri);
          setUploadingImage(false);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
      setUploadingImage(false);
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

    // Check if image needs to be uploaded (if it's a local file URI)
    if (profilePicture && profilePicture.startsWith('file://')) {
      Alert.alert('Please wait', 'Profile picture is still uploading. Please wait and try again.');
      return;
    }

    setSaving(true);

    try {
      console.log('💾 Starting profile update...');
      console.log('🔍 User UID:', user.uid);
      console.log('🔍 DB object:', db ? 'exists' : 'null');
      console.log('🔍 DB keys:', db && typeof db === 'object' ? Object.keys(db).length : 'not an object');

      // Check if Firestore is configured
      if (!db || typeof db !== 'object' || Object.keys(db).length === 0) {
        throw new Error('Firestore not configured. Please check your Firebase configuration.');
      }

      // Prepare update data
      const finalUsername = username.trim();
      const updateData = {
        name: name.trim(),
        username: finalUsername,
        usernameLowercase: finalUsername.trim().toLowerCase(), // For faster username search (trim again to be safe)
        avatar: profilePicture || userData?.avatar || '',
        bio: bio.trim() || null,
        age: age ? parseInt(age) : null,
        gender: gender || null,
        updatedAt: new Date().toISOString(),
      };

      console.log('📦 Update data:', updateData);

      // Update Firestore user document (this is the most important update)
      console.log('📝 Updating Firestore user document...');
      console.log('📝 User UID:', user.uid);
      console.log('📝 DB type:', typeof db);
      console.log('📝 DB is empty object?', Object.keys(db || {}).length === 0);
      
      let firestoreSuccess = false;
      const userRef = doc(db, 'users', user.uid);
      console.log('📝 User ref created:', userRef.id);
      
      // Try to update Firestore with a shorter timeout
      console.log('⏳ Starting Firestore update...');
      try {
        const firestoreUpdatePromise = setDoc(userRef, updateData, { merge: true });
        
        // Create timeout that will reject after 5 seconds
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            console.error('⏱️ Firestore update timeout after 5 seconds');
            reject(new Error('TIMEOUT'));
          }, 5000);
        });
        
        console.log('⏳ Waiting for Firestore update (max 5 seconds)...');
        await Promise.race([firestoreUpdatePromise, timeoutPromise]);
        console.log('✅ Firestore user document updated successfully');
        firestoreSuccess = true;
      } catch (firestoreError) {
        console.error('❌ Firestore update error:', firestoreError);
        if (firestoreError.message === 'TIMEOUT') {
          console.warn('⚠️ Firestore update timed out - this might be a network or permissions issue');
          // Continue anyway - we'll show a warning
        } else {
          console.error('❌ Firestore update failed:', firestoreError.message);
          // Continue anyway - we'll show a warning
        }
      }

      // Try to update Firebase Auth display name and photo (non-blocking)
      if (auth && !auth._isMock && user) {
        console.log('📝 Attempting Firebase Auth profile update...');
        try {
          await Promise.race([
            updateProfile(user, {
              displayName: name.trim(),
              photoURL: profilePicture || null,
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Auth update timeout')), 5000)),
          ]);
          console.log('✅ Firebase Auth profile updated');
        } catch (authError) {
          console.warn('⚠️ Firebase Auth update failed (non-critical):', authError.message);
          // Continue - Firestore update is more important
        }
      }

      // Success - show message and go back
      console.log('✅ Profile update completed');
      setSaving(false);
      
      // Show success message (with warning if Firestore timed out)
      const message = firestoreSuccess 
        ? 'Profile updated successfully!'
        : 'Profile updated! Some changes may not be saved yet due to connection issues. Please try again later.';
      
      Alert.alert(firestoreSuccess ? 'Success' : 'Warning', message, [
        {
          text: 'OK',
          onPress: () => {
            navigation.goBack();
          },
        },
      ]);
    } catch (error) {
      console.error('❌ Error updating profile:', error);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
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
          disabled={saving || uploadingImage}
          color={saving || uploadingImage ? subText : IU_CRIMSON}
        />
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile Picture Section */}
        <View style={styles.profilePictureSection}>
          <TouchableOpacity onPress={handlePickImage} disabled={uploadingImage}>
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
            <View style={styles.cameraIconContainer}>
              <MaterialCommunityIcons
                name="camera"
                size={20}
                color="#FFFFFF"
              />
            </View>
          </TouchableOpacity>
          {uploadingImage && (
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
            disabled={saving}
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
          disabled={saving || uploadingImage || !name.trim() || !username.trim()}
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

