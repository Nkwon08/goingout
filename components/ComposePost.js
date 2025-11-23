// ComposePost component - modal for creating new posts
import * as React from 'react';
import { View, Modal, TextInput, StyleSheet, TouchableOpacity, Image, ScrollView, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { Text, Avatar, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import UserAvatar from './UserAvatar';
import { LinearGradient } from 'expo-linear-gradient';
import { Video } from 'expo-av';
import { useThemeColors } from '../hooks/useThemeColors';
import { useAuth } from '../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { searchUsersByPrefix } from '../services/usersService';
import { subscribeToUserGroups } from '../services/groupsService';
import { subscribeToGroupPhotos } from '../services/groupPhotosService';
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

export default function ComposePost({ visible, onClose, onSubmit, currentUser, submitting = false, initialImages = [], initialVideo = null }) {
  // Get theme colors
  const { isDarkMode, text: textColor, subText, surface, border, divider, background } = useThemeColors();
  const { user, friendsList } = useAuth();
  
  // State for post content
  const [text, setText] = React.useState('');
  const [location, setLocation] = React.useState(''); // City name from GPS
  const [lat, setLat] = React.useState(null); // GPS latitude
  const [lng, setLng] = React.useState(null); // GPS longitude
  const [images, setImages] = React.useState([]);
  const [video, setVideo] = React.useState(null);
  const [chooseFromOutlink, setChooseFromOutlink] = React.useState(false);
  const [showMemoriesModal, setShowMemoriesModal] = React.useState(false);
  const [showGroupPhotosModal, setShowGroupPhotosModal] = React.useState(false);
  const [groups, setGroups] = React.useState([]);
  const [selectedGroup, setSelectedGroup] = React.useState(null);
  const [groupPhotos, setGroupPhotos] = React.useState([]);
  const [selectedGroupPhotos, setSelectedGroupPhotos] = React.useState(new Set());
  const [visibility, setVisibility] = React.useState('location'); // 'friends' or 'location' - default to 'location'
  const [bar, setBar] = React.useState(''); // Bar name (used for location field)
  const [barDropdownVisible, setBarDropdownVisible] = React.useState(false);
  const [cityLocation, setCityLocation] = React.useState(''); // City location for filtering (hidden)
  const navigation = useNavigation();
  
  // State for @mention autocomplete
  const [mentionSuggestions, setMentionSuggestions] = React.useState([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = React.useState(false);
  const [mentionQuery, setMentionQuery] = React.useState('');
  const [mentionStartIndex, setMentionStartIndex] = React.useState(-1);
  const [searchingUsers, setSearchingUsers] = React.useState(false);
  
  // Step state: 'media' or 'details' (caption and location)
  const [currentStep, setCurrentStep] = React.useState('media');

  // Empty - images will come from user's own photos/Firebase in the future
  const appImages = [];
  const hasMediaSelected = images.length > 0 || !!video;
  const mediaCount = images.length + (video ? 1 : 0);

  React.useEffect(() => {
    if (video && currentStep === 'media') {
      setCurrentStep('details');
    }
  }, [video, currentStep]);

  const handlePickMedia = async () => {
    if (video) {
      Alert.alert('Video Selected', 'Remove the video before adding photos.');
      return;
    }
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
      // If we have images now, move to details step
      if (images.length === 0 && newMedia.length > 0) {
        setCurrentStep('details');
      }
    }
  };

  const handleTakePhoto = () => {
    // Navigate to Camera screen - the camera will handle adding images back to this modal
    // Store current state in AsyncStorage so camera can return to this flow
    AsyncStorage.setItem('composePostState', JSON.stringify({
      text,
      bar,
      visibility,
      cityLocation,
    }));
    // Close ComposePost modal temporarily
    handleClose();
    // Navigate to Camera screen in root navigator
    let rootNavigator = navigation;
    let parent = navigation.getParent();
    while (parent) {
      rootNavigator = parent;
      parent = parent.getParent();
    }
    rootNavigator.navigate('Camera');
  };

  const handleSubmit = () => {
    console.log('📝 Post button clicked');
    console.log('📝 Text:', text);
    console.log('📝 Location:', location);
    console.log('📝 Images:', images.length);
    console.log('📝 Video selected:', !!video);
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
    if (!text.trim() && !hasMediaSelected) {
      console.log('❌ Need text or images');
      alert('Please add text or media (pictures/videos) to your post.');
      return;
    }
    
    console.log('✅ Submitting post...');
    console.log('✅ Total media selected:', mediaCount);
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
      video: video || null,
      videos: video ? [video] : null,
      visibility: visibility, // 'friends' or 'location'
      bar: bar.trim() || null, // Bar name (used as location display)
    });
    // Clear form only after successful submission (handled by parent)
    // Keep form open during submission in case of error
  };

  // Track previous visible state to detect when modal actually closes
  const prevVisibleRef = React.useRef(visible);
  
  // Search for users when mention query changes
  React.useEffect(() => {
    if (!showMentionSuggestions || !mentionQuery || mentionQuery.trim().length === 0) {
      setMentionSuggestions([]);
      return;
    }
    
    if (!user?.uid) {
      return;
    }
    
    const searchUsers = async () => {
      setSearchingUsers(true);
      try {
        const { users, error } = await searchUsersByPrefix(
          mentionQuery.trim(),
          user.uid,
          friendsList || [],
          10 // Limit to 10 suggestions
        );
        
        if (error) {
          console.error('Error searching users for mentions:', error);
          setMentionSuggestions([]);
        } else {
          setMentionSuggestions(users || []);
        }
      } catch (error) {
        console.error('Error searching users for mentions:', error);
        setMentionSuggestions([]);
      } finally {
        setSearchingUsers(false);
      }
    };
    
    // Debounce search to avoid too many requests
    const timeoutId = setTimeout(() => {
      searchUsers();
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [mentionQuery, showMentionSuggestions, user?.uid, friendsList]);
  
  // Subscribe to user groups (both current and expired) when Memories modal is visible
  React.useEffect(() => {
    if (!showMemoriesModal || !user?.uid) {
      setGroups([]);
      return;
    }
    
    const unsubscribe = subscribeToUserGroups(user.uid, ({ groups: userGroups, error }) => {
      if (error) {
        console.error('Error loading groups:', error);
        setGroups([]);
      } else {
        // Show both current and expired groups
        setGroups(userGroups || []);
      }
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [showMemoriesModal, user?.uid]);
  
  // Subscribe to group photos when a group is selected
  React.useEffect(() => {
    if (!selectedGroup?.id || !showGroupPhotosModal) {
      setGroupPhotos([]);
      setSelectedGroupPhotos(new Set());
      return;
    }
    
    const unsubscribe = subscribeToGroupPhotos(selectedGroup.id, ({ photos, error }) => {
      if (error) {
        console.error('Error loading group photos:', error);
        setGroupPhotos([]);
      } else {
        // Filter to only show photos (not videos)
        const photoItems = photos.filter(photo => photo.type === 'photo' && photo.uri);
        setGroupPhotos(photoItems);
      }
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedGroup?.id, showGroupPhotosModal]);
  
  // Set account location when modal opens (use account location, not GPS)
  React.useEffect(() => {
    const prevVisible = prevVisibleRef.current;
    prevVisibleRef.current = visible;
    
    if (visible) {
      // Reset form when modal opens
      console.log('🔄 Modal opened, resetting form');
      setText('');
      // Set initial media if provided (from camera), otherwise reset
      const hasInitialImages = initialImages && initialImages.length > 0;
      const hasInitialVideo = !!initialVideo;
      setImages(hasInitialImages ? [...initialImages] : []);
      setVideo(hasInitialVideo ? initialVideo : null);
      
      // Set step based on whether we have images
      // If we have initial media (from camera), go to details step
      // Otherwise, start at media selection step
      setCurrentStep(hasInitialImages || hasInitialVideo ? 'details' : 'media');
      
      // Try to restore state from AsyncStorage (if coming back from camera)
      AsyncStorage.getItem('composePostState')
        .then(savedState => {
          if (savedState) {
            try {
              const state = JSON.parse(savedState);
              if (state.text) setText(state.text);
              if (state.bar) setBar(state.bar);
              if (state.visibility) setVisibility(state.visibility);
              if (state.cityLocation) setCityLocation(state.cityLocation);
              // Clear saved state after restoring
              AsyncStorage.removeItem('composePostState');
            } catch (e) {
              console.error('Error restoring compose post state:', e);
            }
          }
        })
        .catch(err => console.error('Error loading compose post state:', err));
      
      setVisibility('location'); // Reset to default
      // Reset mention suggestions
      setShowMentionSuggestions(false);
      setMentionSuggestions([]);
      setMentionQuery('');
      setMentionStartIndex(-1);
      
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
      setVideo(null);
      setVisibility('location');
      setBar(''); // Reset bar field
      setCurrentStep('media'); // Reset to media selection step
      // Reset mention suggestions
      setShowMentionSuggestions(false);
      setMentionSuggestions([]);
      setMentionQuery('');
      setMentionStartIndex(-1);
    }
  }, [visible, currentUser, initialVideo, initialImages]);

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  const removeImage = (index) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0 && !video) {
        setCurrentStep('media');
      }
      return next;
    });
  };

  const removeVideo = () => {
    setVideo(null);
    if (images.length === 0) {
      setCurrentStep('media');
    }
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
            <Text style={[styles.title, { color: textColor }]}>
              {currentStep === 'media' ? 'Select Media' : 'Add Details'}
            </Text>
                  </View>
                      {currentStep === 'media' ? (
                        <View style={{ width: 64 }} />
                      ) : (
                        <TouchableOpacity
                          onPress={() => setCurrentStep('media')}
                          style={styles.backButton}
                        >
                          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
                        </TouchableOpacity>
                      )}
                      {currentStep === 'details' && (
                        <TouchableOpacity
                          onPress={handleSubmit}
                          disabled={(!text.trim() && !hasMediaSelected) || !bar.trim() || submitting}
                          style={[
                            styles.postButtonTouchable,
                            ((!text.trim() && !hasMediaSelected) || !bar.trim() || submitting) && styles.postButtonDisabled
                          ]}
                        >
                          {submitting ? (
                            <Text style={styles.postButtonText}>Posting...</Text>
                          ) : (
                            <Text style={styles.postButtonText}>Post</Text>
                          )}
                        </TouchableOpacity>
                      )}
          </View>

                {currentStep === 'media' ? (
                  // Step 1: Media Selection Screen
                  <View style={[styles.mediaSelectionContainer, { backgroundColor: 'transparent' }]}>
                    <View style={styles.mediaSelectionContent}>
                      <Text style={[styles.mediaSelectionTitle, { color: textColor }]}>
                        Add photos to your post
                      </Text>
                      <Text style={[styles.mediaSelectionSubtitle, { color: subText }]}>
                        Choose from your album, take a photo, or select multiple images
                      </Text>
                      
                      {images.length > 0 && (
                        <View style={styles.selectedMediaPreview}>
                          <Text style={[styles.selectedMediaTitle, { color: textColor }]}>
                            {images.length} photo{images.length > 1 ? 's' : ''} selected
                          </Text>
                          <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false} 
                            style={styles.mediaPreview}
                            contentContainerStyle={styles.mediaPreviewContent}
                          >
                            {images.map((img, index) => (
                              <View key={index} style={styles.mediaPreviewItem}>
                                <Image source={{ uri: img }} style={styles.mediaPreviewImage} resizeMode="cover" />
                                <TouchableOpacity 
                                  style={styles.removeMediaButton} 
                                  onPress={() => removeImage(index)}
                                >
                                  <MaterialCommunityIcons name="close-circle" size={24} color="#FF6B6B" />
                                </TouchableOpacity>
                              </View>
                            ))}
                          </ScrollView>
                          <TouchableOpacity
                            style={[styles.nextButton, { backgroundColor: IU_CRIMSON }]}
                            onPress={() => setCurrentStep('details')}
                          >
                            <Text style={styles.nextButtonText}>Next</Text>
                            <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      )}
                      
                      <View style={styles.mediaOptionsContainer}>
                        <TouchableOpacity 
                          style={[styles.mediaOption, { backgroundColor: surface, borderColor: border }]}
                          onPress={handlePickMedia}
                        >
                          <MaterialCommunityIcons name="image-outline" size={48} color={IU_CRIMSON} />
                          <Text style={[styles.mediaOptionLabel, { color: textColor }]}>Album</Text>
                          <Text style={[styles.mediaOptionDescription, { color: subText }]}>
                            Choose from your photos
                          </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={[styles.mediaOption, { backgroundColor: surface, borderColor: border }]}
                          onPress={handleTakePhoto}
                        >
                          <MaterialCommunityIcons name="camera-outline" size={48} color={IU_CRIMSON} />
                          <Text style={[styles.mediaOptionLabel, { color: textColor }]}>Camera</Text>
                          <Text style={[styles.mediaOptionDescription, { color: subText }]}>
                            Take a new photo
                          </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={[styles.mediaOption, { backgroundColor: surface, borderColor: border }]}
                          onPress={() => setShowMemoriesModal(true)}
                        >
                          <MaterialCommunityIcons name="image-multiple-outline" size={48} color={IU_CRIMSON} />
                          <Text style={[styles.mediaOptionLabel, { color: textColor }]} numberOfLines={1}>Memories</Text>
                          <Text style={[styles.mediaOptionDescription, { color: subText }]}>
                            Select from your groups
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ) : (
                  // Step 2: Details Screen (Caption and Location)
                  <ScrollView
                    style={[styles.scrollContent, { backgroundColor: 'transparent' }]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
            <View style={[styles.content, { backgroundColor: 'transparent' }]}>
            <UserAvatar size={48} uri={currentUser?.avatar} />
              <View style={styles.inputContainer}>
              <TextInput
                style={[styles.textInput, { color: textColor }]}
                placeholder="What's happening?"
                placeholderTextColor={subText}
                multiline
                value={text}
                onChangeText={(newText) => {
                  setText(newText);
                  
                  // Detect @mention pattern
                  const lastAtIndex = newText.lastIndexOf('@');
                  const cursorPos = newText.length;
                  
                  // Check if @ is followed by text (not whitespace or end of string)
                  if (lastAtIndex !== -1) {
                    const afterAt = newText.substring(lastAtIndex + 1);
                    const spaceIndex = afterAt.indexOf(' ');
                    const newlineIndex = afterAt.indexOf('\n');
                    
                    // Find the end of the mention query (space, newline, or end of string)
                    let queryEnd = afterAt.length;
                    if (spaceIndex !== -1) queryEnd = Math.min(queryEnd, spaceIndex);
                    if (newlineIndex !== -1) queryEnd = Math.min(queryEnd, newlineIndex);
                    
                    const query = afterAt.substring(0, queryEnd);
                    
                    // Only show suggestions if there's a query after @
                    if (query.length > 0 && cursorPos > lastAtIndex) {
                      setMentionQuery(query);
                      setMentionStartIndex(lastAtIndex);
                      setShowMentionSuggestions(true);
                    } else {
                      setShowMentionSuggestions(false);
                      setMentionSuggestions([]);
                    }
                  } else {
                    setShowMentionSuggestions(false);
                    setMentionSuggestions([]);
                  }
                }}
                maxLength={280}
                textAlignVertical="top"
              />
              {/* @Mention Suggestions Dropdown */}
              {showMentionSuggestions && mentionQuery.length > 0 && (
                <View style={[styles.mentionSuggestionsContainer, { backgroundColor: surface, borderColor: border }]}>
                  {searchingUsers ? (
                    <View style={styles.mentionLoadingContainer}>
                      <ActivityIndicator size="small" color={IU_CRIMSON} />
                      <Text style={[styles.mentionLoadingText, { color: subText }]}>Searching...</Text>
                    </View>
                  ) : mentionSuggestions.length > 0 ? (
                    <ScrollView 
                      style={styles.mentionSuggestionsScroll}
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled={true}
                    >
                      {mentionSuggestions.map((suggestedUser, index) => (
                        <TouchableOpacity
                          key={`mention-${suggestedUser.uid || suggestedUser.username || index}`}
                          style={[styles.mentionSuggestionItem, { borderBottomColor: divider }]}
                          onPress={() => {
                            // Insert the username into the text
                            const beforeMention = text.substring(0, mentionStartIndex);
                            const afterMention = text.substring(mentionStartIndex + 1 + mentionQuery.length);
                            const newText = `${beforeMention}@${suggestedUser.username} ${afterMention}`;
                            setText(newText);
                            setShowMentionSuggestions(false);
                            setMentionSuggestions([]);
                            setMentionQuery('');
                          }}
                          activeOpacity={0.7}
                        >
                          <UserAvatar 
                            size={40} 
                            uri={suggestedUser.avatar} 
                          />
                          <View style={styles.mentionSuggestionInfo}>
                            <Text style={[styles.mentionSuggestionName, { color: textColor }]}>
                              {suggestedUser.name || 'User'}
                            </Text>
                            <Text style={[styles.mentionSuggestionUsername, { color: subText }]}>
                              @{suggestedUser.username}
                            </Text>
                          </View>
                          {suggestedUser.isFriend && (
                            <MaterialCommunityIcons name="account-check" size={16} color={IU_CRIMSON} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : (
                    <View style={styles.mentionNoResultsContainer}>
                      <Text style={[styles.mentionNoResultsText, { color: subText }]}>No users found</Text>
                    </View>
                  )}
                </View>
              )}
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
              {video && (
                <View style={styles.videoPreviewContainer}>
                  <Text style={[styles.imagesPreviewTitle, { color: textColor }]}>Video selected</Text>
                  <View style={styles.videoPreview}>
                    <Video
                      source={{ uri: video }}
                      style={styles.videoPlayer}
                      useNativeControls
                      resizeMode="contain"
                    />
                    <TouchableOpacity style={styles.removeImageButton} onPress={removeVideo}>
                      <MaterialCommunityIcons name="close-circle" size={24} color="#FF6B6B" />
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.imagesPreviewHint, { color: subText }]}>This video will be included in your post</Text>
                </View>
              )}
              {/* Character count */}
              <View style={[styles.charCountContainer, { borderTopColor: divider }]}>
                <Text style={[styles.charCount, { color: subText }]}>{text.length}/280</Text>
              </View>
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
                )}
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
                <TouchableOpacity key={idx} style={[styles.gridItem, { backgroundColor: surface }]} onPress={() => { 
                  setImages((prev) => {
                    const newImages = [...prev, uri];
                    // If we have images now, move to details step
                    if (prev.length === 0 && newImages.length > 0) {
                      setCurrentStep('details');
                    }
                    return newImages;
                  });
                  setChooseFromOutlink(false);
                }}>
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

      {/* Memories Modal - Show Groups */}
      <Modal 
        visible={showMemoriesModal} 
        animationType="slide" 
        transparent 
        onRequestClose={() => setShowMemoriesModal(false)}
      >
        <View style={styles.overlay}>
          <LinearGradient
            colors={isDarkMode ? ['#1a0000', '#121212', '#0a0000'] : ['#ffe5e5', '#FAFAFA', '#fff5f5']}
            style={[styles.gridModal, { backgroundColor: 'transparent' }]}
          >
            <View style={[styles.gridHeader, { borderBottomColor: divider, backgroundColor: 'transparent' }]}>
              <TouchableOpacity onPress={() => setShowMemoriesModal(false)}>
                <Text style={[styles.cancelText, { color: textColor }]}>Close</Text>
              </TouchableOpacity>
              <Text style={[styles.title, { color: textColor }]}>Memories</Text>
              <View style={{ width: 64 }} />
            </View>
            <ScrollView contentContainerStyle={styles.groupsListContent}>
              {groups.length > 0 ? (
                groups.map((group) => {
                  const now = new Date();
                  const endTime = group.endTime instanceof Date ? group.endTime : (group.endTime ? new Date(group.endTime) : null);
                  const isExpired = endTime && endTime.getTime() <= now.getTime();
                  
                  return (
                    <TouchableOpacity
                      key={group.id}
                      style={[styles.groupItem, { backgroundColor: surface, borderColor: border }]}
                      onPress={() => {
                        setSelectedGroup(group);
                        setShowMemoriesModal(false);
                        setShowGroupPhotosModal(true);
                      }}
                    >
                      <View style={styles.groupItemContent}>
                        {group.profilePicture ? (
                          <Image source={{ uri: group.profilePicture }} style={styles.groupItemImage} />
                        ) : (
                          <View style={[styles.groupItemImagePlaceholder, { backgroundColor: border }]}>
                            <MaterialCommunityIcons name="account-group" size={32} color={subText} />
                          </View>
                        )}
                        <View style={styles.groupItemInfo}>
                          <Text style={[styles.groupItemName, { color: textColor }]} numberOfLines={1}>
                            {group.name || 'Unnamed Group'}
                          </Text>
                          {isExpired && (
                            <Text style={[styles.groupItemStatus, { color: subText }]}>Expired</Text>
                          )}
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={24} color={subText} />
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
                  <Text style={{ color: subText }}>No groups found</Text>
                </View>
              )}
            </ScrollView>
          </LinearGradient>
        </View>
      </Modal>

      {/* Group Photos Modal - Show Photos from Selected Group */}
      <Modal 
        visible={showGroupPhotosModal} 
        animationType="slide" 
        transparent 
        onRequestClose={() => {
          setShowGroupPhotosModal(false);
          setSelectedGroup(null);
          setSelectedGroupPhotos(new Set());
        }}
      >
        <View style={styles.overlay}>
          <LinearGradient
            colors={isDarkMode ? ['#1a0000', '#121212', '#0a0000'] : ['#ffe5e5', '#FAFAFA', '#fff5f5']}
            style={[styles.gridModal, { backgroundColor: 'transparent' }]}
          >
            <View style={[styles.gridHeader, { borderBottomColor: divider, backgroundColor: 'transparent' }]}>
              <TouchableOpacity onPress={() => {
                setShowGroupPhotosModal(false);
                setSelectedGroup(null);
                setSelectedGroupPhotos(new Set());
                setShowMemoriesModal(true);
              }}>
                <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
              </TouchableOpacity>
              <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
                {selectedGroup?.name || 'Group Photos'}
              </Text>
              <TouchableOpacity 
                onPress={() => {
                  // Add selected photos to images
                  const selectedPhotoUris = Array.from(selectedGroupPhotos)
                    .map(photoId => {
                      const photo = groupPhotos.find(p => p.id === photoId);
                      return photo?.uri;
                    })
                    .filter(uri => uri);
                  
                  if (selectedPhotoUris.length > 0) {
                    setImages((prev) => {
                      const newImages = [...prev, ...selectedPhotoUris];
                      // If we have images now, move to details step
                      if (prev.length === 0 && newImages.length > 0) {
                        setCurrentStep('details');
                      }
                      return newImages;
                    });
                  }
                  
                  setShowGroupPhotosModal(false);
                  setSelectedGroup(null);
                  setSelectedGroupPhotos(new Set());
                }}
                disabled={selectedGroupPhotos.size === 0}
              >
                <Text style={[
                  styles.doneText, 
                  { color: selectedGroupPhotos.size > 0 ? IU_CRIMSON : subText }
                ]}>
                  Done ({selectedGroupPhotos.size})
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.gridContent}>
              {groupPhotos.length > 0 ? (
                groupPhotos.map((photo) => {
                  const isSelected = selectedGroupPhotos.has(photo.id);
                  return (
                    <TouchableOpacity
                      key={photo.id}
                      style={[
                        styles.gridItem, 
                        { backgroundColor: surface },
                        isSelected && styles.gridItemSelected
                      ]}
                      onPress={() => {
                        setSelectedGroupPhotos((prev) => {
                          const newSet = new Set(prev);
                          if (newSet.has(photo.id)) {
                            newSet.delete(photo.id);
                          } else {
                            newSet.add(photo.id);
                          }
                          return newSet;
                        });
                      }}
                    >
                      <Image source={{ uri: photo.uri }} style={styles.gridImage} />
                      {isSelected && (
                        <View style={styles.gridItemCheckmark}>
                          <MaterialCommunityIcons name="check-circle" size={32} color={IU_CRIMSON} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
                  <Text style={{ color: subText }}>No photos in this group</Text>
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
  videoPreviewContainer: {
    marginTop: 12,
    marginBottom: 12,
  },
  videoPreview: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
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
  charCountContainer: {
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
    alignItems: 'flex-end',
  },
  charCount: {
    fontSize: 14,
  },
  mentionSuggestionsContainer: {
    marginTop: 8,
    marginBottom: 8,
    maxHeight: 200,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  mentionSuggestionsScroll: {
    maxHeight: 200,
  },
  mentionSuggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  mentionSuggestionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  mentionSuggestionName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  mentionSuggestionUsername: {
    fontSize: 13,
  },
  mentionLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  mentionLoadingText: {
    fontSize: 14,
  },
  mentionNoResultsContainer: {
    padding: 16,
    alignItems: 'center',
  },
  mentionNoResultsText: {
    fontSize: 14,
  },
  mediaSelectionContainer: {
    flex: 1,
    padding: 16,
  },
  mediaSelectionContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaSelectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  mediaSelectionSubtitle: {
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  selectedMediaPreview: {
    width: '100%',
    marginBottom: 32,
  },
  selectedMediaTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  mediaPreview: {
    marginBottom: 16,
    height: 200,
  },
  mediaPreviewContent: {
    flexDirection: 'row',
    paddingRight: 12,
  },
  mediaPreviewItem: {
    width: 200,
    height: 200,
    marginRight: 12,
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  mediaPreviewImage: {
    width: '100%',
    height: '100%',
  },
  removeMediaButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 24,
    gap: 8,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  mediaOptionsContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 16,
    paddingHorizontal: 16,
  },
  mediaOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 180,
  },
  mediaOptionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  mediaOptionDescription: {
    fontSize: 12,
    textAlign: 'center',
  },
  backButton: {
    width: 64,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  groupsListContent: {
    padding: 16,
  },
  groupItem: {
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  groupItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  groupItemImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
  },
  groupItemImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupItemInfo: {
    flex: 1,
  },
  groupItemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  groupItemStatus: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  gridItemSelected: {
    borderWidth: 3,
    borderColor: IU_CRIMSON,
  },
  gridItemCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

