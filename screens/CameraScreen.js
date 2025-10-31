import * as React from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from 'react-native-paper';
import { useGroupPhotos } from '../context/GroupPhotosContext';
import MediaPreview from '../components/MediaPreview';
import { groups } from '../data/mock';

const IU_CRIMSON = '#990000';

export default function CameraScreen() {
  const [facing, setFacing] = React.useState('back');
  const [mode, setMode] = React.useState('photo'); // 'photo' or 'video'
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingPromise, setRecordingPromise] = React.useState(null);
  const [cameraReady, setCameraReady] = React.useState(false);
  const [previewVisible, setPreviewVisible] = React.useState(false);
  const [capturedMedia, setCapturedMedia] = React.useState(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions?.() || [null, null];
  const { addPhoto, addVideo } = useGroupPhotos();
  const cameraRef = React.useRef(null);
  const cameraReadyRef = React.useRef(false);

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
    return <View style={styles.container} />;
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

  const takePicture = async () => {
    if (cameraRef.current && mode === 'photo') {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
        });
        if (photo) {
          setCapturedMedia({ type: 'photo', uri: photo.uri });
          setPreviewVisible(true);
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to take picture. Please try again.');
      }
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
      
      console.log('Calling recordAsync...');
      
      // Start recording - this returns a promise that resolves when recording stops
      const promise = cameraRef.current.recordAsync({
        maxDuration: 60,
      });
      
      if (!promise) {
        console.error('recordAsync returned null');
        setIsRecording(false);
        Alert.alert('Error', 'Failed to start recording.');
        return;
      }
      
      console.log('Recording promise created');
      setRecordingPromise(promise);
      
      // Handle the promise when recording completes
      promise
        .then((video) => {
          console.log('Recording completed:', video);
          setIsRecording(false);
          setRecordingPromise(null);
          if (video && video.uri) {
            setCapturedMedia({ type: 'video', uri: video.uri });
            setPreviewVisible(true);
          } else {
            console.error('No video data:', video);
            Alert.alert('Error', 'No video data received.');
          }
        })
        .catch((error) => {
          setIsRecording(false);
          setRecordingPromise(null);
          console.error('Recording promise error:', error);
          const errorMessage = error?.message || error?.toString() || 'Unknown error';
          Alert.alert('Error', `Failed to record video: ${errorMessage}`);
        });
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
      // Stop recording - this will cause the promise to resolve
      cameraRef.current.stopRecording();
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

  const handleAddToGroup = (group) => {
    if (!capturedMedia || !group) {
      Alert.alert('Error', 'Please select a group to add the media to.');
      return;
    }

    if (capturedMedia.type === 'video') {
      addVideo(capturedMedia.uri);
    } else {
      addPhoto(capturedMedia.uri);
    }

    Alert.alert('Saved!', `Media has been added to ${group.name}.`);
    setCapturedMedia(null);
    setPreviewVisible(false);
  };

  const handleCancelPreview = () => {
    setCapturedMedia(null);
    setPreviewVisible(false);
  };

  // Get camera type - handle both Constants and direct string values
  const getCameraType = () => {
    if (Camera?.Constants?.Type) {
      return facing === 'back' ? Camera.Constants.Type.back : Camera.Constants.Type.front;
    }
    // Fallback to string if Constants don't exist
    return facing;
  };

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={styles.camera}
        type={getCameraType()}
        ratio="16:9"
        onCameraReady={handleCameraReady}
        video={true}
      >
        {/* Mode Toggle */}
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.modeContainer}>
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
          </View>
        </SafeAreaView>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
            <MaterialCommunityIcons name="camera-flip" size={32} color="#FFFFFF" />
          </TouchableOpacity>
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
        </View>
      </Camera>


      <MediaPreview
        visible={previewVisible}
        media={capturedMedia}
        groups={groups}
        onDelete={handleDeleteMedia}
        onAddToGroup={handleAddToGroup}
        onCancel={handleCancelPreview}
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
    paddingTop: 10,
    paddingBottom: 10,
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
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingBottom: 40,
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
    marginHorizontal: 40,
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
  flipButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
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

