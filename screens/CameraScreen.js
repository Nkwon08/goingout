import * as React from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Dimensions, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from 'react-native-paper';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import MediaPreview from '../components/MediaPreview';
import ComposePost from '../components/ComposePost';
import { useAuth } from '../context/AuthContext';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uploadImages } from '../services/storageService';
import { createPost } from '../services/postsService';
import { subscribeToUserGroups } from '../services/groupsService';
import { sendImageMessage, sendVideoMessage } from '../services/groupChatService';

const IU_CRIMSON = '#CC0000';

export default function CameraScreen() {
  const [facing, setFacing] = React.useState('back');
  const [mode, setMode] = React.useState('photo'); // 'photo' or 'video'
  const [flash, setFlash] = React.useState('off'); // 'off', 'on', or 'auto'
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingPromise, setRecordingPromise] = React.useState(null);
  const [cameraReady, setCameraReady] = React.useState(false);
  const [previewVisible, setPreviewVisible] = React.useState(false);
  const [capturedMedia, setCapturedMedia] = React.useState(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions?.() || [null, null];
  const cameraRef = React.useRef(null);
  const cameraReadyRef = React.useRef(false);
  const [composeVisible, setComposeVisible] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [groups, setGroups] = React.useState([]);
  const lastTap = React.useRef(null); // For double tap detection
  const lastTapTimeout = React.useRef(null);
  const { user, userData } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const [selectedGroupId, setSelectedGroupId] = React.useState(null);
  const insets = useSafeAreaInsets();

  // Request microphone permission for video recording
  React.useEffect(() => {
    if (!micPermission?.granted && typeof requestMicPermission === 'function') {
      requestMicPermission();
    }
  }, [micPermission, requestMicPermission]);

  // Reset camera ready when mode changes - MUST be before any returns
  React.useEffect(() => {
    setCameraReady(false);
    cameraReadyRef.current = false;
  }, [mode]);

  // Reset ready state when camera facing changes - MUST be before any returns
  React.useEffect(() => {
    setCameraReady(false);
    cameraReadyRef.current = false;
  }, [facing]);

  // Keep ref in sync with state
  React.useEffect(() => {
    cameraReadyRef.current = cameraReady;
  }, [cameraReady]);

  // Subscribe to user groups
  React.useEffect(() => {
    if (!user?.uid) {
      setGroups([]);
      return;
    }

    const unsubscribe = subscribeToUserGroups(user.uid, ({ groups: userGroups, error }) => {
      if (error) {
        console.error('Error loading groups:', error);
      } else {
        // Filter out expired groups - only show active groups in camera
        const now = new Date();
        const activeGroups = (userGroups || []).filter((group) => {
          if (!group.endTime) return true; // Groups without endTime are considered active
          const endTime = group.endTime instanceof Date ? group.endTime : new Date(group.endTime);
          return endTime.getTime() > now.getTime();
        });
        setGroups(activeGroups);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid]);

  // Read route parameter for groupId and set selectedGroupId
  React.useEffect(() => {
    const groupId = route.params?.groupId;
    if (groupId) {
      setSelectedGroupId(groupId);
    } else {
      // Reset selectedGroupId when navigating away or when no groupId in params
      setSelectedGroupId(null);
    }
  }, [route.params]);

  // Fallback: Auto-set camera ready after 8 seconds if callback doesn't fire
  // This is a safety net - ideally onCameraReady should fire
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (!cameraReady) {
        console.warn('Fallback: Setting camera ready (onCameraReady callback did not fire)');
        setCameraReady(true);
        cameraReadyRef.current = true;
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [mode, facing, cameraReady]);
  
  // Additional delay for video mode - ensure camera is fully initialized before allowing recording
  const [videoReady, setVideoReady] = React.useState(true); // Start as true for photo mode
  React.useEffect(() => {
    if (mode === 'video') {
      setVideoReady(false);
      const timer = setTimeout(() => {
        if (cameraReadyRef.current) {
          setVideoReady(true);
          console.log('Video mode ready');
        } else {
          // If camera isn't ready after 2 seconds, set videoReady to true anyway (camera ready will be handled separately)
          setVideoReady(true);
        }
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setVideoReady(true);
    }
  }, [mode, cameraReady]);

  if (!permission) {
    // Still loading permission status
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Checking camera permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.button}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const toggleCameraFacing = () => {
    setCameraReady(false); // Reset ready state when switching camera
    cameraReadyRef.current = false;
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash((current) => {
      if (current === 'off') return 'on';
      if (current === 'on') return 'auto';
      return 'off';
    });
  };

  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mode === 'photo' 
          ? ImagePicker.MediaTypeOptions.Images 
          : ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (mode === 'photo') {
          setCapturedMedia({ type: 'photo', uri: asset.uri });
        } else {
          setCapturedMedia({ type: 'video', uri: asset.uri });
        }
        setPreviewVisible(true);
      }
    } catch (error) {
      console.error('Error picking from gallery:', error);
      Alert.alert('Error', 'Failed to pick from gallery. Please try again.');
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current) {
      Alert.alert('Error', 'Camera is not ready. Please wait a moment.');
      return;
    }

    if (mode !== 'photo') {
      return;
    }

    try {
      console.log('Taking picture...');
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });
      
      if (photo && photo.uri) {
        console.log('Picture taken successfully:', photo.uri);
        
        // Auto crop to 3:4 aspect ratio (portrait orientation - height:width = 4:3)
        let finalUri = photo.uri;
        if (photo.width && photo.height) {
          try {
            // Calculate 3:4 crop region (center crop)
            // height:width = 4:3, so width:height = 3:4
            const aspectRatio = 3 / 4;
            let cropWidth, cropHeight, originX, originY;
            
            // Determine if we need to crop width or height
            const photoAspectRatio = photo.width / photo.height;
            
            if (photoAspectRatio > aspectRatio) {
              // Photo is wider than 3:4, crop width
              cropHeight = photo.height;
              cropWidth = cropHeight * aspectRatio;
              originX = (photo.width - cropWidth) / 2;
              originY = 0;
            } else {
              // Photo is taller than 3:4, crop height
              cropWidth = photo.width;
              cropHeight = cropWidth / aspectRatio;
              originX = 0;
              originY = (photo.height - cropHeight) / 2;
            }
            
            const manipulatedImage = await ImageManipulator.manipulateAsync(
              photo.uri,
              [
                {
                  crop: {
                    originX,
                    originY,
                    width: cropWidth,
                    height: cropHeight,
                  },
                },
                // Flip horizontally if using front camera (to correct mirroring)
                ...(facing === 'front' ? [{ flip: ImageManipulator.FlipType.Horizontal }] : []),
              ],
              {
                compress: 0.8,
                format: ImageManipulator.SaveFormat.JPEG,
              }
            );
            
            finalUri = manipulatedImage.uri;
            console.log('Image cropped to 3:4:', finalUri);
          } catch (cropError) {
            console.error('Error cropping image to 3:4:', cropError);
            // If cropping fails, still flip front-facing camera photos
            if (facing === 'front') {
              try {
                const flippedImage = await ImageManipulator.manipulateAsync(
                  photo.uri,
                  [{ flip: ImageManipulator.FlipType.Horizontal }],
                  {
                    compress: 0.8,
                    format: ImageManipulator.SaveFormat.JPEG,
                  }
                );
                finalUri = flippedImage.uri;
                console.log('Image flipped (front camera):', finalUri);
              } catch (flipError) {
                console.error('Error flipping image:', flipError);
                // Use original image if flipping fails
                finalUri = photo.uri;
              }
            } else {
              // Use original image if cropping fails
              finalUri = photo.uri;
            }
          }
        } else {
          // If photo dimensions are not available, still flip front-facing camera photos
          if (facing === 'front') {
            try {
              const flippedImage = await ImageManipulator.manipulateAsync(
                photo.uri,
                [{ flip: ImageManipulator.FlipType.Horizontal }],
                {
                  compress: 0.8,
                  format: ImageManipulator.SaveFormat.JPEG,
                }
              );
              finalUri = flippedImage.uri;
              console.log('Image flipped (front camera, no dimensions):', finalUri);
            } catch (flipError) {
              console.error('Error flipping image:', flipError);
              // Use original image if flipping fails
              finalUri = photo.uri;
            }
          }
        }
        
        setCapturedMedia({ type: 'photo', uri: finalUri });
        setPreviewVisible(true);
      } else {
        console.error('No photo data received');
        Alert.alert('Error', 'No photo data received. Please try again.');
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      Alert.alert('Error', `Failed to take picture: ${errorMessage}`);
    }
  };

  const handlePressIn = async () => {
    if (mode !== 'video') {
      return;
    }

    if (!cameraRef.current) {
      Alert.alert('Error', 'Camera is not ready.');
      return;
    }

    if (isRecording) {
      return;
    }

    // Wait for camera to actually be ready - poll until onCameraReady has fired
    console.log('Starting video recording...');
    console.log('Current camera ready state:', cameraReady, 'ref:', cameraReadyRef.current);
    
    // Wait for cameraReadyRef.current to be true (meaning onCameraReady callback has fired)
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds total
    while (!cameraReadyRef.current && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
      console.log(`Waiting for camera ready... attempt ${attempts}/${maxAttempts}, ref.current: ${cameraReadyRef.current}`);
    }

    // Additional wait for video mode to initialize
    if (!videoReady) {
      console.log('Waiting for video mode to initialize...');
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!cameraRef.current) {
      console.error('Camera ref lost');
      Alert.alert('Error', 'Camera is not available.');
      return;
    }

    // Final check - ensure camera is truly ready
    if (!cameraReadyRef.current) {
      console.error('Camera is not ready after waiting');
      Alert.alert('Please wait', 'Camera is still initializing. Please wait a moment and try again.');
      return;
    }

    try {
      // Set recording state first
      setIsRecording(true);
      
      // Wait a bit more to ensure everything is stable
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (!cameraRef.current) {
        console.error('Camera ref lost before recording');
        setIsRecording(false);
        return;
      }
      
      console.log('Calling startRecording...');
      
      // expo-camera v17+ uses startRecording() with callbacks (not promise-based)
      // Set up callbacks before starting recording
      cameraRef.current.startRecording({
        maxDuration: 60,
        onRecordingFinished: (video) => {
          console.log('Recording finished:', video);
          setIsRecording(false);
          setRecordingPromise(null);
          if (video && video.uri) {
            setCapturedMedia({ type: 'video', uri: video.uri });
            setPreviewVisible(true);
          } else {
            console.error('No video data received');
            Alert.alert('Error', 'No video data received.');
          }
        },
        onRecordingError: (error) => {
          console.error('Recording error:', error);
          setIsRecording(false);
          setRecordingPromise(null);
          const errorMessage = error?.message || error?.toString() || 'Unknown error';
          Alert.alert('Error', `Failed to record video: ${errorMessage}`);
        },
      });
      
      console.log('Recording started');
      // Store a dummy promise reference for state tracking
      setRecordingPromise(Promise.resolve());
    } catch (error) {
      setIsRecording(false);
      setRecordingPromise(null);
      console.error('Start recording error:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      Alert.alert('Error', `Failed to start recording: ${errorMessage}`);
    }
  };

  const handlePressOut = async () => {
    if (mode !== 'video') {
      return;
    }

    if (!cameraRef.current || !isRecording) {
      return;
    }

    try {
      console.log('Stopping video recording...');
      // expo-camera v17+ uses stopRecording() to stop recording
      cameraRef.current.stopRecording();
      // Note: The actual stop and video data will be handled by onRecordingFinished callback
    } catch (error) {
      console.error('Stop recording error:', error);
      // If stopRecording fails, manually resolve the state
      setIsRecording(false);
      setRecordingPromise(null);
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      Alert.alert('Error', `Failed to stop recording: ${errorMessage}`);
    }
  };

  const handleCameraReady = () => {
    console.log('Camera is ready - onCameraReady callback fired');
    setCameraReady(true);
    cameraReadyRef.current = true;
  };

  const handleDeleteMedia = () => {
    setCapturedMedia(null);
    setPreviewVisible(false);
  };

  const handleAddToGroup = async (group) => {
    if (!capturedMedia || !group) {
      Alert.alert('Error', 'Please select a group to add the media to.');
      return;
    }

    if (!user?.uid || !userData) {
      Alert.alert('Error', 'Please sign in to add media to a group.');
      return;
    }

    try {
      setSubmitting(true);
      
      if (capturedMedia.type === 'video') {
        const { messageId, error } = await sendVideoMessage(
          group.id,
          user.uid,
          capturedMedia.uri,
          '',
          userData
        );
        
        if (error) {
          Alert.alert('Error', error);
        } else {
          setCapturedMedia(null);
          setPreviewVisible(false);
          
          // If camera was accessed through a group, navigate back to that group
          if (selectedGroupId && selectedGroupId === group.id) {
            // Store groupId in AsyncStorage for GroupsScreen to pick up
            AsyncStorage.setItem('pendingGroupId', group.id);
            // Navigate to Groups tab
            navigation.navigate('Groups');
          }
        }
      } else {
        const { messageId, error } = await sendImageMessage(
          group.id,
          user.uid,
          capturedMedia.uri,
          '',
          userData
        );
        
        if (error) {
          Alert.alert('Error', error);
        } else {
          setCapturedMedia(null);
          setPreviewVisible(false);
          
          // If camera was accessed through a group, navigate back to that group
          if (selectedGroupId && selectedGroupId === group.id) {
            // Store groupId in AsyncStorage for GroupsScreen to pick up
            AsyncStorage.setItem('pendingGroupId', group.id);
            // Navigate to Groups tab
            navigation.navigate('Groups');
          }
        }
      }
    } catch (error) {
      console.error('Error adding media to group:', error);
      Alert.alert('Error', error.message || 'Failed to add media to group. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelPreview = () => {
    setCapturedMedia(null);
    setPreviewVisible(false);
  };

  const handlePostPublicly = () => {
    if (!capturedMedia) {
      Alert.alert('Error', 'No media to post.');
      return;
    }
    setPreviewVisible(false);
    setComposeVisible(true);
  };

  const handlePostSubmit = async (postData) => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to create a post');
      return;
    }

    // Prepare post data
    if (!postData.location || !postData.location.trim()) {
      Alert.alert('Error', 'Location is required for all posts');
      return;
    }

    const currentUserData = userData || {
      name: user.displayName || user.email || 'User',
      username: user.email?.split('@')[0] || 'user',
      avatar: user.photoURL || null,
    };

    // Get local image URIs (before upload)
    let localImageUrls = postData.images && Array.isArray(postData.images) && postData.images.length > 0 
      ? postData.images 
      : postData.image 
        ? [postData.image] 
        : [];

    // Check if we have local images to upload
    const hasLocalImages = localImageUrls.length > 0 && localImageUrls[0]?.startsWith('file://');

    // Create post immediately with uploading status and local URIs
    const postPayload = {
      text: postData.text || '',
      location: postData.location.trim(),
      image: localImageUrls.length > 0 ? localImageUrls[0] : null,
      images: localImageUrls.length > 0 ? localImageUrls : null,
      visibility: postData.visibility || 'location',
      bar: postData.bar || null,
      uploadStatus: hasLocalImages ? 'uploading' : 'completed', // Mark as uploading if we have local images
    };

    setSubmitting(true);

    try {
      // Create post immediately (with local URIs and uploading status)
      const result = await createPost(user.uid, currentUserData, postPayload);
      
      if (result.error) {
        throw new Error(result.error);
      }

      // Close modal and reset
      setComposeVisible(false);
      setCapturedMedia(null);
      setSubmitting(false);

      // Navigate to Feed immediately
      let rootNavigator = navigation.getParent();
      while (rootNavigator && rootNavigator.getParent) {
        const parent = rootNavigator.getParent();
        if (!parent) break;
        rootNavigator = parent;
      }
      
      // Close the modal by going back
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
      
      // Navigate to Feed tab immediately
      setTimeout(() => {
        if (rootNavigator) {
          rootNavigator.navigate('MainTabs', {
            screen: 'Feed',
          });
        }
      }, 100);

      // Continue upload in background and update post when done
      if (hasLocalImages && result.postId) {
        (async () => {
          try {
            const uploadResult = await uploadImages(localImageUrls, user.uid, 'posts');
            
            if (uploadResult.errors && uploadResult.errors.length > 0) {
              // Update post with error status
              const { updateDoc, doc } = await import('firebase/firestore');
              const { db } = await import('../config/firebase');
              await updateDoc(doc(db, 'posts', result.postId), {
                uploadStatus: 'error',
                uploadError: uploadResult.errors.join(', '),
              });
              return;
            }

            const uploadedUrls = uploadResult.urls || [];
            
            // Update post with uploaded URLs and completed status
            const { updateDoc, doc } = await import('firebase/firestore');
            const { db } = await import('../config/firebase');
            await updateDoc(doc(db, 'posts', result.postId), {
              image: uploadedUrls.length > 0 ? uploadedUrls[0] : null,
              images: uploadedUrls.length > 0 ? uploadedUrls : null,
              uploadStatus: 'completed',
            });
          } catch (uploadError) {
            console.error('Error uploading images:', uploadError);
            // Update post with error status
            try {
              const { updateDoc, doc } = await import('firebase/firestore');
              const { db } = await import('../config/firebase');
              await updateDoc(doc(db, 'posts', result.postId), {
                uploadStatus: 'error',
                uploadError: uploadError.message || 'Upload failed',
              });
            } catch (updateError) {
              console.error('Error updating post status:', updateError);
            }
          }
        })();
      }
      
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', error.message || 'Failed to create post. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          mode={mode === 'photo' ? 'picture' : 'video'}
          flash={flash}
          onCameraReady={handleCameraReady}
        >
        {/* Mode Toggle */}
        <View style={[styles.safeArea, { paddingTop: insets.top + 20 }]}>
          <View style={styles.modeContainer}>
            {/* Back button */}
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => {
                // Navigate back to Feed
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  // If can't go back, navigate to MainTabs -> Feed
                  let rootNavigator = navigation;
                  let parent = navigation.getParent();
                  while (parent) {
                    rootNavigator = parent;
                    parent = parent.getParent();
                  }
                  rootNavigator.navigate('MainTabs', { screen: 'Feed' });
                }
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modeButton, mode === 'photo' && styles.modeButtonActive]}
              onPress={() => setMode('photo')}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="camera" size={24} color={mode === 'photo' ? '#FFFFFF' : '#8A90A6'} />
              <Text style={[styles.modeText, mode === 'photo' && styles.modeTextActive, { marginLeft: 8 }]}>Photo</Text>
            </TouchableOpacity>
            <View style={{ width: 20 }} />
            <TouchableOpacity
              style={[styles.modeButton, mode === 'video' && styles.modeButtonActive]}
              onPress={() => setMode('video')}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="video" size={24} color={mode === 'video' ? '#FFFFFF' : '#8A90A6'} />
              <Text style={[styles.modeText, mode === 'video' && styles.modeTextActive, { marginLeft: 8 }]}>Video</Text>
            </TouchableOpacity>
            
            {/* Flash toggle button - aligned with mode toggles */}
            <View style={styles.flashButtonContainer}>
              <TouchableOpacity style={styles.flashButton} onPress={toggleFlash}>
                <MaterialCommunityIcons 
                  name={flash === 'on' ? 'flash' : flash === 'auto' ? 'flash-auto' : 'flash-off'} 
                  size={24} 
                  color={flash === 'off' ? '#8A90A6' : '#FFFFFF'} 
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 3:4 aspect ratio viewfinder overlay (only in photo mode) */}
        {mode === 'photo' && (
          <Pressable 
            style={styles.viewfinderOverlay} 
            onPress={() => {
              console.log('Viewfinder tapped');
              // Double tap detection
              const now = Date.now();
              const DOUBLE_PRESS_DELAY = 300;
              
              if (lastTap.current && now - lastTap.current < DOUBLE_PRESS_DELAY) {
                // Clear the timeout if it exists
                if (lastTapTimeout.current) {
                  clearTimeout(lastTapTimeout.current);
                  lastTapTimeout.current = null;
                }
                // Double tap detected
                console.log('Double tap detected - flipping camera');
                toggleCameraFacing();
                lastTap.current = null;
              } else {
                // First tap - wait for potential second tap
                console.log('First tap registered');
                lastTap.current = now;
                lastTapTimeout.current = setTimeout(() => {
                  console.log('Single tap timeout - no double tap');
                  lastTap.current = null;
                }, DOUBLE_PRESS_DELAY);
              }
            }}
          >
            {/* Top dark area */}
            <View style={styles.darkArea} pointerEvents="none" />
            {/* 3:4 viewfinder */}
            <View style={styles.viewfinder} pointerEvents="none" />
            {/* Bottom dark area */}
            <View style={styles.darkArea} pointerEvents="none" />
          </Pressable>
        )}

        <View style={styles.buttonContainer}>
          {/* Flip button */}
          <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
            <MaterialCommunityIcons name="camera-flip" size={32} color="#FFFFFF" />
          </TouchableOpacity>
          
          {/* Shutter button centered - aligned with camera tab icon */}
          {mode === 'photo' ? (
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.captureButton,
                isRecording && styles.recordingButton,
                (mode === 'video' && (!videoReady || !cameraReady)) && styles.disabledButton
              ]}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              activeOpacity={1}
              disabled={(mode === 'video' && (!videoReady || !cameraReady)) || isRecording}
            >
              {isRecording ? (
                <View style={styles.recordingIndicator} />
              ) : (
                <View style={[styles.captureButtonInner, styles.videoButtonInner]} />
              )}
            </TouchableOpacity>
          )}
          
          {/* Gallery button - bottom right */}
          <TouchableOpacity style={styles.galleryButton} onPress={handlePickFromGallery}>
            <MaterialCommunityIcons name="view-grid" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </CameraView>


      <MediaPreview
        visible={previewVisible}
        media={capturedMedia}
        groups={groups}
        initialSelectedGroup={selectedGroupId ? groups.find(g => g.id === selectedGroupId) : null}
        onDelete={handleDeleteMedia}
        onAddToGroup={handleAddToGroup}
        onPostPublicly={handlePostPublicly}
        onCancel={handleCancelPreview}
        navigation={navigation}
      />

      {/* Compose Post Modal */}
      <ComposePost
        visible={composeVisible}
        onClose={() => {
          setComposeVisible(false);
          setCapturedMedia(null);
        }}
        onSubmit={handlePostSubmit}
        currentUser={{
          ...(userData || { 
            name: user?.displayName || user?.email || 'User', 
            username: user?.email?.split('@')[0] || 'user'
          }),
          uid: user?.uid
        }}
        submitting={submitting}
        initialImages={capturedMedia?.type === 'photo' ? [capturedMedia.uri] : []}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  safeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  modeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 10,
    paddingHorizontal: 16,
    position: 'relative',
    minHeight: 64,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    left: 16,
    top: 10,
    bottom: 10,
  },
  flashButtonContainer: {
    position: 'absolute',
    right: 16,
    top: 10,
    bottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flashButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    minHeight: 44,
    minWidth: 100,
  },
  modeButtonActive: {
    backgroundColor: IU_CRIMSON,
  },
  modeText: {
    color: '#8A90A6',
    fontSize: 14,
    fontWeight: '600',
  },
  modeTextActive: {
    color: '#FFFFFF',
  },
  buttonContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    margin: 20,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingBottom: 80, // Position above bottom tab bar
    paddingHorizontal: 0,
    position: 'relative',
  },
  flipButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 20,
    marginBottom: 0, // Align with shutter button
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
    borderWidth: 5,
    borderColor: IU_CRIMSON,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    left: '50%',
    bottom: 75, // Position above bottom tab bar
    transform: [{ translateX: -35 }], // Half of width (70/2) to center perfectly
  },
  captureButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: IU_CRIMSON,
  },
  videoButtonInner: {
    borderRadius: 12,
  },
  recordingButton: {
    borderColor: '#FF0000',
    backgroundColor: '#FF0000',
  },
  recordingIndicator: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.5,
  },
  viewfinderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'column',
  },
  darkArea: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flex: 1,
    width: '100%',
  },
  viewfinder: {
    width: Dimensions.get('window').width,
    aspectRatio: 3 / 4, // 3:4 aspect ratio (portrait - height:width = 4:3)
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5,
  },
  message: {
    color: '#E6E8F0',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: IU_CRIMSON,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

