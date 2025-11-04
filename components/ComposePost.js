// ComposePost component - modal for creating new posts
import * as React from 'react';
import { View, Modal, TextInput, StyleSheet, TouchableOpacity, Image, ScrollView, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { Text, Avatar, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
// Removed albums import - images will come from user's own photos
// Removed getCurrentLocation import - using account location instead of GPS

const IU_CRIMSON = '#990000';

export default function ComposePost({ visible, onClose, onSubmit, currentUser, submitting = false }) {
  // State for post content
  const [text, setText] = React.useState('');
  const [location, setLocation] = React.useState(''); // City name from GPS
  const [lat, setLat] = React.useState(null); // GPS latitude
  const [lng, setLng] = React.useState(null); // GPS longitude
  const [images, setImages] = React.useState([]);
  const [chooseFromOutlink, setChooseFromOutlink] = React.useState(false);
  const [visibility, setVisibility] = React.useState('location'); // 'friends' or 'location' - default to 'location'

  // Empty - images will come from user's own photos/Firebase in the future
  const appImages = [];

  const handlePickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need camera roll permissions!');
      return;
    }

    // Allow both images and videos from camera roll/albums
    // Lower quality for faster uploads
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.6, // Reduced from 0.8 for faster uploads
      selectionLimit: 10, // Allow up to 10 images
    });

    if (!result.canceled && result.assets) {
      const newMedia = result.assets.map(asset => asset.uri);
      setImages((prev) => [...prev, ...newMedia]);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need camera permissions to take photos!');
      return;
    }

    // Take a photo with the camera
    // Lower quality for faster uploads
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.6, // Reduced from 0.8 for faster uploads
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const newMedia = result.assets.map(asset => asset.uri);
      setImages((prev) => [...prev, ...newMedia]);
    }
  };

  const handleSubmit = () => {
    console.log('📝 Post button clicked');
    console.log('📝 Text:', text);
    console.log('📝 Location:', location);
    console.log('📝 Images:', images.length);
    console.log('📝 Submitting prop:', submitting);
    
    // Don't submit if already submitting
    if (submitting) {
      console.log('⏳ Already submitting, ignoring click');
      return;
    }
    
    Keyboard.dismiss();
    
    // Location is required - check if it's filled in
    if (!location.trim()) {
      console.log('❌ Location is required');
      alert('Location is required. Please enter your location.');
      return;
    }
    
    // Either text or images/videos must be provided
    if (!text.trim() && images.length === 0) {
      console.log('❌ Need text or images');
      alert('Please add text or media (pictures/videos) to your post.');
      return;
    }
    
    // Location is required - check if account location is set
    if (!location.trim()) {
      console.log('❌ Account location missing');
      alert('Location is required. Please set your location in your profile.');
      return;
    }
    
    console.log('✅ Submitting post...');
    console.log('✅ Total images selected:', images.length);
    console.log('✅ Visibility:', visibility);
    console.log('✅ Location:', location);
    // Submit all images together in one post - user can swipe through them
      onSubmit({
      text: text.trim() || '',
      location: location.trim() || 'Unknown Location', // Account location for filtering
      lat: null, // GPS not needed for location-based filtering anymore
      lng: null, // GPS not needed for location-based filtering anymore
      image: images.length > 0 ? images[0] : null, // Keep for backwards compatibility
      images: images.length > 0 ? images : null, // All selected images in one post
      visibility: visibility, // 'friends' or 'location'
    });
    // Clear form only after successful submission (handled by parent)
    // Keep form open during submission in case of error
  };

  // Set account location when modal opens (use account location, not GPS)
  React.useEffect(() => {
    if (visible) {
      // Reset form when modal opens
      console.log('🔄 Modal opened, resetting form');
      setText('');
      setImages([]);
      setVisibility('location'); // Reset to default
      
      // Use account location from userData (not GPS)
      const accountLocation = currentUser?.location || 'Unknown Location';
      setLocation(accountLocation);
      setLat(null); // GPS not needed for location filtering
      setLng(null); // GPS not needed for location filtering
      console.log('✅ Using account location:', accountLocation);
    } else {
      // Reset form when modal closes
      console.log('🔄 Modal closed, resetting form');
      setText('');
      setLocation('');
      setLat(null);
      setLng(null);
      setImages([]);
      setVisibility('location');
    }
  }, [visible, currentUser]);

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modal}>
              <View style={styles.header}>
                  <TouchableOpacity onPress={handleClose} style={styles.cancelButton}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                  <View style={styles.titleContainer}>
            <Text style={styles.title}>New Post</Text>
                  </View>
                      <TouchableOpacity
              onPress={handleSubmit}
                        disabled={(!text.trim() && images.length === 0) || !location.trim() || submitting}
                        style={[
                          styles.postButtonTouchable,
                          ((!text.trim() && images.length === 0) || !location.trim() || submitting) && styles.postButtonDisabled
                        ]}
            >
                        {submitting ? (
                          <Text style={styles.postButtonText}>Posting...</Text>
                        ) : (
                          <Text style={styles.postButtonText}>Post</Text>
                        )}
                      </TouchableOpacity>
          </View>

                <ScrollView
                  style={styles.scrollContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
          <View style={styles.content}>
            <Avatar.Image size={48} source={{ uri: currentUser?.avatar || 'https://i.pravatar.cc/100?img=12' }} />
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="What's happening?"
                placeholderTextColor="#666666"
                multiline
                value={text}
                onChangeText={setText}
                maxLength={280}
                        textAlignVertical="top"
              />
              {images.length > 0 && (
                        <View style={styles.imagesPreviewContainer}>
                          <Text style={styles.imagesPreviewTitle}>{images.length} photo{images.length > 1 ? 's' : ''} selected</Text>
                          <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false} 
                            style={styles.imagesPreview}
                            contentContainerStyle={styles.imagesPreviewContent}
                            pagingEnabled={true}
                            decelerationRate={0}
                            snapToInterval={212}
                            snapToAlignment="start"
                            scrollEventThrottle={16}
                            bounces={true}
                          >
                  {images.map((img, index) => (
                              <View key={index} style={styles.imagePreviewWrapper}>
                                <View style={styles.imagePreview}>
                                  <Image source={{ uri: img }} style={styles.previewImage} resizeMode="cover" />
                                  <TouchableOpacity style={styles.removeImageButton} onPress={() => removeImage(index)}>
                        <MaterialCommunityIcons name="close-circle" size={24} color="#FF6B6B" />
                      </TouchableOpacity>
                                  <View style={styles.imageIndexBadge}>
                                    <Text style={styles.imageIndexText}>{index + 1}</Text>
                                  </View>
                                </View>
                    </View>
                  ))}
                </ScrollView>
                          <Text style={styles.imagesPreviewHint}>Swipe left/right to see all photos • All photos will be in one post</Text>
                        </View>
              )}
              <View style={styles.locationRow}>
                            <MaterialCommunityIcons name="map-marker-outline" size={20} color={location.trim() ? "#990000" : "#666666"} />
                <TextInput
                  style={styles.locationInput}
                              placeholder="Location (required)"
                  placeholderTextColor="#666666"
                  value={location}
                              editable={false} // Location is set from account location
                  returnKeyType="done"
                  blurOnSubmit={true}
                  onSubmitEditing={Keyboard.dismiss}
                />
                          </View>
                      
                      {/* Privacy/Visibility Selector */}
                      <View style={styles.visibilityRow}>
                        <Text style={styles.visibilityLabel}>Who can see this?</Text>
                        <View style={styles.visibilityButtons}>
                          <TouchableOpacity
                            style={[
                              styles.visibilityButton,
                              visibility === 'friends' && styles.visibilityButtonActive,
                            ]}
                            onPress={() => setVisibility('friends')}
                          >
                            <MaterialCommunityIcons
                              name={visibility === 'friends' ? 'account-group' : 'account-group-outline'}
                              size={20}
                              color={visibility === 'friends' ? '#FFFFFF' : '#666666'}
                            />
                            <Text
                              style={[
                                styles.visibilityButtonText,
                                visibility === 'friends' && styles.visibilityButtonTextActive,
                              ]}
                            >
                              Friends Only
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.visibilityButton,
                              visibility === 'location' && styles.visibilityButtonActive,
                            ]}
                            onPress={() => setVisibility('location')}
                          >
                            <MaterialCommunityIcons
                              name={visibility === 'location' ? 'earth' : 'earth-outline'}
                              size={20}
                              color={visibility === 'location' ? '#FFFFFF' : '#666666'}
                            />
                            <Text
                              style={[
                                styles.visibilityButtonText,
                                visibility === 'location' && styles.visibilityButtonTextActive,
                              ]}
                            >
                              Everyone in {location.trim() || 'Location'}
                            </Text>
                          </TouchableOpacity>
                        </View>
              </View>
            </View>
          </View>
                </ScrollView>

          <View style={styles.footer}>
                  <TouchableOpacity style={styles.actionButton} onPress={handlePickMedia}>
                    <MaterialCommunityIcons name="image-outline" size={24} color="#990000" />
                    <Text style={styles.actionButtonLabel}>Album</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={handleTakePhoto}>
                    <MaterialCommunityIcons name="camera-outline" size={24} color="#990000" />
                    <Text style={styles.actionButtonLabel}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => setChooseFromOutlink(true)}>
                    <MaterialCommunityIcons name="image-multiple-outline" size={24} color="#990000" />
                    <Text style={styles.actionButtonLabel}>Multiple</Text>
            </TouchableOpacity>
            <Text style={styles.charCount}>{text.length}/280</Text>
          </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* OutLink Albums Picker */}
      <Modal visible={chooseFromOutlink} animationType="slide" transparent onRequestClose={() => setChooseFromOutlink(false)}>
        <View style={styles.overlay}>
          <View style={styles.gridModal}>
            <View style={styles.gridHeader}>
              <TouchableOpacity onPress={() => setChooseFromOutlink(false)}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Choose from your albums</Text>
              <View style={{ width: 64 }} />
            </View>
            <ScrollView contentContainerStyle={styles.gridContent}>
              {appImages.length > 0 ? (
                appImages.map((uri, idx) => (
                <TouchableOpacity key={idx} style={styles.gridItem} onPress={() => { setImages((prev) => [...prev, uri]); }}>
                  <Image source={{ uri }} style={styles.gridImage} />
                </TouchableOpacity>
                ))
              ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
                  <Text style={{ color: '#666666' }}>Empty</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#EEEDEB',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    maxHeight: '90%',
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  gridModal: {
    backgroundColor: '#EEEDEB',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#D0CFCD',
  },
  cancelButton: {
    width: 64,
    flexShrink: 0,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#1A1A1A',
    fontSize: 18,
    fontWeight: '700',
  },
  gridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#D0CFCD',
  },
  cancelText: {
    color: '#1A1A1A',
    fontSize: 16,
  },
  postButtonTouchable: {
    backgroundColor: IU_CRIMSON,
    borderRadius: 20,
    minWidth: 85,
    maxWidth: 85,
    flexShrink: 0,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.5,
  },
  postButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  content: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
    flex: 1,
  },
  inputContainer: {
    flex: 1,
    marginLeft: 12,
  },
  textInput: {
    color: '#1A1A1A',
    fontSize: 16,
    lineHeight: 24,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: -20,
    paddingBottom: 20,
  },
  imagesPreviewContainer: {
    marginTop: 12,
    marginBottom: 12,
  },
  imagesPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  imagesPreview: {
    marginBottom: 8,
    height: 150,
  },
  imagesPreviewContent: {
    flexDirection: 'row',
    paddingRight: 12,
  },
  imagePreviewWrapper: {
    width: 200,
    height: 150,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  imagePreview: {
    position: 'relative',
    width: 150,
    height: 150,
  },
  previewImage: {
    width: 150,
    height: 150,
    borderRadius: 12,
    backgroundColor: '#D0CFCD',
  },
  imageIndexBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  imageIndexText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  imagesPreviewHint: {
    fontSize: 12,
    color: '#666666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  gridContent: {
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridItem: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F5F4F2',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -24,
    paddingTop: 28,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#D0CFCD',
  },
  locationInput: {
    flex: 1,
    color: '#1A1A1A',
    fontSize: 14,
    marginLeft: 8,
  },
  locationLoading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 8,
  },
  locationLoadingText: {
    color: '#666666',
    fontSize: 14,
  },
  visibilityRow: {
    marginTop: 12,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#D0CFCD',
  },
  visibilityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  visibilityButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  visibilityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F5F4F2',
    borderWidth: 1,
    borderColor: '#D0CFCD',
    gap: 8,
  },
  visibilityButtonActive: {
    backgroundColor: IU_CRIMSON,
    borderColor: IU_CRIMSON,
  },
  visibilityButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  visibilityButtonTextActive: {
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#D0CFCD',
    backgroundColor: '#EEEDEB',
  },
  actionButton: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionButtonLabel: {
    color: '#990000',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  charCount: {
    color: '#666666',
    fontSize: 14,
    marginLeft: 'auto',
  },
});

