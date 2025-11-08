// ComposePost component - modal for creating new posts
import * as React from 'react';
import { View, Modal, TextInput, StyleSheet, TouchableOpacity, Image, ScrollView, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { Text, Avatar, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../hooks/useThemeColors';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
// Removed albums import - images will come from user's own photos
// Removed getCurrentLocation import - using account location instead of GPS

const IU_CRIMSON = '#CC0000';

// Predefined bar options (same as TonightSelector)
const PREDEFINED_BARS = [
  'Kilroys on Kirkwood',
  'Kilroys Sports',
  'Bluebird',
  'La Una',
  'Brothers',
  'The Upstairs Pub',
  'Nicks English Hut',
];

export default function ComposePost({ visible, onClose, onSubmit, currentUser, submitting = false, initialImages = [] }) {
  // Get theme colors
  const { isDarkMode, text: textColor, subText, surface, border, divider, background } = useThemeColors();
  
  // State for post content
  const [text, setText] = React.useState('');
  const [location, setLocation] = React.useState(''); // City name from GPS
  const [lat, setLat] = React.useState(null); // GPS latitude
  const [lng, setLng] = React.useState(null); // GPS longitude
  const [images, setImages] = React.useState([]);
  const [chooseFromOutlink, setChooseFromOutlink] = React.useState(false);
  const [visibility, setVisibility] = React.useState('location'); // 'friends' or 'location' - default to 'location'
  const [bar, setBar] = React.useState(''); // Bar name (used for location field)
  const [barDropdownVisible, setBarDropdownVisible] = React.useState(false);
  const [cityLocation, setCityLocation] = React.useState(''); // City location for filtering (hidden)
  const navigation = useNavigation();

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

  const handleTakePhoto = () => {
    // Navigate to Camera tab instead of using system camera
    // Close ComposePost modal first
    handleClose();
    // Navigate to Camera tab
    navigation.navigate('Camera');
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
    
    // Bar location is required - check if it's filled in
    if (!bar.trim()) {
      console.log('❌ Bar location is required');
      alert('Please select a bar location.');
      return;
    }
    
    // Either text or images/videos must be provided
    if (!text.trim() && images.length === 0) {
      console.log('❌ Need text or images');
      alert('Please add text or media (pictures/videos) to your post.');
      return;
    }
    
    console.log('✅ Submitting post...');
    console.log('✅ Total images selected:', images.length);
    console.log('✅ Visibility:', visibility);
    console.log('✅ Bar location:', bar);
    console.log('✅ City location (for filtering):', cityLocation);
    // Submit all images together in one post - user can swipe through them
      onSubmit({
      text: text.trim() || '',
      location: cityLocation.trim() || 'Unknown Location', // City location for filtering
      lat: null, // GPS not needed for location-based filtering anymore
      lng: null, // GPS not needed for location-based filtering anymore
      image: images.length > 0 ? images[0] : null, // Keep for backwards compatibility
      images: images.length > 0 ? images : null, // All selected images in one post
      visibility: visibility, // 'friends' or 'location'
      bar: bar.trim() || null, // Bar name (used as location display)
    });
    // Clear form only after successful submission (handled by parent)
    // Keep form open during submission in case of error
  };

  // Track previous visible state to detect when modal actually closes
  const prevVisibleRef = React.useRef(visible);
  
  // Set account location when modal opens (use account location, not GPS)
  React.useEffect(() => {
    const prevVisible = prevVisibleRef.current;
    prevVisibleRef.current = visible;
    
    if (visible) {
      // Reset form when modal opens
      console.log('🔄 Modal opened, resetting form');
      setText('');
      // Set initial images if provided (from camera), otherwise reset
      setImages(initialImages && initialImages.length > 0 ? [...initialImages] : []);
      setVisibility('location'); // Reset to default
      
      // Use account location from userData for filtering (hidden, stored in cityLocation)
      // Get location from currentUser prop (which should be userData from AuthContext)
      const accountLocation = currentUser?.location;
      
      // Check if location exists and is valid
      if (accountLocation && accountLocation.trim() && accountLocation !== 'Unknown Location') {
        setCityLocation(accountLocation.trim());
        setLocation(accountLocation.trim()); // Keep for backwards compatibility
        console.log('✅ Using account city location from profile:', accountLocation.trim());
      } else {
        // Fallback to default location if not set in profile
        console.warn('⚠️ Location not set in profile, using default');
        const defaultLocation = 'Bloomington, IN';
        setCityLocation(defaultLocation);
        setLocation(defaultLocation); // Keep for backwards compatibility
      }
      
      setLat(null); // GPS not needed for location filtering
      setLng(null); // GPS not needed for location filtering
      
      // Load last voted bar from AsyncStorage for auto-fill
      AsyncStorage.getItem('lastVotedBar')
        .then(lastBar => {
          if (lastBar && lastBar.trim()) {
            setBar(lastBar.trim());
            console.log('✅ Auto-filled bar from last vote:', lastBar.trim());
          }
        })
        .catch(err => console.error('Error loading last voted bar:', err));
    } else if (prevVisible && !visible) {
      // Only reset when modal actually closes (was visible, now not visible)
      console.log('🔄 Modal closed, resetting form');
      setText('');
      setLocation('');
      setCityLocation('');
      setLat(null);
      setLng(null);
      setImages([]);
      setVisibility('location');
      setBar(''); // Reset bar field
    }
  }, [visible, currentUser]); // Removed initialImages from dependencies to prevent infinite loop

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
            <LinearGradient
              colors={isDarkMode ? ['#1a0000', '#121212', '#0a0000'] : ['#ffe5e5', '#FAFAFA', '#fff5f5']}
              style={[styles.modal, { backgroundColor: 'transparent' }]}
            >
              <View style={[styles.header, { borderBottomColor: divider, backgroundColor: 'transparent' }]}>
                  <TouchableOpacity onPress={handleClose} style={styles.cancelButton}>
                  <Text style={[styles.cancelText, { color: textColor }]}>Cancel</Text>
                </TouchableOpacity>
                  <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: textColor }]}>New Post</Text>
                  </View>
                      <TouchableOpacity
              onPress={handleSubmit}
                        disabled={(!text.trim() && images.length === 0) || !bar.trim() || submitting}
                        style={[
                          styles.postButtonTouchable,
                          ((!text.trim() && images.length === 0) || !bar.trim() || submitting) && styles.postButtonDisabled
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
                  style={[styles.scrollContent, { backgroundColor: 'transparent' }]}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
          <View style={[styles.content, { backgroundColor: 'transparent' }]}>
            <Avatar.Image size={48} source={{ uri: currentUser?.avatar || 'https://i.pravatar.cc/100?img=12' }} />
              <View style={styles.inputContainer}>
              <TextInput
                style={[styles.textInput, { color: textColor }]}
                placeholder="What's happening?"
                placeholderTextColor={subText}
                multiline
                value={text}
                onChangeText={setText}
                maxLength={280}
                        textAlignVertical="top"
              />
              {images.length > 0 && (
                        <View style={styles.imagesPreviewContainer}>
                          <Text style={[styles.imagesPreviewTitle, { color: textColor }]}>{images.length} photo{images.length > 1 ? 's' : ''} selected</Text>
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
                          <Text style={[styles.imagesPreviewHint, { color: subText }]}>Swipe left/right to see all photos • All photos will be in one post</Text>
                        </View>
              )}
              {/* Bar Location Selector (replaces location field) */}
              <View style={[styles.locationRow, { borderTopColor: divider }]}>
                <MaterialCommunityIcons name="map-marker-outline" size={20} color={bar.trim() ? IU_CRIMSON : subText} />
                <TouchableOpacity
                  style={styles.locationInputTouchable}
                  onPress={() => setBarDropdownVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.locationInputText, { color: bar.trim() ? textColor : subText }]}>
                    {bar.trim() || 'Select a bar (required)'}
                  </Text>
                  <MaterialCommunityIcons 
                    name={barDropdownVisible ? 'chevron-up' : 'chevron-down'} 
                    size={20} 
                    color={subText} 
                  />
                </TouchableOpacity>
              </View>
                      
                      {/* Privacy/Visibility Selector */}
                      <View style={[styles.visibilityRow, { borderTopColor: divider }]}>
                        <Text style={[styles.visibilityLabel, { color: textColor }]}>Who can see this?</Text>
                        <View style={styles.visibilityButtons}>
                          <TouchableOpacity
                            style={[
                              styles.visibilityButton,
                              { backgroundColor: surface, borderColor: border },
                              visibility === 'friends' && styles.visibilityButtonActive,
                            ]}
                            onPress={() => setVisibility('friends')}
                          >
                            <MaterialCommunityIcons
                              name={visibility === 'friends' ? 'account-group' : 'account-group-outline'}
                              size={20}
                              color={visibility === 'friends' ? '#FFFFFF' : subText}
                            />
                            <Text
                              style={[
                                styles.visibilityButtonText,
                                { color: subText },
                                visibility === 'friends' && styles.visibilityButtonTextActive,
                              ]}
                            >
                              Friends Only
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.visibilityButton,
                              { backgroundColor: surface, borderColor: border },
                              visibility === 'location' && styles.visibilityButtonActive,
                            ]}
                            onPress={() => setVisibility('location')}
                          >
                            <MaterialCommunityIcons
                              name={visibility === 'location' ? 'earth' : 'earth-outline'}
                              size={20}
                              color={visibility === 'location' ? '#FFFFFF' : subText}
                            />
                            <Text
                              style={[
                                styles.visibilityButtonText,
                                { color: subText },
                                visibility === 'location' && styles.visibilityButtonTextActive,
                              ]}
                            >
                              Everyone in {cityLocation.trim() || 'Location'}
                            </Text>
                          </TouchableOpacity>
                        </View>
              </View>
            </View>
          </View>
                </ScrollView>

          <View style={[styles.footer, { borderTopColor: divider, backgroundColor: 'transparent' }]}>
                  <TouchableOpacity style={styles.actionButton} onPress={handlePickMedia}>
                    <MaterialCommunityIcons name="image-outline" size={24} color={IU_CRIMSON} />
                    <Text style={[styles.actionButtonLabel, { color: IU_CRIMSON }]}>Album</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={handleTakePhoto}>
                    <MaterialCommunityIcons name="camera-outline" size={24} color={IU_CRIMSON} />
                    <Text style={[styles.actionButtonLabel, { color: IU_CRIMSON }]}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => setChooseFromOutlink(true)}>
                    <MaterialCommunityIcons name="image-multiple-outline" size={24} color={IU_CRIMSON} />
                    <Text style={[styles.actionButtonLabel, { color: IU_CRIMSON }]}>Multiple</Text>
            </TouchableOpacity>
            <Text style={[styles.charCount, { color: subText }]}>{text.length}/280</Text>
          </View>
            </LinearGradient>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* OutLink Albums Picker */}
      <Modal visible={chooseFromOutlink} animationType="slide" transparent onRequestClose={() => setChooseFromOutlink(false)}>
        <View style={styles.overlay}>
          <LinearGradient
            colors={isDarkMode ? ['#1a0000', '#121212', '#0a0000'] : ['#ffe5e5', '#FAFAFA', '#fff5f5']}
            style={[styles.gridModal, { backgroundColor: 'transparent' }]}
          >
            <View style={[styles.gridHeader, { borderBottomColor: divider, backgroundColor: 'transparent' }]}>
              <TouchableOpacity onPress={() => setChooseFromOutlink(false)}>
                <Text style={[styles.cancelText, { color: textColor }]}>Close</Text>
              </TouchableOpacity>
              <Text style={[styles.title, { color: textColor }]}>Choose from your albums</Text>
              <View style={{ width: 64 }} />
            </View>
            <ScrollView contentContainerStyle={styles.gridContent}>
              {appImages.length > 0 ? (
                appImages.map((uri, idx) => (
                <TouchableOpacity key={idx} style={[styles.gridItem, { backgroundColor: surface }]} onPress={() => { setImages((prev) => [...prev, uri]); }}>
                  <Image source={{ uri }} style={styles.gridImage} />
                </TouchableOpacity>
                ))
              ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
                  <Text style={{ color: subText }}>Empty</Text>
                </View>
              )}
            </ScrollView>
          </LinearGradient>
        </View>
      </Modal>

      {/* Bar Selector Dropdown */}
      <Modal
        visible={barDropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBarDropdownVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setBarDropdownVisible(false)}
        >
          <View style={[styles.barDropdownContainer, { backgroundColor: surface, borderColor: border }]}>
            <ScrollView style={styles.barDropdownScroll} keyboardShouldPersistTaps="handled">
              {PREDEFINED_BARS.map((barOption) => (
                <TouchableOpacity
                  key={barOption}
                  style={[styles.barDropdownItem, { borderBottomColor: divider }, bar === barOption && { backgroundColor: isDarkMode ? 'rgba(58, 58, 58, 0.3)' : 'rgba(224, 224, 224, 0.3)' }]}
                  onPress={() => {
                    setBar(barOption);
                    setBarDropdownVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.barDropdownItemText, { color: textColor }, bar === barOption && { color: IU_CRIMSON, fontWeight: '600' }]}>
                    {barOption}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.barDropdownItem, { borderBottomColor: divider }]}
                onPress={() => {
                  setBar('');
                  setBarDropdownVisible(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.barDropdownItemText, { color: subText }]}>Clear</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    maxHeight: '90%',
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  scrollContent: {
    flexGrow: 1,
  },
  gridModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
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
  },
  cancelText: {
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
    marginBottom: 8,
  },
  imagesPreview: {
    marginBottom: 8,
    height: 200 * (4 / 3), // 3:4 aspect ratio height (268)
  },
  imagesPreviewContent: {
    flexDirection: 'row',
    paddingRight: 12,
  },
  imagePreviewWrapper: {
    width: 200,
    height: 200 * (4 / 3), // 3:4 aspect ratio (268)
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  imagePreview: {
    position: 'relative',
    width: 150,
    height: 150 * (4 / 3), // 3:4 aspect ratio (200)
  },
  previewImage: {
    width: 150,
    height: 150 * (4 / 3), // 3:4 aspect ratio (200)
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
    aspectRatio: 3 / 4, // 3:4 aspect ratio
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
  },
  locationInputTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 8,
    paddingVertical: 8,
  },
  locationInputText: {
    flex: 1,
    fontSize: 14,
  },
  locationInputPlaceholder: {
    // Removed - using dynamic color
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
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#D0CFCD',
  },
  barInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 8,
    paddingVertical: 8,
  },
  barInputText: {
    color: '#1A1A1A',
    fontSize: 14,
    flex: 1,
  },
  barInputPlaceholder: {
    color: '#666666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  barDropdownContainer: {
    width: '80%',
    maxHeight: '60%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  barDropdownScroll: {
    maxHeight: 400,
  },
  barDropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
  },
  barDropdownItemSelected: {
    // Removed - using dynamic color
  },
  barDropdownItemText: {
    fontSize: 16,
  },
  barDropdownItemTextSelected: {
    // Removed - using dynamic color
  },
  visibilityRow: {
    marginTop: 12,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
  },
  visibilityLabel: {
    fontSize: 14,
    fontWeight: '600',
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
    borderWidth: 1,
    gap: 8,
  },
  visibilityButtonActive: {
    backgroundColor: IU_CRIMSON,
    borderColor: IU_CRIMSON,
  },
  visibilityButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
  },
  actionButton: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionButtonLabel: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  charCount: {
    fontSize: 14,
    marginLeft: 'auto',
  },
});

