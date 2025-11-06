import * as React from 'react';
import { View, ScrollView, Image, TouchableOpacity, Modal, TouchableWithoutFeedback, ActivityIndicator, Alert, TextInput, Keyboard, KeyboardAvoidingView, Platform, PanResponder, Animated, StyleSheet, Dimensions, Pressable } from 'react-native';
import { Appbar, FAB, Text, Button, Avatar, Checkbox } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useNavigation } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';
import { GiftedChat } from 'react-native-gifted-chat';
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'expo-av';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImageManipulator from 'expo-image-manipulator';
import GroupCard from '../components/GroupCard';
import PollCard from '../components/PollCard';
import { useThemeColors } from '../hooks/useThemeColors';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { subscribeToUserGroups, deleteGroup, addMemberToGroup } from '../services/groupsService';
import { shareLocationInGroup, stopSharingLocationInGroup, subscribeToGroupLocations } from '../services/groupLocationService';
import { getCurrentLocation } from '../services/locationService';
import { createGroupPoll, voteOnGroupPoll, subscribeToGroupPolls } from '../services/groupPollsService';
import { subscribeToGroupPhotos, addPhotoToAlbum, addVideoToAlbum } from '../services/groupPhotosService';
import { uploadImage } from '../services/storageService';
import { getUserById } from '../services/usersService';

const TopTab = createMaterialTopTabNavigator();

const IU_CRIMSON = '#990000';

function MapTab({ groupId }) {
  const { background, subText, text } = useThemeColors();
  const { user, userData } = useAuth();
  const [locations, setLocations] = React.useState([]);
  const [myLocation, setMyLocation] = React.useState(null);
  const [sharingLocation, setSharingLocation] = React.useState(false);
  const [updatingLocation, setUpdatingLocation] = React.useState(false);
  const [mapRegion, setMapRegion] = React.useState(null);
  const locationWatchSubscription = React.useRef(null);
  const myLocationWatchSubscription = React.useRef(null);
  
  // Default region (San Francisco)
  const defaultRegion = { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.05, longitudeDelta: 0.05 };
  
  // Get user's current location for display (even if not sharing)
  React.useEffect(() => {
    if (!user?.uid) {
      setMyLocation(null);
      return;
    }

    let isMounted = true;

    const getMyLocation = async () => {
      try {
        const locationData = await getCurrentLocation();
        if (locationData.error || !locationData.lat || !locationData.lng) {
          console.log('Could not get user location:', locationData.error);
          if (isMounted) {
            setMyLocation(null);
          }
          return;
        }

        if (isMounted) {
          setMyLocation({
            lat: locationData.lat,
            lng: locationData.lng,
          });

          // Watch location changes for display
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted' && isMounted) {
            myLocationWatchSubscription.current = await Location.watchPositionAsync(
              {
                accuracy: Location.Accuracy.Balanced,
                timeInterval: 60000, // Update every minute
                distanceInterval: 100, // Update if moved 100 meters
              },
              (location) => {
                if (isMounted) {
                  setMyLocation({
                    lat: location.coords.latitude,
                    lng: location.coords.longitude,
                  });
                }
              }
            );
          }
        }
      } catch (error) {
        console.error('Error getting user location:', error);
        if (isMounted) {
          setMyLocation(null);
        }
      }
    };

    getMyLocation();

    return () => {
      isMounted = false;
      if (myLocationWatchSubscription.current) {
        myLocationWatchSubscription.current.remove();
        myLocationWatchSubscription.current = null;
      }
    };
  }, [user?.uid]);
  
  // Subscribe to group locations
  React.useEffect(() => {
    if (!groupId) {
      setLocations([]);
      return;
    }

    const unsubscribe = subscribeToGroupLocations(groupId, ({ locations: newLocations, error }) => {
      if (error) {
        console.error('Error loading locations:', error);
        return;
      }
      setLocations(newLocations || []);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [groupId]);
  
  // Check if user is currently sharing location
  React.useEffect(() => {
    if (!groupId || !user?.uid || !locations.length) {
      setSharingLocation(false);
      return;
    }
    
    const userLocation = locations.find(loc => loc.userId === user.uid);
    setSharingLocation(!!userLocation);
  }, [groupId, user?.uid, locations]);
  
  // Start/stop location sharing
  const toggleLocationSharing = React.useCallback(async () => {
    if (!groupId || !user?.uid || !userData || updatingLocation) return;
    
    if (sharingLocation) {
      // Stop sharing
      setUpdatingLocation(true);
      try {
        const { error } = await stopSharingLocationInGroup(groupId, user.uid);
        if (error) {
          Alert.alert('Error', error);
        } else {
          setSharingLocation(false);
          // Stop watching location
          if (locationWatchSubscription.current) {
            locationWatchSubscription.current.remove();
            locationWatchSubscription.current = null;
          }
        }
      } catch (error) {
        console.error('Error stopping location sharing:', error);
        Alert.alert('Error', 'Failed to stop sharing location');
      } finally {
        setUpdatingLocation(false);
      }
    } else {
      // Start sharing
      setUpdatingLocation(true);
      try {
        // Request location permission and get current location
        const locationData = await getCurrentLocation();
        if (locationData.error || !locationData.lat || !locationData.lng) {
          Alert.alert('Location Required', locationData.error || 'Unable to get your location. Please enable location permissions.');
          setUpdatingLocation(false);
          return;
        }
        
        // Start sharing location
        const { error } = await shareLocationInGroup(groupId, user.uid, locationData.lat, locationData.lng, userData);
        if (error) {
          Alert.alert('Error', error);
        } else {
          setSharingLocation(true);
          
          // Watch location changes and update periodically
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            locationWatchSubscription.current = await Location.watchPositionAsync(
              {
                accuracy: Location.Accuracy.High,
                timeInterval: 30000, // Update every 30 seconds
                distanceInterval: 50, // Update if moved 50 meters
              },
              async (location) => {
                const { latitude, longitude } = location.coords;
                await shareLocationInGroup(groupId, user.uid, latitude, longitude, userData);
              }
            );
          }
        }
      } catch (error) {
        console.error('Error starting location sharing:', error);
        Alert.alert('Error', 'Failed to start sharing location');
      } finally {
        setUpdatingLocation(false);
      }
    }
  }, [groupId, user?.uid, userData, sharingLocation, updatingLocation]);
  
  // Update map region to show all locations (including user's location)
  React.useEffect(() => {
    const allLats = [];
    const allLngs = [];
    
    // Add shared locations
    locations.forEach(loc => {
      if (loc.lat != null && loc.lng != null) {
        allLats.push(loc.lat);
        allLngs.push(loc.lng);
      }
    });
    
    // Add user's own location (even if not sharing)
    if (myLocation && myLocation.lat != null && myLocation.lng != null) {
      allLats.push(myLocation.lat);
      allLngs.push(myLocation.lng);
    }
    
    if (allLats.length > 0 && allLngs.length > 0) {
      const minLat = Math.min(...allLats);
      const maxLat = Math.max(...allLats);
      const minLng = Math.min(...allLngs);
      const maxLng = Math.max(...allLngs);
      
      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;
      const latDelta = Math.max(maxLat - minLat, 0.01) * 1.5;
      const lngDelta = Math.max(maxLng - minLng, 0.01) * 1.5;
      
      setMapRegion({
        latitude: centerLat,
        longitude: centerLng,
        latitudeDelta: latDelta,
        longitudeDelta: lngDelta,
      });
    } else if (myLocation && myLocation.lat != null && myLocation.lng != null) {
      // If only user's location, center on it
      setMapRegion({
        latitude: myLocation.lat,
        longitude: myLocation.lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    }
  }, [locations, myLocation]);
  
  // Cleanup location watch on unmount
  React.useEffect(() => {
    return () => {
      if (locationWatchSubscription.current) {
        locationWatchSubscription.current.remove();
        locationWatchSubscription.current = null;
      }
      if (myLocationWatchSubscription.current) {
        myLocationWatchSubscription.current.remove();
        myLocationWatchSubscription.current = null;
      }
    };
  }, []);
  
  const currentRegion = mapRegion || defaultRegion;
  
  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      <MapView 
        style={{ flex: 1 }} 
        initialRegion={currentRegion}
        region={currentRegion}
      >
        {/* Show user's own location */}
        {myLocation && myLocation.lat != null && myLocation.lng != null && (
          <Marker
            key="my-location"
            coordinate={{ latitude: myLocation.lat, longitude: myLocation.lng }}
            title="You"
          >
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              {userData?.photoURL || userData?.avatar ? (
                <Image
                  source={{ uri: userData.photoURL || userData.avatar }}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    borderWidth: 3,
                    borderColor: '#007AFF',
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: '#007AFF',
                    borderWidth: 3,
                    borderColor: '#FFFFFF',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>
                    {userData?.name?.charAt(0).toUpperCase() || 'Y'}
                  </Text>
                </View>
              )}
              <View
                style={{
                  width: 0,
                  height: 0,
                  borderLeftWidth: 7,
                  borderRightWidth: 7,
                  borderTopWidth: 10,
                  borderLeftColor: 'transparent',
                  borderRightColor: 'transparent',
                  borderTopColor: '#007AFF',
                  marginTop: -2,
                }}
              />
            </View>
          </Marker>
        )}
        
        {/* Show other members' shared locations */}
        {locations.map((location) => {
          // Skip if this is the user's shared location (already shown above)
          if (location.userId === user?.uid) return null;
          
          return (
            <Marker
              key={location.userId}
              coordinate={{ latitude: location.lat, longitude: location.lng }}
              title={location.userName}
            >
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                {location.userAvatar ? (
                  <Image
                    source={{ uri: location.userAvatar }}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      borderWidth: 2,
                      borderColor: '#FFFFFF',
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: IU_CRIMSON,
                      borderWidth: 2,
                      borderColor: '#FFFFFF',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>
                      {location.userName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View
                  style={{
                    width: 0,
                    height: 0,
                    borderLeftWidth: 6,
                    borderRightWidth: 6,
                    borderTopWidth: 8,
                    borderLeftColor: 'transparent',
                    borderRightColor: 'transparent',
                    borderTopColor: location.userAvatar ? '#FFFFFF' : IU_CRIMSON,
                    marginTop: -2,
                  }}
                />
              </View>
            </Marker>
          );
        })}
      </MapView>
      
      {/* Location sharing toggle */}
      <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
        <TouchableOpacity
          onPress={toggleLocationSharing}
          disabled={updatingLocation}
          style={{
            backgroundColor: sharingLocation ? IU_CRIMSON : '#FFFFFF',
            padding: 16,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5,
          }}
        >
          {updatingLocation ? (
            <ActivityIndicator size="small" color={sharingLocation ? '#FFFFFF' : IU_CRIMSON} />
          ) : (
            <>
              <MaterialCommunityIcons 
                name={sharingLocation ? 'map-marker-off' : 'map-marker'} 
                size={24} 
                color={sharingLocation ? '#FFFFFF' : IU_CRIMSON} 
              />
              <Text style={{ color: sharingLocation ? '#FFFFFF' : IU_CRIMSON, fontSize: 16, fontWeight: '600', marginLeft: 8 }}>
                {sharingLocation ? 'Stop Sharing' : 'Share Location'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      
      {locations.length === 0 && !myLocation && (
        <View style={{ position: 'absolute', top: '50%', left: 0, right: 0, alignItems: 'center' }}>
          <Text style={{ color: subText, fontSize: 16 }}>No members sharing location</Text>
        </View>
      )}
    </View>
  );
}

function ChatTab({ groupId }) {
  const { background, subText, surface, text } = useThemeColors();
  const { isDarkMode } = useTheme();
  const { user, userData } = useAuth();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = React.useState([]);
  const [sending, setSending] = React.useState(false);
  const [showMediaPicker, setShowMediaPicker] = React.useState(false);
  const [showCamera, setShowCamera] = React.useState(false);
  const [cameraFacing, setCameraFacing] = React.useState('back');
  const [flash, setFlash] = React.useState('off');
  const [cameraReady, setCameraReady] = React.useState(false);
  const cameraRef = React.useRef(null);
  const lastTap = React.useRef(null);
  const lastTapTimeout = React.useRef(null);
  const [polls, setPolls] = React.useState([]);
  const [votingPoll, setVotingPoll] = React.useState(null);
  const [selectedImage, setSelectedImage] = React.useState(null);
  const inputRef = React.useRef(null);
  const panY = React.useRef(new Animated.Value(0)).current;
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);
  
  // Listen to keyboard events
  React.useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);
  
  // Reset keyboard height when camera modal opens or closes
  React.useEffect(() => {
    if (showCamera) {
      // When camera opens, immediately reset keyboard height to prevent bar from moving
      Keyboard.dismiss();
      setKeyboardHeight(0);
    } else {
      // When camera closes, dismiss keyboard and reset after delay
      Keyboard.dismiss();
      const timer = setTimeout(() => {
        setKeyboardHeight(0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showCamera]);
  
  // PanResponder for swipe-to-dismiss on image viewer
  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          // Swipe down threshold reached, dismiss modal
          Animated.timing(panY, {
            toValue: 1000,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setSelectedImage(null);
            panY.setValue(0);
          });
        } else {
          // Snap back to original position
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;
  
  const groupChatService = require('../services/groupChatService');
  const { sendMessage, sendImageMessage, sendVideoMessage, subscribeToMessages } = groupChatService;
  
  // Subscribe to polls to get latest vote counts
  React.useEffect(() => {
    if (!groupId) {
      setPolls([]);
      return;
    }

    const { subscribeToGroupPolls } = require('../services/groupPollsService');
    const unsubscribe = subscribeToGroupPolls(groupId, ({ polls: newPolls, error }) => {
      if (error) {
        console.error('Error loading polls:', error);
        return;
      }
      setPolls(newPolls || []);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [groupId]);
  
  // Handle voting on poll from chat
  const handlePollVote = React.useCallback(async (pollId, optionId) => {
    if (!groupId || !user?.uid) {
      Alert.alert('Error', 'Unable to vote. Please try again.');
      return;
    }
    
    if (votingPoll) {
      return;
    }
    
    setVotingPoll(pollId);
    try {
      const { voteOnGroupPoll } = require('../services/groupPollsService');
      const result = await voteOnGroupPoll(groupId, pollId, optionId, user.uid);
      if (result.error) {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      console.error('Error voting:', error);
      Alert.alert('Error', 'Failed to vote. Please try again.');
    } finally {
      setVotingPoll(null);
    }
  }, [groupId, user?.uid, votingPoll]);
  
  // Determine chat colors based on dark mode
  const chatBackground = isDarkMode ? '#000000' : '#F5F5F5';
  const inputBackground = isDarkMode ? '#1C1C1E' : '#F2F2F7';
  const inputBorder = isDarkMode ? '#38383A' : '#E5E5EA';
  const bubbleOwn = isDarkMode ? '#0A84FF' : '#007AFF'; // iOS blue
  const bubbleOther = isDarkMode ? '#2C2C2E' : '#E5E5EA';
  const textOwn = '#FFFFFF';
  const textOther = isDarkMode ? '#FFFFFF' : '#000000';
  const textSecondary = isDarkMode ? '#8E8E93' : '#8E8E93';
  
  // Create renderBubble function that updates when polls change
  const renderBubble = React.useCallback((props) => {
    // Explicitly check user ID to ensure own messages are always right-aligned
    // This prevents GiftedChat's consecutive message grouping from affecting alignment
    const messageUserId = String(props.currentMessage?.user?._id || '');
    const currentUserId = String(user?.uid || '');
    const isOwnMessage = messageUserId === currentUserId;
    
    // Handle poll messages
    if (props.currentMessage.type === 'poll' && props.currentMessage.pollId) {
      // Use pollData from message if available (faster, already merged), otherwise find it
      let poll = props.currentMessage.pollData;
      if (!poll) {
        poll = polls.find(p => p.id === props.currentMessage.pollId);
      }
      
      // If poll not found in subscription yet, use message data as fallback
      if (!poll) {
        const fallbackPoll = {
          id: props.currentMessage.pollId,
          question: props.currentMessage.pollQuestion || 'Poll',
          options: (props.currentMessage.pollOptions || []).map((opt, idx) => ({
            id: opt.id || `option_${idx}`,
            label: opt.label || opt,
            votes: 0,
            voters: [],
          })),
        };
        
        return (
          <View
            style={{
              backgroundColor: isOwnMessage ? bubbleOwn : bubbleOther,
              borderRadius: 20,
              padding: 14,
              borderTopLeftRadius: isOwnMessage ? 20 : 4,
              borderTopRightRadius: isOwnMessage ? 4 : 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
              elevation: 4,
            minWidth: '80%',
            maxWidth: '85%',
            marginLeft: 0, // Ensure no left margin
            marginRight: 0, // Ensure no right margin
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 20, marginRight: 8 }}>📊</Text>
            <Text
              style={{
                color: isOwnMessage ? textOwn : textOther,
                fontSize: 17,
                fontWeight: '700',
                flex: 1,
              }}
            >
              {fallbackPoll.question}
            </Text>
          </View>
            <Text style={{ color: isOwnMessage ? textOwn : textOther, fontSize: 14, opacity: 0.7, textAlign: 'center', padding: 8 }}>
              Loading poll data...
            </Text>
          </View>
        );
      }
      
      // Use the poll data from subscription (has latest vote counts)
      const pollData = poll;
      const totalVotes = pollData.options.reduce((sum, o) => sum + (o.votes || 0), 0);
      
      return (
        <View
          style={{
            backgroundColor: isOwnMessage ? bubbleOwn : bubbleOther,
            borderRadius: 20,
            padding: 14,
            borderTopLeftRadius: isOwnMessage ? 20 : 4,
            borderTopRightRadius: isOwnMessage ? 4 : 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 4,
            elevation: 4,
            minWidth: '80%',
            maxWidth: '85%',
            marginLeft: 0, // Ensure no left margin
            marginRight: 0, // Ensure no right margin
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 20, marginRight: 8 }}>📊</Text>
            <Text
              style={{
                color: isOwnMessage ? textOwn : textOther,
                fontSize: 17,
                fontWeight: '700',
                flex: 1,
              }}
            >
              {pollData.question}
            </Text>
          </View>
          
          {(pollData.options || []).map((opt, idx) => {
            const ratio = totalVotes > 0 ? (opt.votes || 0) / totalVotes : 0;
            const isVoted = opt.voters && opt.voters.includes(user?.uid);
            const percentage = totalVotes > 0 ? Math.round(ratio * 100) : 0;
            const optionId = opt.id || `option_${idx}`;
            
            return (
              <TouchableOpacity
                key={optionId}
                onPress={() => handlePollVote(pollData.id, optionId)}
                disabled={votingPoll === pollData.id}
                activeOpacity={0.7}
                style={{
                  marginBottom: 10,
                  padding: 12,
                  borderRadius: 10,
                  backgroundColor: isVoted 
                    ? (isOwnMessage ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)') 
                    : (isOwnMessage ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
                  borderWidth: isVoted ? 2 : 1,
                  borderColor: isVoted 
                    ? IU_CRIMSON 
                    : (isOwnMessage ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'),
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text
                    style={{
                      color: isOwnMessage ? textOwn : textOther,
                      fontSize: 15,
                      fontWeight: isVoted ? '600' : '400',
                      flex: 1,
                      marginRight: 10,
                    }}
                  >
                    {opt.label}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {isVoted && (
                      <Text
                        style={{
                          color: IU_CRIMSON,
                          fontSize: 14,
                          fontWeight: '700',
                          marginRight: 6,
                        }}
                      >
                        ✓
                      </Text>
                    )}
                    <Text
                      style={{
                        color: isOwnMessage ? textOwn : textOther,
                        fontSize: 14,
                        fontWeight: '600',
                        minWidth: 45,
                        textAlign: 'right',
                      }}
                    >
                      {opt.votes || 0} {opt.votes === 1 ? 'vote' : 'votes'}
                    </Text>
                    {totalVotes > 0 && (
                      <Text
                        style={{
                          color: isOwnMessage ? textOwn : textOther,
                          fontSize: 12,
                          opacity: 0.7,
                          marginLeft: 6,
                          minWidth: 35,
                          textAlign: 'right',
                        }}
                      >
                        {percentage}%
                      </Text>
                    )}
                  </View>
                </View>
                <View
                  style={{
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      height: '100%',
                      width: `${ratio * 100}%`,
                      backgroundColor: IU_CRIMSON,
                      borderRadius: 3,
                    }}
                  />
                </View>
              </TouchableOpacity>
            );
          })}
          
          {totalVotes > 0 && (
            <Text
              style={{
                color: isOwnMessage ? textOwn : textOther,
                fontSize: 11,
                opacity: 0.7,
                marginTop: 6,
                textAlign: 'center',
              }}
            >
              {totalVotes} total {totalVotes === 1 ? 'vote' : 'votes'}
            </Text>
          )}
        </View>
      );
    }
    
    // Regular message bubble
    return (
      <View
        style={{
          backgroundColor: isOwnMessage ? bubbleOwn : bubbleOther,
          borderRadius: 18,
          paddingHorizontal: props.currentMessage.image || props.currentMessage.video ? 8 : 12, // Padding for images
          paddingVertical: props.currentMessage.image || props.currentMessage.video ? 8 : 8, // Padding for images
          borderTopLeftRadius: isOwnMessage ? 18 : 4,
          borderTopRightRadius: isOwnMessage ? 4 : 18,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 2,
          maxWidth: props.currentMessage.image || props.currentMessage.video ? '90%' : '50%', // Keep bubble wide enough for images
          minWidth: 0, // Allow bubble to shrink to content size
          alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
          marginLeft: 0,
          marginRight: 0,
        }}
      >
        {props.currentMessage.image && (
          <TouchableOpacity
            onPress={() => setSelectedImage(props.currentMessage.image)}
            activeOpacity={0.9}
            style={{
              marginBottom: props.currentMessage.text ? 8 : 0,
            }}
          >
            <Image
              source={{ uri: props.currentMessage.image }}
              style={{
                width: 200, // Smaller photo size
                height: 200,
                borderRadius: 8,
              }}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}
        {props.currentMessage.video && (
          <View
            style={{
              width: 200, // Smaller video size
              height: 200,
              borderRadius: 8,
              marginBottom: props.currentMessage.text ? 8 : 0,
              backgroundColor: '#000',
              justifyContent: 'center',
              alignItems: 'center',
              overflow: 'hidden',
            }}
          >
            <Video
              source={{ uri: props.currentMessage.video }}
              style={{ width: 200, height: 200 }}
              useNativeControls
              resizeMode="contain"
            />
          </View>
        )}
        {props.currentMessage.text && (
          <Text
            style={{
              color: isOwnMessage ? textOwn : textOther,
              fontSize: 16,
              lineHeight: 20,
              flexShrink: 1, // Allow text to wrap
            }}
          >
            {props.currentMessage.text}
          </Text>
        )}
      </View>
    );
  }, [polls, user?.uid, handlePollVote, votingPoll, bubbleOwn, bubbleOther, textOwn, textOther]);
  
  // Store raw messages separately to merge with poll data
  const [rawMessages, setRawMessages] = React.useState([]);

  // Subscribe to messages when groupId changes
  React.useEffect(() => {
    if (!groupId || !user?.uid) {
      setMessages([]);
      setRawMessages([]);
      return;
    }

    const unsubscribe = subscribeToMessages(groupId, ({ messages: newMessages, error }) => {
      if (error) {
        console.error('Error loading messages:', error);
        return;
      }
      // Store raw messages
      setRawMessages(newMessages);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [groupId, user?.uid]);

  // Merge poll data into messages whenever polls or rawMessages change
  // This ensures poll messages update immediately when votes change
  React.useEffect(() => {
    if (!rawMessages.length) {
      setMessages([]);
      return;
    }

    // Convert to GiftedChat format and merge poll data
    // GiftedChat expects messages sorted by createdAt DESCENDING (newest first in array)
    // Service returns ascending (oldest first), so we reverse it
    const giftedChatMessages = rawMessages.map((msg) => {
      const message = {
        _id: msg._id,
        text: msg.text || '',
        createdAt: msg.createdAt,
        user: {
          ...msg.user,
          _id: String(msg.user._id), // Ensure user ID is a string for consistent comparison
        },
        image: msg.image || undefined,
        video: msg.video || undefined,
        type: msg.type || 'text',
        pollId: msg.pollId || null,
        pollQuestion: msg.pollQuestion || null,
        pollOptions: msg.pollOptions || null,
      };

      // If this is a poll message, merge latest poll data and add vote count key for re-rendering
      if (msg.type === 'poll' && msg.pollId) {
        const poll = polls.find(p => p.id === msg.pollId);
        if (poll) {
          // Add poll data and a key based on vote counts to force re-render
          const voteKey = poll.options.map(o => `${o.id}:${o.votes || 0}`).join('|');
          message.pollData = poll;
          message.pollVoteKey = voteKey; // Key that changes when votes change
        }
      }

      return message;
    }).reverse();
    
    setMessages(giftedChatMessages);
  }, [rawMessages, polls]); // Re-run when polls change to update poll messages

  // Handle sending text messages
  const onSend = React.useCallback(async (newMessages = []) => {
    console.log('🔵 onSend called with messages:', newMessages);
    console.log('🔵 Current state - groupId:', groupId, 'user:', user?.uid, 'userData:', userData, 'sending:', sending);
    
    if (!groupId || !user?.uid || !userData) {
      console.error('❌ Cannot send: missing groupId, user, or userData');
      return;
    }
    
    if (sending) {
      console.log('⚠️ Already sending, ignoring');
      return;
    }
    
    const message = newMessages[0];
    if (!message || !message.text || !message.text.trim()) {
      console.error('❌ Cannot send: no message text');
      return;
    }

    console.log('🔵 Sending message:', message.text);
    setSending(true);
    try {
      const { messageId, error } = await sendMessage(groupId, user.uid, message.text, userData);
      if (error) {
        console.error('❌ Error sending message:', error);
        Alert.alert('Error', error);
        // Still add to local state for optimistic UI
        setMessages((prev) => GiftedChat.append(prev, newMessages));
      } else {
        console.log('✅ Message sent successfully:', messageId);
        // Message will appear via real-time subscription, no need to add to local state
      }
    } catch (error) {
      console.error('❌ Exception sending message:', error);
      Alert.alert('Error', error.message || 'Failed to send message');
    setMessages((prev) => GiftedChat.append(prev, newMessages));
    } finally {
      setSending(false);
    }
  }, [groupId, user?.uid, userData, sending]);

  // Reset camera ready when facing changes
  React.useEffect(() => {
    if (showCamera) {
      setCameraReady(false);
    }
  }, [cameraFacing, showCamera]);

  // Fallback: Auto-set camera ready after 3 seconds
  React.useEffect(() => {
    if (!showCamera) return;
    const timer = setTimeout(() => {
      if (!cameraReady) {
        setCameraReady(true);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [showCamera, cameraReady]);

  const toggleCameraFacing = () => {
    setCameraReady(false);
    setCameraFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash((current) => {
      if (current === 'off') return 'on';
      if (current === 'on') return 'auto';
      return 'off';
    });
  };

  const handleCameraReady = () => {
    setCameraReady(true);
  };

  const takePicture = React.useCallback(async () => {
    if (!cameraRef.current || !groupId || !user?.uid || !userData || sending) {
      if (!cameraRef.current) {
        Alert.alert('Error', 'Camera is not ready. Please wait a moment.');
      }
      return;
    }

    try {
      setSending(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });
      
      if (photo && photo.uri) {
        // Auto crop to 3:4 aspect ratio and flip if front camera
        let finalUri = photo.uri;
        if (photo.width && photo.height) {
          try {
            const aspectRatio = 3 / 4;
            const photoAspectRatio = photo.width / photo.height;
            let cropWidth, cropHeight, originX, originY;
            
            if (photoAspectRatio > aspectRatio) {
              cropHeight = photo.height;
              cropWidth = cropHeight * aspectRatio;
              originX = (photo.width - cropWidth) / 2;
              originY = 0;
            } else {
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
                ...(cameraFacing === 'front' ? [{ flip: ImageManipulator.FlipType.Horizontal }] : []),
              ],
              {
                compress: 0.8,
                format: ImageManipulator.SaveFormat.JPEG,
              }
            );
            
            finalUri = manipulatedImage.uri;
          } catch (cropError) {
            console.error('Error cropping image:', cropError);
            if (cameraFacing === 'front') {
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
              } catch (flipError) {
                console.error('Error flipping image:', flipError);
                finalUri = photo.uri;
              }
            } else {
              finalUri = photo.uri;
            }
          }
        } else if (cameraFacing === 'front') {
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
          } catch (flipError) {
            console.error('Error flipping image:', flipError);
            finalUri = photo.uri;
          }
        }
        
        // Send photo to chat
        const { error } = await sendImageMessage(
          groupId,
          user.uid,
          finalUri,
          '',
          userData
        );
        if (error) {
          Alert.alert('Error', error);
        }
        
        // Close camera modal
        setShowCamera(false);
        setSending(false);
      } else {
        Alert.alert('Error', 'No photo data received. Please try again.');
        setSending(false);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', `Failed to take picture: ${error.message || 'Unknown error'}`);
      setSending(false);
    }
  }, [groupId, user?.uid, userData, sending, cameraFacing]);

  // Handle take photo from camera modal
  const handleSelectTakePhoto = React.useCallback(async () => {
    setShowMediaPicker(false);
    // Reset keyboard height BEFORE opening camera to prevent bar from moving
    Keyboard.dismiss();
    setKeyboardHeight(0);
    
    if (!cameraPermission) {
      // Still loading permission status
      return;
    }
    if (!cameraPermission.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Please grant permission to access your camera.');
        return;
      }
    }
    setShowCamera(true);
  }, [cameraPermission, requestCameraPermission]);

  // Handle image picker
  const handleImagePicker = React.useCallback(async () => {
    if (!groupId || !user?.uid || !userData || sending) return;

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSending(true);
        const { error } = await sendImageMessage(
          groupId,
          user.uid,
          result.assets[0].uri,
          '',
          userData
        );
        if (error) {
          Alert.alert('Error', error);
        }
        setSending(false);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      setSending(false);
    }
  }, [groupId, user?.uid, userData, sending]);

  // Handle video picker
  const handleVideoPicker = React.useCallback(async () => {
    if (!groupId || !user?.uid || !userData || sending) return;

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSending(true);
        const { error } = await sendVideoMessage(
          groupId,
          user.uid,
          result.assets[0].uri,
          '',
          userData
        );
        if (error) {
          Alert.alert('Error', error);
        }
        setSending(false);
      }
    } catch (error) {
      console.error('Error picking video:', error);
      setSending(false);
    }
  }, [groupId, user?.uid, userData, sending]);

  // Handle media picker button press
  const handleMediaPickerPress = React.useCallback(() => {
    setShowMediaPicker(true);
  }, []);

  // Handle image selection from picker
  const handleSelectImage = React.useCallback(async () => {
    setShowMediaPicker(false);
    await handleImagePicker();
  }, [handleImagePicker]);

  // Handle video selection from picker
  const handleSelectVideo = React.useCallback(async () => {
    setShowMediaPicker(false);
    await handleVideoPicker();
  }, [handleVideoPicker]);

  if (!groupId || !user?.uid) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: chatBackground }}>
        <Text style={{ color: textSecondary }}>Select a group to view chat</Text>
      </View>
    );
  }
  
  return (
    <View style={{ flex: 1, backgroundColor: chatBackground }}>
      <GiftedChat
        messages={messages}
        onSend={onSend}
        user={{
          _id: String(user.uid), // Ensure user ID is a string for consistent comparison
          name: userData?.name || 'You',
          avatar: userData?.photoURL || userData?.avatar || null,
        }}
        isTyping={sending}
        placeholder="Message"
        showUserAvatar={false}
        key={`chat-${groupId}`}
        keyboardShouldPersistTaps="never"
        textInputProps={{
          style: {
            fontSize: 16,
            color: textOther,
            paddingVertical: 8,
            paddingHorizontal: 4,
            maxHeight: 100,
          },
          placeholderTextColor: textSecondary,
        }}
        renderBubble={renderBubble}
        renderTime={(props) => {
          // Explicitly check user ID to determine alignment
          const messageUserId = String(props.currentMessage?.user?._id || '');
          const currentUserId = String(user?.uid || '');
          const isOwnMessage = messageUserId === currentUserId;
          
          return (
            <Text
              style={{
                fontSize: 11,
                color: textSecondary,
                marginHorizontal: 8,
                marginVertical: 4,
                alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
              }}
            >
              {new Date(props.currentMessage.createdAt).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}
            </Text>
          );
        }}
        renderMessage={(props) => {
          // Override default message rendering
          const messageUserId = String(props.currentMessage?.user?._id || '');
          const currentUserId = String(user?.uid || '');
          const isOwnMessage = messageUserId === currentUserId;
          
          // Check if previous message is from same user (consecutive message)
          const previousMessage = props.previousMessage;
          const isConsecutive = previousMessage && 
            String(previousMessage.user?._id || '') === messageUserId;
          
          return (
            <View
              style={{
                width: '100%',
                flexDirection: 'row',
                justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
                marginVertical: 8,
                paddingHorizontal: 12,
                alignItems: 'flex-start',
                marginLeft: 0,
                marginRight: 0,
              }}
            >
              {/* Show avatar for other users' messages on the left (always show, not just for non-consecutive) */}
              {!isOwnMessage && (
                <View style={{ marginRight: 8, marginTop: 2 }}>
                  <Image
                    source={{ uri: props.currentMessage.user.avatar || 'https://i.pravatar.cc/100?img=12' }}
                    style={{ width: 32, height: 32, borderRadius: 16 }}
                  />
                </View>
              )}
              <View style={{ flex: 1, maxWidth: '75%' }}>
                {/* Show username above message for other users (only if not consecutive) */}
                {!isOwnMessage && !isConsecutive && (
                  <Text
                    style={{
                      color: textSecondary,
                      fontSize: 12,
                      fontWeight: '600',
                      marginBottom: 4,
                      marginLeft: 0,
                    }}
                  >
                    {props.currentMessage.user.name || props.currentMessage.user.userName || 'User'}
                  </Text>
                )}
                {renderBubble(props)}
              </View>
            </View>
          );
        }}
        renderInputToolbar={(props) => {
          // Only apply keyboard adjustments when camera is not open
          const shouldApplyKeyboardOffset = !showCamera && keyboardHeight > 0;
          
          return (
            <View
              style={{
                backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
                borderTopWidth: 0,
                borderTopColor: 'transparent',
                paddingHorizontal: 8,
                paddingTop: 4,
                paddingBottom: shouldApplyKeyboardOffset ? 0 : 12,
                marginBottom: shouldApplyKeyboardOffset ? -80 : 0,
              }}
            >
              {/* Input row with plus button on left */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-end',
                  backgroundColor: inputBackground,
                  borderRadius: 20,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderWidth: 0.5,
                  borderColor: inputBorder,
                }}
              >
                {/* Plus button for media picker */}
                <TouchableOpacity
                  onPress={handleMediaPickerPress}
                  disabled={sending}
                  style={{
                    marginRight: 8,
                    padding: 4,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <MaterialCommunityIcons name="plus-circle" size={28} color={IU_CRIMSON} />
                </TouchableOpacity>
                
                <View style={{ flex: 1 }}>
                  {props.renderComposer && props.renderComposer(props)}
                </View>
                {props.renderSend && (
                  <View style={{ marginLeft: 8 }}>
                    {props.renderSend(props)}
                  </View>
                )}
              </View>
            </View>
          );
        }}
        renderComposer={(props) => {
          return (
            <TextInput
              {...props}
              value={props.text}
              onChangeText={props.onTextChanged}
              style={{
                ...props.textInputStyle,
                fontSize: 16,
                color: textOther,
                paddingVertical: 8,
                paddingHorizontal: 4,
                maxHeight: 100,
              }}
              placeholder="Message"
              placeholderTextColor={textSecondary}
              multiline
            />
          );
        }}
        renderSend={(props) => {
          const hasText = props.text && props.text.trim().length > 0;
          const isDisabled = sending || !hasText;
          
          return (
            <TouchableOpacity
              onPress={() => {
                if (hasText && !sending && onSend) {
                  // Create message in GiftedChat format
                  const message = {
                    _id: Math.random().toString(36).substring(7),
                    text: props.text.trim(),
                    createdAt: new Date(),
                    user: {
                      _id: String(user.uid), // Ensure user ID is a string for consistent comparison
                      name: userData?.name || 'You',
                      avatar: userData?.photoURL || userData?.avatar || null,
                    },
                  };
                  
                  // Clear the text input and dismiss keyboard
                  if (props.onTextChanged) {
                    props.onTextChanged('');
                  }
                  Keyboard.dismiss();
                  
                  // Call onSend which will send to Firebase
                  onSend([message]);
                }
              }}
              disabled={isDisabled}
              style={{
                backgroundColor: IU_CRIMSON,
                borderRadius: 16,
                width: 32,
                height: 32,
                justifyContent: 'center',
                alignItems: 'center',
                opacity: isDisabled ? 0.5 : 1,
              }}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <MaterialCommunityIcons name="send" size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          );
        }}
        scrollToBottom
        scrollToBottomComponent={() => (
          <MaterialCommunityIcons name="chevron-down" size={24} color={IU_CRIMSON} />
        )}
        messageContainerStyle={{
          left: { 
            marginLeft: 0,
            marginRight: 0,
            paddingLeft: 0,
            paddingRight: 0,
          },
          right: { 
            marginLeft: 0,
            marginRight: 0,
            paddingLeft: 0,
            paddingRight: 0,
          },
        }}
        wrapperStyle={{
          left: {
            marginLeft: 0,
            paddingLeft: 0,
          },
          right: {
            marginRight: 0,
            paddingRight: 0,
          },
        }}
      />
      
      {/* Media Picker Modal */}
      <Modal
        visible={showMediaPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMediaPicker(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowMediaPicker(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' }}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View
                style={{
                  backgroundColor: isDarkMode ? '#1C1C1E' : '#FFFFFF',
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  padding: 20,
                  paddingBottom: 40,
                }}
              >
                <Text
                  style={{
                    color: textOther,
                    fontSize: 18,
                    fontWeight: '600',
                    marginBottom: 20,
                    textAlign: 'center',
                  }}
                >
                  Choose Media
                </Text>
                
                {/* Take Photo Option */}
                <TouchableOpacity
                  onPress={handleSelectTakePhoto}
                  disabled={sending}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    backgroundColor: isDarkMode ? '#2C2C2E' : surface,
                    borderRadius: 12,
                    marginBottom: 12,
                  }}
                >
                  <MaterialCommunityIcons name="camera" size={24} color={IU_CRIMSON} />
                  <Text style={{ color: textOther, fontSize: 16, marginLeft: 12, flex: 1 }}>
                    Take Photo
                  </Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={textSecondary} />
                </TouchableOpacity>
                
                {/* Image Option */}
                <TouchableOpacity
                  onPress={handleSelectImage}
                  disabled={sending}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    backgroundColor: isDarkMode ? '#2C2C2E' : surface,
                    borderRadius: 12,
                    marginBottom: 12,
                  }}
                >
                  <MaterialCommunityIcons name="image" size={24} color={IU_CRIMSON} />
                  <Text style={{ color: textOther, fontSize: 16, marginLeft: 12, flex: 1 }}>
                    Choose Photo
                  </Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={textSecondary} />
                </TouchableOpacity>
                
                {/* Video Option */}
                <TouchableOpacity
                  onPress={handleSelectVideo}
                  disabled={sending}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    backgroundColor: isDarkMode ? '#2C2C2E' : surface,
                    borderRadius: 12,
                  }}
                >
                  <MaterialCommunityIcons name="video" size={24} color={IU_CRIMSON} />
                  <Text style={{ color: textOther, fontSize: 16, marginLeft: 12, flex: 1 }}>
                    Choose Video
                  </Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={textSecondary} />
                </TouchableOpacity>
                
                {/* Cancel Button */}
                <TouchableOpacity
                  onPress={() => setShowMediaPicker(false)}
                  style={{
                    marginTop: 20,
                    padding: 16,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: IU_CRIMSON, fontSize: 16, fontWeight: '600' }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      
      {/* Camera Modal */}
      <Modal
        visible={showCamera}
        animationType="slide"
        onRequestClose={() => {
          setShowCamera(false);
        }}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {!cameraPermission ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#E6E8F0', fontSize: 16, textAlign: 'center', marginBottom: 20 }}>
                Checking camera permissions...
              </Text>
            </View>
          ) : !cameraPermission.granted ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#E6E8F0', fontSize: 16, textAlign: 'center', marginBottom: 20 }}>
                We need your permission to show the camera
              </Text>
              <TouchableOpacity onPress={requestCameraPermission} style={{ backgroundColor: IU_CRIMSON, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Grant Permission</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <CameraView
              ref={cameraRef}
              style={{ flex: 1, width: '100%' }}
              facing={cameraFacing}
              mode="picture"
              flash={flash}
              onCameraReady={handleCameraReady}
            >
              {/* Mode Toggle - Photo only for chat */}
              <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }} edges={['top']}>
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: 40, paddingBottom: 10, paddingHorizontal: 16, position: 'relative' }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: IU_CRIMSON, minHeight: 44, minWidth: 100 }}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="camera" size={24} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginLeft: 8 }}>Photo</Text>
                  </TouchableOpacity>
                  
                  {/* Flash toggle button */}
                  <View style={{ position: 'absolute', right: 16, top: 40, bottom: 10, justifyContent: 'center', alignItems: 'center' }}>
                    <TouchableOpacity style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center' }} onPress={toggleFlash}>
                      <MaterialCommunityIcons 
                        name={flash === 'on' ? 'flash' : flash === 'auto' ? 'flash-auto' : 'flash-off'} 
                        size={24} 
                        color={flash === 'off' ? '#8A90A6' : '#FFFFFF'} 
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </SafeAreaView>

              {/* 3:4 aspect ratio viewfinder overlay */}
              <Pressable 
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'column', zIndex: 5 }}
                onPress={() => {
                  // Double tap detection
                  const now = Date.now();
                  const DOUBLE_PRESS_DELAY = 300;
                  
                  if (lastTap.current && now - lastTap.current < DOUBLE_PRESS_DELAY) {
                    if (lastTapTimeout.current) {
                      clearTimeout(lastTapTimeout.current);
                      lastTapTimeout.current = null;
                    }
                    toggleCameraFacing();
                    lastTap.current = null;
                  } else {
                    lastTap.current = now;
                    lastTapTimeout.current = setTimeout(() => {
                      lastTap.current = null;
                    }, DOUBLE_PRESS_DELAY);
                  }
                }}
              >
                {/* Top dark area */}
                <View style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', flex: 1, width: '100%' }} pointerEvents="none" />
                {/* 3:4 viewfinder */}
                <View 
                  style={{
                    width: Dimensions.get('window').width,
                    aspectRatio: 3 / 4,
                    borderWidth: 2,
                    borderColor: 'rgba(255, 255, 255, 0.9)',
                    borderRadius: 12,
                    backgroundColor: 'transparent',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.8,
                    shadowRadius: 8,
                    elevation: 5,
                  }} 
                  pointerEvents="none" 
                />
                {/* Bottom dark area */}
                <View style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', flex: 1, width: '100%' }} pointerEvents="none" />
              </Pressable>

              <View style={{ flex: 1, flexDirection: 'row', backgroundColor: 'transparent', margin: 20, justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 20, paddingHorizontal: 0, position: 'relative' }}>
                {/* Flip button */}
                <TouchableOpacity 
                  style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', marginLeft: 20, marginBottom: 0 }} 
                  onPress={toggleCameraFacing}
                >
                  <MaterialCommunityIcons name="camera-flip" size={32} color="#FFFFFF" />
                </TouchableOpacity>
                
                {/* Shutter button centered */}
                <TouchableOpacity 
                  style={{ 
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
                    bottom: 20, 
                    transform: [{ translateX: -35 }],
                    opacity: (!cameraReady || sending) ? 0.5 : 1,
                  }} 
                  onPress={takePicture}
                  disabled={!cameraReady || sending}
                >
                  <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: IU_CRIMSON }} />
                </TouchableOpacity>
                
                {/* Spacer to balance the flip button */}
                <View style={{ width: 50, marginRight: 20 }} />
              </View>

              {/* Close button */}
              <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30 }} edges={['top']} pointerEvents="box-none">
                <TouchableOpacity
                  style={{ position: 'absolute', top: 100, left: 16, zIndex: 30, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center' }}
                  onPress={() => {
                    setShowCamera(false);
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </SafeAreaView>
            </CameraView>
          )}
        </View>
      </Modal>
      
      {/* Full-screen Image Viewer Modal */}
      <Modal
        visible={selectedImage !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setSelectedImage(null);
          panY.setValue(0);
        }}
      >
        <TouchableWithoutFeedback onPress={() => {
          setSelectedImage(null);
          panY.setValue(0);
        }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.95)', justifyContent: 'center', alignItems: 'center' }}>
            <Animated.View
              style={{
                width: '100%',
                height: '100%',
                transform: [{ translateY: panY }],
                opacity: panY.interpolate({
                  inputRange: [0, 1000],
                  outputRange: [1, 0],
                }),
              }}
              {...panResponder.panHandlers}
            >
              <Image
                source={{ uri: selectedImage }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
              />
            </Animated.View>
            <TouchableOpacity
              style={{
                position: 'absolute',
                top: 50,
                right: 20,
                padding: 10,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                borderRadius: 20,
              }}
              onPress={() => {
                setSelectedImage(null);
                panY.setValue(0);
              }}
            >
              <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

function AlbumTab({ groupId }) {
  const { user, userData } = useAuth();
  const { background, divider, subText } = useThemeColors();
  const [items, setItems] = React.useState([]);
  const [selectedImage, setSelectedImage] = React.useState(null);
  const panY = React.useRef(new Animated.Value(0)).current;
  
  // PanResponder for swipe-to-dismiss on image viewer
  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          // Swipe down threshold reached, dismiss modal
          Animated.timing(panY, {
            toValue: 1000,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setSelectedImage(null);
            panY.setValue(0);
          });
        } else {
          // Snap back to original position
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;
  
  // Subscribe to group photos from Firestore
  React.useEffect(() => {
    if (!groupId) {
      setItems([]);
      return;
    }

    const unsubscribe = subscribeToGroupPhotos(groupId, ({ photos, error }) => {
      if (error) {
        console.error('Error loading group photos:', error);
        setItems([]);
      } else {
        // Convert photos to the format expected by the UI
        const formattedItems = photos.map(photo => ({
          type: photo.type || 'photo',
          uri: photo.uri || photo.url,
        }));
        setItems(formattedItems);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [groupId]);

  const pick = async () => {
    if (!user || !userData) {
      Alert.alert('Error', 'Please sign in to add photos');
      return;
    }

    await ImagePicker.requestMediaLibraryPermissionsAsync();
    const res = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8 
    });
    if (!res.canceled) {
      const asset = res.assets[0];
      const isVideo = asset.type === 'video';
      
      try {
        // Upload to Firebase Storage
        const { url, error: uploadError } = await uploadImage(asset.uri, user.uid, 'group-chat');
        
        if (uploadError || !url) {
          Alert.alert('Error', uploadError || 'Failed to upload media');
          return;
        }

        // Add to album
        if (isVideo) {
          const { error } = await addVideoToAlbum(groupId, user.uid, url, userData);
          if (error) {
            Alert.alert('Error', error);
          }
        } else {
          const { error } = await addPhotoToAlbum(groupId, user.uid, url, userData);
          if (error) {
            Alert.alert('Error', error);
          }
        }
      } catch (error) {
        console.error('Error adding media to album:', error);
        Alert.alert('Error', 'Failed to add media to album');
      }
    }
  };
  
  return (
    <View style={{ flex: 1, padding: 12, backgroundColor: background }}>
      {items.length > 0 ? (
        <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {items.map((item, i) => {
          const uri = typeof item === 'string' ? item : item.uri;
          const isVideo = typeof item === 'object' && item.type === 'video';
          return (
            <TouchableOpacity
              key={i}
              onPress={() => !isVideo && setSelectedImage(uri)}
              activeOpacity={0.9}
              style={{ width: '31%', aspectRatio: 1, backgroundColor: divider, borderRadius: 10, overflow: 'hidden', position: 'relative' }}
            >
              {isVideo ? (
                <>
                  <Image source={{ uri }} style={{ width: '100%', height: '100%', opacity: 0.7 }} />
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="play-circle" size={40} color="#FFFFFF" />
                  </View>
                </>
              ) : (
                <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
              )}
            </TouchableOpacity>
          );
        })}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: subText }}>Empty</Text>
        </View>
      )}
      <TouchableOpacity
        onPress={pick}
        style={{
          position: 'absolute',
          right: 16,
          bottom: 16,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: IU_CRIMSON,
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        }}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>
      
      {/* Full-screen Image Viewer Modal */}
      <Modal
        visible={selectedImage !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setSelectedImage(null);
          panY.setValue(0);
        }}
      >
        <TouchableWithoutFeedback onPress={() => {
          setSelectedImage(null);
          panY.setValue(0);
        }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.95)', justifyContent: 'center', alignItems: 'center' }}>
            <Animated.View
              style={{
                width: '100%',
                height: '100%',
                transform: [{ translateY: panY }],
                opacity: panY.interpolate({
                  inputRange: [0, 1000],
                  outputRange: [1, 0],
                }),
              }}
              {...panResponder.panHandlers}
            >
              <Image
                source={{ uri: selectedImage }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
              />
            </Animated.View>
            <TouchableOpacity
              style={{
                position: 'absolute',
                top: 50,
                right: 20,
                padding: 10,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                borderRadius: 20,
              }}
              onPress={() => {
                setSelectedImage(null);
                panY.setValue(0);
              }}
            >
              <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

function PollsTab({ groupId }) {
  const { background, subText, text, surface } = useThemeColors();
  const { user, userData } = useAuth();
  const [polls, setPolls] = React.useState([]);
  const [showCreatePoll, setShowCreatePoll] = React.useState(false);
  const [creatingPoll, setCreatingPoll] = React.useState(false);
  const [voting, setVoting] = React.useState(null);
  
  // Create poll form state
  const [pollQuestion, setPollQuestion] = React.useState('');
  const [pollOptions, setPollOptions] = React.useState(['', '']);
  
  // Subscribe to polls
  React.useEffect(() => {
    if (!groupId) {
      setPolls([]);
      return;
    }

    const unsubscribe = subscribeToGroupPolls(groupId, ({ polls: newPolls, error }) => {
      if (error) {
        console.error('Error loading polls:', error);
        return;
      }
      setPolls(newPolls || []);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [groupId]);
  
  // Handle voting
  const handleVote = React.useCallback(async (pollId, optionId) => {
    if (!groupId || !user?.uid || voting) return;
    
    setVoting(pollId);
    try {
      const result = await voteOnGroupPoll(groupId, pollId, optionId, user.uid);
      if (result.error) {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      console.error('Error voting:', error);
      Alert.alert('Error', 'Failed to vote. Please try again.');
    } finally {
      setVoting(null);
    }
  }, [groupId, user?.uid, voting]);
  
  // Handle creating poll
  const handleCreatePoll = React.useCallback(async () => {
    if (!groupId || !user?.uid || creatingPoll) return;
    
    const trimmedQuestion = pollQuestion.trim();
    const trimmedOptions = pollOptions.map(opt => opt.trim()).filter(opt => opt.length > 0);
    
    if (!trimmedQuestion) {
      Alert.alert('Error', 'Please enter a question');
      return;
    }
    
    if (trimmedOptions.length < 2) {
      Alert.alert('Error', 'Please enter at least 2 options');
      return;
    }
    
    setCreatingPoll(true);
    try {
      const result = await createGroupPoll(
        groupId,
        user.uid,
        trimmedQuestion,
        trimmedOptions,
        {
          name: userData?.name || 'User',
          photoURL: userData?.photoURL || userData?.avatar || null,
          avatar: userData?.avatar || userData?.photoURL || null,
        }
      );
      
      if (result.error) {
        Alert.alert('Error', result.error);
      } else {
        // Reset form
        setPollQuestion('');
        setPollOptions(['', '']);
        setShowCreatePoll(false);
      }
    } catch (error) {
      console.error('Error creating poll:', error);
      Alert.alert('Error', 'Failed to create poll. Please try again.');
    } finally {
      setCreatingPoll(false);
    }
  }, [groupId, user?.uid, userData, pollQuestion, pollOptions, creatingPoll]);
  
  const addOption = () => {
    setPollOptions([...pollOptions, '']);
  };
  
  const removeOption = (index) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };
  
  const updateOption = (index, value) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };
  
  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
        {polls.length > 0 ? (
          polls.map((p) => (
            <PollCard 
              key={p.id} 
              poll={p} 
              onVote={handleVote}
              currentUserId={user?.uid}
              showVoteButton={!voting || voting !== p.id}
            />
          ))
        ) : (
          <Text style={{ color: subText, textAlign: 'center', padding: 20 }}>
            No polls yet. Create one to get started!
          </Text>
        )}
      </ScrollView>
      
      {/* Create Poll FAB */}
      <FAB
        icon="plus"
        style={{
          position: 'absolute',
          margin: 16,
          right: 0,
          bottom: 0,
          backgroundColor: IU_CRIMSON,
        }}
        onPress={() => setShowCreatePoll(true)}
        color="#FFFFFF"
      />
      
      {/* Create Poll Modal */}
      <Modal
        visible={showCreatePoll}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCreatePoll(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={() => setShowCreatePoll(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' }}>
              <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                <View style={{ backgroundColor: background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <Text style={{ color: text, fontSize: 20, fontWeight: 'bold' }}>Create Poll</Text>
                    <TouchableOpacity onPress={() => setShowCreatePoll(false)}>
                      <MaterialCommunityIcons name="close" size={24} color={text} />
                    </TouchableOpacity>
                  </View>
                  
                  <ScrollView 
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={true}
                    contentContainerStyle={{ paddingBottom: 20 }}
                  >
                    <Text style={{ color: text, fontSize: 16, marginBottom: 8 }}>Question</Text>
                    <TextInput
                      style={{
                        backgroundColor: surface,
                        borderRadius: 8,
                        padding: 12,
                        color: text,
                        marginBottom: 20,
                        fontSize: 16,
                        minHeight: 60,
                      }}
                      placeholder="What do you want to ask?"
                      placeholderTextColor={subText}
                      value={pollQuestion}
                      onChangeText={setPollQuestion}
                      multiline
                      textAlignVertical="top"
                    />
                    
                    <Text style={{ color: text, fontSize: 16, marginBottom: 8 }}>Options</Text>
                    {pollOptions.map((option, index) => (
                      <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <TextInput
                          style={{
                            flex: 1,
                            backgroundColor: surface,
                            borderRadius: 8,
                            padding: 12,
                            color: text,
                            fontSize: 16,
                          }}
                          placeholder={`Option ${index + 1}`}
                          placeholderTextColor={subText}
                          value={option}
                          onChangeText={(value) => updateOption(index, value)}
                        />
                        {pollOptions.length > 2 && (
                          <TouchableOpacity
                            onPress={() => removeOption(index)}
                            style={{ marginLeft: 8, padding: 8 }}
                          >
                            <MaterialCommunityIcons name="close-circle" size={24} color={IU_CRIMSON} />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                    
                    <Button
                      mode="text"
                      onPress={addOption}
                      textColor={IU_CRIMSON}
                      style={{ marginBottom: 20 }}
                    >
                      + Add Option
                    </Button>
                    
                    <Button
                      mode="contained"
                      buttonColor={IU_CRIMSON}
                      textColor="#FFFFFF"
                      onPress={handleCreatePoll}
                      disabled={creatingPoll}
                      loading={creatingPoll}
                    >
                      Create Poll
                    </Button>
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function GroupDetail({ group, onBack }) {
  const { background, text, subText, surface } = useThemeColors();
  const { user, friendsList: friendsListFromContext } = useAuth();
  const navigation = useNavigation();
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [showMembersModal, setShowMembersModal] = React.useState(false);
  const [membersData, setMembersData] = React.useState([]);
  const [loadingMembers, setLoadingMembers] = React.useState(false);
  const [showAddMembersModal, setShowAddMembersModal] = React.useState(false);
  const [friendsWithData, setFriendsWithData] = React.useState([]);
  const [selectedFriends, setSelectedFriends] = React.useState(new Set());
  const [loadingFriends, setLoadingFriends] = React.useState(false);
  const [addingMembers, setAddingMembers] = React.useState(false);
  
  // Handle member profile tap - navigate to user profile
  const handleMemberProfileTap = React.useCallback((member) => {
    if (!member || !member.username) {
      return;
    }

    // Close members modal first
    setShowMembersModal(false);

    // Navigate to UserProfileModal in the root navigator
    // Go up navigation hierarchy to find root navigator
    let rootNavigator = navigation;
    let parent = navigation.getParent();
    
    // Navigate up to find root navigator
    while (parent) {
      rootNavigator = parent;
      parent = parent.getParent();
    }
    
    // Navigate to the root modal
    rootNavigator.navigate('UserProfileModal', { 
      username: member.username 
    });
  }, [navigation]);
  
  // Load members data when modal opens
  React.useEffect(() => {
    if (showMembersModal && group?.members && Array.isArray(group.members)) {
      setLoadingMembers(true);
      const loadMembers = async () => {
        try {
          const members = await Promise.all(
            group.members.map(async (memberUid) => {
              try {
                const { userData } = await getUserById(memberUid);
                if (userData) {
                  return {
                    uid: memberUid,
                    username: userData.username || 'unknown',
                    name: userData.name || 'Unknown User',
                    avatar: userData.photoURL || userData.avatar || null,
                  };
                }
                return {
                  uid: memberUid,
                  username: 'unknown',
                  name: 'Unknown User',
                  avatar: null,
                };
              } catch (error) {
                console.error('Error loading member data:', error);
                return {
                  uid: memberUid,
                  username: 'unknown',
                  name: 'Unknown User',
                  avatar: null,
                };
              }
            })
          );
          setMembersData(members);
        } catch (error) {
          console.error('Error loading members:', error);
          setMembersData([]);
        } finally {
          setLoadingMembers(false);
        }
      };
      loadMembers();
    } else if (!showMembersModal) {
      setMembersData([]);
    }
  }, [showMembersModal, group?.members]);
  
  // Load friends data when add members modal opens
  React.useEffect(() => {
    if (showAddMembersModal && friendsListFromContext && group?.members) {
      setLoadingFriends(true);
      const loadFriends = async () => {
        try {
          // Convert friend usernames to UIDs
          const { getAuthUidFromUsername } = await import('../services/friendsService');
          const friendUids = await Promise.all(
            friendsListFromContext.map(async (friendUsername) => {
              try {
                const uid = await getAuthUidFromUsername(friendUsername);
                return uid;
              } catch (error) {
                console.error('Error converting username to UID:', error);
                return null;
              }
            })
          );
          
          // Filter out nulls and friends who are already members
          const validFriendUids = friendUids.filter(uid => uid && !group.members.includes(uid));
          
          // Load friend user data
          const friendsData = await Promise.all(
            validFriendUids.map(async (uid) => {
              try {
                const { userData } = await getUserById(uid);
                if (userData) {
                  return {
                    uid: uid,
                    username: userData.username || 'unknown',
                    name: userData.name || 'Unknown User',
                    avatar: userData.photoURL || userData.avatar || null,
                  };
                }
                return null;
              } catch (error) {
                console.error('Error loading friend data:', error);
                return null;
              }
            })
          );
          
          setFriendsWithData(friendsData.filter(f => f !== null));
          setSelectedFriends(new Set()); // Reset selections
        } catch (error) {
          console.error('Error loading friends:', error);
          setFriendsWithData([]);
        } finally {
          setLoadingFriends(false);
        }
      };
      
      loadFriends();
    } else if (!showAddMembersModal) {
      setFriendsWithData([]);
      setSelectedFriends(new Set());
    }
  }, [showAddMembersModal, friendsListFromContext, group?.members]);

  // Handle toggle friend selection
  const handleToggleFriend = (friendUid) => {
    setSelectedFriends((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(friendUid)) {
        newSet.delete(friendUid);
      } else {
        newSet.add(friendUid);
      }
      return newSet;
    });
  };

  // Handle add selected members to group
  const handleAddMembers = async () => {
    if (!group?.id || selectedFriends.size === 0) {
      return;
    }

    setAddingMembers(true);
    try {
      const addPromises = Array.from(selectedFriends).map(async (friendUid) => {
        const result = await addMemberToGroup(group.id, friendUid);
        if (result.error && result.error !== 'User is already a member') {
          console.error(`Error adding member ${friendUid}:`, result.error);
          return { success: false, error: result.error };
        }
        return { success: true };
      });

      const results = await Promise.all(addPromises);
      const successCount = results.filter(r => r.success).length;

      if (successCount > 0) {
        Alert.alert('Success', `Added ${successCount} member${successCount > 1 ? 's' : ''} to the group.`);
        setShowAddMembersModal(false);
        setSelectedFriends(new Set());
      } else {
        Alert.alert('Error', 'Failed to add members. Please try again.');
      }
    } catch (error) {
      console.error('Error adding members:', error);
      Alert.alert('Error', 'Failed to add members. Please try again.');
    } finally {
      setAddingMembers(false);
    }
  };
  
  // Check if current user is the group owner
  const isOwner = group?.creator === user?.uid;
  
  // Check if group is expired
  const isExpired = React.useMemo(() => {
    if (!group?.endTime) return false;
    const now = new Date();
    const endTime = group.endTime instanceof Date ? group.endTime : new Date(group.endTime);
    return endTime.getTime() <= now.getTime();
  }, [group?.endTime]);
  
  // Format time remaining for display
  const formatTimeRemaining = () => {
    if (!group?.endTime) return '';
    const now = new Date();
    const endTime = group.endTime instanceof Date ? group.endTime : new Date(group.endTime);
    const diff = endTime.getTime() - now.getTime();
    
    if (diff <= 0) return 'Ended';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };
  
  // Handle delete group
  const handleDeleteGroup = async () => {
    if (!group?.id || !isOwner) return;
    
    setShowDeleteConfirm(true);
  };
  
  const confirmDelete = async () => {
    if (!group?.id || !isOwner) return;
    
    setDeleting(true);
    try {
      const { error } = await deleteGroup(group.id, user.uid);
      if (error) {
        Alert.alert('Error', error);
      } else {
        Alert.alert('Success', 'Group deleted successfully', [
          {
            text: 'OK',
            onPress: () => {
              onBack();
            },
          },
        ]);
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      Alert.alert('Error', error.message || 'Failed to delete group');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };
  
  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      <Appbar.Header mode="small" elevated={false} style={{ backgroundColor: background }}>
        <Appbar.Action icon="arrow-left" onPress={onBack} color={text} />
        <TouchableOpacity
          onPress={() => setShowMembersModal(true)}
          style={{ flex: 1, justifyContent: 'center', paddingLeft: 8 }}
          activeOpacity={0.7}
        >
          <Text style={{ color: text, fontSize: 18, fontWeight: '500' }}>
            {group?.name || 'Group'}
          </Text>
        </TouchableOpacity>
        {isOwner && (
          <Appbar.Action 
            icon="delete" 
            onPress={handleDeleteGroup} 
            color={IU_CRIMSON}
            disabled={deleting}
          />
        )}
        <Appbar.Action 
          icon="account-plus" 
          onPress={() => setShowAddMembersModal(true)}
          color={text}
        />
      </Appbar.Header>
      <TopTab.Navigator
        initialRouteName={isExpired ? "Album" : "Chat"}
        screenOptions={{
          tabBarStyle: { backgroundColor: background },
          tabBarIndicatorStyle: { backgroundColor: IU_CRIMSON },
          tabBarActiveTintColor: text,
          tabBarInactiveTintColor: subText,
        }}
      >
        {!isExpired && (
          <>
            <TopTab.Screen name="Chat">
              {(props) => <ChatTab {...props} groupId={group?.id} />}
            </TopTab.Screen>
            <TopTab.Screen name="Map">
              {(props) => <MapTab {...props} groupId={group?.id} />}
            </TopTab.Screen>
            <TopTab.Screen name="Polls">
              {(props) => <PollsTab {...props} groupId={group?.id} />}
            </TopTab.Screen>
          </>
        )}
        <TopTab.Screen name="Album">
          {(props) => <AlbumTab {...props} groupId={group?.id} />}
        </TopTab.Screen>
      </TopTab.Navigator>
      
      {/* Delete Confirmation Dialog */}
      <Modal
        visible={showDeleteConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: background, borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 }}>
            <Text style={{ color: text, fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>
              Delete Group
            </Text>
            <Text style={{ color: subText, fontSize: 16, marginBottom: 20 }}>
              Are you sure you want to delete "{group?.name}"? This action cannot be undone and all messages and data will be permanently deleted.
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button
                mode="text"
                onPress={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                textColor={text}
                style={{ marginRight: 8 }}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                buttonColor={IU_CRIMSON}
                textColor="#FFFFFF"
                onPress={confirmDelete}
                disabled={deleting}
                loading={deleting}
              >
                Delete
              </Button>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Members List Modal */}
      <Modal
        visible={showMembersModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMembersModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: background }}>
          <Appbar.Header mode="center-aligned" style={{ backgroundColor: background }}>
            <Appbar.Action icon="arrow-left" onPress={() => setShowMembersModal(false)} color={text} />
            <Appbar.Content title="Group Information" color={text} />
            <Appbar.Action 
              icon="account-plus" 
              onPress={() => {
                setShowMembersModal(false);
                setShowAddMembersModal(true);
              }}
              color={text}
            />
          </Appbar.Header>
          {loadingMembers ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="small" color={IU_CRIMSON} />
              <Text style={{ color: subText, marginTop: 12 }}>Loading members...</Text>
            </View>
          ) : membersData.length > 0 ? (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
              {/* Timer Display */}
              {group?.endTime && (
                <View style={{ 
                  backgroundColor: surface, 
                  borderRadius: 12, 
                  padding: 16, 
                  marginBottom: 16,
                  alignItems: 'center'
                }}>
                  <Text style={{ color: subText, fontSize: 12, marginBottom: 4 }}>Time Remaining</Text>
                  <Text style={{ color: text, fontSize: 20, fontWeight: '600' }}>
                    {formatTimeRemaining()}
                  </Text>
                </View>
              )}
              
              {membersData.map((member, index) => (
                <View key={member.uid}>
                  <TouchableOpacity
                    onPress={() => handleMemberProfileTap(member)}
                    activeOpacity={0.7}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}
                  >
                    <Avatar.Image
                      size={48}
                      source={{ uri: member.avatar || 'https://i.pravatar.cc/100?img=12' }}
                      style={{ backgroundColor: surface }}
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ color: text, fontSize: 16, fontWeight: '600' }}>
                        {member.name}
                      </Text>
                      <Text style={{ color: subText, fontSize: 14 }}>
                        @{member.username}
                      </Text>
                    </View>
                    {member.uid === group?.creator && (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: IU_CRIMSON, borderRadius: 12 }}>
                        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>Creator</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {index < membersData.length - 1 && (
                    <View style={{ height: 1, backgroundColor: surface, marginLeft: 60 }} />
                  )}
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: subText }}>No members found</Text>
            </View>
          )}
        </View>
      </Modal>

      {/* Add Members Modal */}
      <Modal
        visible={showAddMembersModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddMembersModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: background }}>
          <Appbar.Header mode="center-aligned" style={{ backgroundColor: background }}>
            <Appbar.Action icon="arrow-left" onPress={() => setShowAddMembersModal(false)} color={text} />
            <Appbar.Content title="Add Members" color={text} />
            <Appbar.Action 
              icon="check" 
              onPress={handleAddMembers}
              disabled={selectedFriends.size === 0 || addingMembers}
              color={selectedFriends.size > 0 ? IU_CRIMSON : subText}
            />
          </Appbar.Header>
          {loadingFriends ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="small" color={IU_CRIMSON} />
              <Text style={{ color: subText, marginTop: 12 }}>Loading friends...</Text>
            </View>
          ) : friendsWithData.length > 0 ? (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
              {friendsWithData.map((friend, index) => (
                <View key={friend.uid}>
                  <TouchableOpacity
                    onPress={() => handleToggleFriend(friend.uid)}
                    activeOpacity={0.7}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}
                  >
                    <Avatar.Image
                      size={48}
                      source={{ uri: friend.avatar || 'https://i.pravatar.cc/100?img=12' }}
                      style={{ backgroundColor: surface }}
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ color: text, fontSize: 16, fontWeight: '600' }}>
                        {friend.name}
                      </Text>
                      <Text style={{ color: subText, fontSize: 14 }}>
                        @{friend.username}
                      </Text>
                    </View>
                    <Checkbox
                      status={selectedFriends.has(friend.uid) ? 'checked' : 'unchecked'}
                      onPress={() => handleToggleFriend(friend.uid)}
                      color={IU_CRIMSON}
                    />
                  </TouchableOpacity>
                  {index < friendsWithData.length - 1 && (
                    <View style={{ height: 1, backgroundColor: surface, marginLeft: 60 }} />
                  )}
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: subText }}>No friends available to add</Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

export default function GroupsScreen({ navigation }) {
  const [selected, setSelected] = React.useState(null);
  const [showGroupMenu, setShowGroupMenu] = React.useState(false);
  const [groups, setGroups] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedGroupForDelete, setSelectedGroupForDelete] = React.useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const { background, text, subText, surface } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  // Calculate bottom position for FAB - position in bottom right corner
  // Account for bottom tab bar height (~70px)
  const fabBottom = insets.bottom - 17;

  // Subscribe to user groups from Firebase
  React.useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToUserGroups(user.uid, ({ groups, error }) => {
      if (error) {
        console.error('Error loading groups:', error);
        // Still show groups even if there's an error (might be empty array)
      }
      setGroups(groups || []);
      setLoading(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid]);

  // Separate groups into active and expired
  const { activeGroups, expiredGroups } = React.useMemo(() => {
    const now = new Date();
    const active = [];
    const expired = [];
    
    groups.forEach((group) => {
      if (!group.endTime) {
        // Groups without endTime are considered active
        active.push(group);
      } else {
        const endTime = group.endTime instanceof Date ? group.endTime : new Date(group.endTime);
        if (endTime.getTime() > now.getTime()) {
          active.push(group);
        } else {
          expired.push(group);
        }
      }
    });
    
    return { activeGroups: active, expiredGroups: expired };
  }, [groups]);
  
  const handleCreateGroup = () => {
    setShowGroupMenu(false);
    navigation.navigate('CreateGroup');
  };
  
  const handleJoinGroup = () => {
    setShowGroupMenu(false);
    // TODO: Navigate to join group screen
    console.log('Join Group');
  };
  
  // Handle group menu (3 dots) press
  const handleGroupMenuPress = (group) => {
    // Check if user is the owner
    const isOwner = group?.creator === user?.uid;
    if (isOwner) {
      setSelectedGroupForDelete(group);
      setShowDeleteConfirm(true);
    }
  };
  
  // Handle delete group from list
  const confirmDeleteGroup = async () => {
    if (!selectedGroupForDelete?.id || selectedGroupForDelete?.creator !== user?.uid) return;
    
    setDeleting(true);
    try {
      const { error } = await deleteGroup(selectedGroupForDelete.id, user.uid);
      if (error) {
        Alert.alert('Error', error);
      } else {
        Alert.alert('Success', 'Group deleted successfully');
        setSelectedGroupForDelete(null);
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      Alert.alert('Error', error.message || 'Failed to delete group');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };
  
  if (selected) {
    return <GroupDetail group={selected} onBack={() => setSelected(null)} />;
  }
  
  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      <Appbar.Header mode="center-aligned" style={{ backgroundColor: background }}>
        <Appbar.Content title="My Groups" color={text} />
      </Appbar.Header>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {loading ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={IU_CRIMSON} />
            <Text style={{ color: subText, marginTop: 8 }}>Loading groups...</Text>
          </View>
        ) : activeGroups.length > 0 || expiredGroups.length > 0 ? (
          <>
            {/* Active Groups */}
            {activeGroups.map((g) => {
              const isOwner = g?.creator === user?.uid;
              return (
                <GroupCard 
                  key={g.id} 
                  group={g} 
                  onPress={() => setSelected(g)} 
                  onMenuPress={handleGroupMenuPress}
                  showMenu={isOwner}
                />
              );
            })}
            
            {/* Expired Groups Header */}
            {expiredGroups.length > 0 && (
              <Text style={{ 
                color: subText, 
                fontSize: 14, 
                fontWeight: '600', 
                marginTop: activeGroups.length > 0 ? 24 : 0,
                marginBottom: 12,
                textTransform: 'uppercase',
                letterSpacing: 0.5
              }}>
                Expired Groups
              </Text>
            )}
            
            {/* Expired Groups */}
            {expiredGroups.map((g) => {
              const isOwner = g?.creator === user?.uid;
              return (
                <GroupCard 
                  key={g.id} 
                  group={g} 
                  onPress={() => setSelected(g)} 
                  onMenuPress={handleGroupMenuPress}
                  showMenu={isOwner}
                />
              );
            })}
          </>
        ) : (
          <Text style={{ color: subText, textAlign: 'center', padding: 20 }}>No groups yet. Create one to get started!</Text>
        )}
      </ScrollView>
      
      {/* Round FAB button - matches ActivityRecent style */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          right: 16,
          bottom: fabBottom,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: IU_CRIMSON,
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        }}
        onPress={() => setShowGroupMenu(true)}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>
      
      {/* Menu Modal - Create Group or Join Group */}
      <Modal
        visible={showGroupMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowGroupMenu(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowGroupMenu(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' }}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={{ backgroundColor: surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: insets.bottom + 20 }}>
                <Text style={{ color: text, fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' }}>
                  Group Options
                </Text>
                
                {/* Create Group Button */}
                <TouchableOpacity
                  style={{
                    backgroundColor: IU_CRIMSON,
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={handleCreateGroup}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="account-plus" size={24} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginLeft: 12 }}>
                    Create Group
                  </Text>
                </TouchableOpacity>
                
                {/* Join Group Button */}
                <TouchableOpacity
                  style={{
                    backgroundColor: surface,
                    borderRadius: 12,
                    padding: 16,
                    borderWidth: 2,
                    borderColor: IU_CRIMSON,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={handleJoinGroup}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="account-group" size={24} color={IU_CRIMSON} />
                  <Text style={{ color: IU_CRIMSON, fontSize: 16, fontWeight: '600', marginLeft: 12 }}>
                    Join Group
                  </Text>
                </TouchableOpacity>
                
                {/* Cancel Button */}
                <TouchableOpacity
                  style={{
                    marginTop: 12,
                    padding: 12,
                  }}
                  onPress={() => setShowGroupMenu(false)}
                >
                  <Text style={{ color: subText, fontSize: 16, textAlign: 'center' }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      
      {/* Delete Group Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: surface, borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 }}>
            <Text style={{ color: text, fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>
              Delete Group
            </Text>
            <Text style={{ color: subText, fontSize: 16, marginBottom: 20 }}>
              Are you sure you want to delete "{selectedGroupForDelete?.name}"? This action cannot be undone and all messages and data will be permanently deleted.
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button
                mode="text"
                onPress={() => {
                  setShowDeleteConfirm(false);
                  setSelectedGroupForDelete(null);
                }}
                disabled={deleting}
                textColor={text}
                style={{ marginRight: 8 }}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                buttonColor={IU_CRIMSON}
                textColor="#FFFFFF"
                onPress={confirmDeleteGroup}
                disabled={deleting}
                loading={deleting}
              >
                Delete
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}


