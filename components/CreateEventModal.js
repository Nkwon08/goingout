// CreateEventModal component - modal for creating new events
import * as React from 'react';
import { View, Modal, TextInput, StyleSheet, TouchableOpacity, Image, ScrollView, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, Platform, Alert, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Avatar, Button, Checkbox } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useThemeColors } from '../hooks/useThemeColors';
import { uploadImage } from '../services/storageService';
import { searchPlaces } from '../services/placesService';
import { getCurrentLocation } from '../services/locationService';

const IU_CRIMSON = '#CC0000';

export default function CreateEventModal({ visible, onClose, onSubmit, currentUser, event, isEditMode = false, onDelete }) {
  const { surface, text, subText, background, border, divider } = useThemeColors();
  const insets = useSafeAreaInsets();
  
  // Step state - only use wizard for new events, keep old UI for edit mode
  const [currentStep, setCurrentStep] = React.useState(1); // 1: Name & Location, 2: Dates, 3: Privacy, 4: Photo
  
  // State for event content
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [host, setHost] = React.useState('');
  const [photo, setPhoto] = React.useState(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [friendsOnly, setFriendsOnly] = React.useState(false);
  
  // Date and time state - combine into datetime
  const [startDateTime, setStartDateTime] = React.useState(() => {
    const now = new Date();
    return new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
  });
  const [endDateTime, setEndDateTime] = React.useState(() => {
    const now = new Date();
    return new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 hours from now
  });
  const [showStartPicker, setShowStartPicker] = React.useState(false);
  const [showEndPicker, setShowEndPicker] = React.useState(false);
  
  // Autocomplete state for location
  const [locationSuggestions, setLocationSuggestions] = React.useState([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = React.useState(false);
  const [searchingPlaces, setSearchingPlaces] = React.useState(false);
  const [userLocation, setUserLocation] = React.useState(null);
  const lastSelectedLocationRef = React.useRef(null);

  // Get user location for autocomplete biasing
  React.useEffect(() => {
    if (visible && !userLocation) {
      getCurrentLocation().then((loc) => {
        if (loc.lat && loc.lng) {
          setUserLocation({ lat: loc.lat, lng: loc.lng });
        }
      });
    }
  }, [visible]);

  // Search places when typing in location (debounced)
  React.useEffect(() => {
    if (!visible) {
      setLocationSuggestions([]);
      setShowLocationSuggestions(false);
      lastSelectedLocationRef.current = null;
      return;
    }
    
    if (location.trim().length < 2) {
      setLocationSuggestions([]);
      setShowLocationSuggestions(false);
      // Clear the ref when input is cleared
      if (!location.trim()) {
        lastSelectedLocationRef.current = null;
      }
      return;
    }
    
    // If the current input matches the last selected location, don't show suggestions
    if (lastSelectedLocationRef.current === location.trim()) {
      setShowLocationSuggestions(false);
      return;
    }
    
    setSearchingPlaces(true);
    const timeoutId = setTimeout(async () => {
      try {
        const results = await searchPlaces(location, userLocation);
        setLocationSuggestions(results || []);
        // Only show suggestions if the current input doesn't exactly match any suggestion
        // and it's not the last selected location
        const hasExactMatch = results?.some(s => s.name === location.trim());
        if (results && results.length > 0 && !hasExactMatch && lastSelectedLocationRef.current !== location.trim()) {
          setShowLocationSuggestions(true);
        } else {
          setShowLocationSuggestions(false);
        }
      } catch (error) {
        console.error('Error searching places:', error);
        setLocationSuggestions([]);
        setShowLocationSuggestions(false);
      } finally {
        setSearchingPlaces(false);
      }
    }, 300); // Debounce 300ms

    return () => clearTimeout(timeoutId);
  }, [location, userLocation, visible]);

  // Set default host from current user when modal opens, or load event data if editing
  React.useEffect(() => {
    if (visible) {
      if (isEditMode && event) {
        // Edit mode - use old UI, don't reset step
        setName(event.title || '');
        setDescription(event.description || '');
        setLocation(event.location || '');
        setHost(event.host || '');
        setPhoto(event.image || null);
        setFriendsOnly(event.friendsOnly || false);
        
        // Combine date and time into datetime
        if (event.startDate && event.startTime) {
          const startD = event.startDate instanceof Date ? event.startDate : event.startDate.toDate ? event.startDate.toDate() : new Date(event.startDate);
          const startT = event.startTime instanceof Date ? event.startTime : event.startTime.toDate ? event.startTime.toDate() : new Date(event.startTime);
          const combined = new Date(startD);
          combined.setHours(startT.getHours());
          combined.setMinutes(startT.getMinutes());
          setStartDateTime(combined);
        } else if (event.date) {
          const eventDate = event.date instanceof Date ? event.date : event.date.toDate ? event.date.toDate() : new Date(event.date);
          setStartDateTime(eventDate);
        }
        
        if (event.endDate && event.endTime) {
          const endD = event.endDate instanceof Date ? event.endDate : event.endDate.toDate ? event.endDate.toDate() : new Date(event.endDate);
          const endT = event.endTime instanceof Date ? event.endTime : event.endTime.toDate ? event.endTime.toDate() : new Date(event.endTime);
          const combined = new Date(endD);
          combined.setHours(endT.getHours());
          combined.setMinutes(endT.getMinutes());
          setEndDateTime(combined);
        } else if (event.date) {
          const eventDate = event.date instanceof Date ? event.date : event.date.toDate ? event.date.toDate() : new Date(event.date);
          const endDate = new Date(eventDate);
          endDate.setHours(eventDate.getHours() + 2);
          setEndDateTime(endDate);
        }
      } else {
        // Reset form when creating new event - use wizard
        setCurrentStep(1);
        setName('');
        setDescription('');
        setLocation('');
        setLocationSuggestions([]);
        setShowLocationSuggestions(false);
        lastSelectedLocationRef.current = null;
        setHost(currentUser?.name || currentUser?.username || '');
        setPhoto(null);
        setFriendsOnly(false);
        // Set default datetimes
        const now = new Date();
        setStartDateTime(new Date(now.getTime() + 60 * 60 * 1000)); // 1 hour from now
        setEndDateTime(new Date(now.getTime() + 3 * 60 * 60 * 1000)); // 3 hours from now
      }
      setSubmitting(false);
      setShowStartPicker(false);
      setShowEndPicker(false);
    } else {
      // Reset form when modal closes
      setCurrentStep(1);
      setName('');
      setDescription('');
      setLocation('');
      setLocationSuggestions([]);
      setShowLocationSuggestions(false);
      setHost('');
      setPhoto(null);
      setSubmitting(false);
      setShowStartPicker(false);
      setShowEndPicker(false);
    }
  }, [visible, currentUser, isEditMode, event]);


  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need your permission to access photos!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setPhoto(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need your permission to use the camera!');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setPhoto(result.assets[0].uri);
    }
  };

  // Step navigation functions
  const handleNext = () => {
    if (currentStep === 1) {
      if (!name.trim()) {
        Alert.alert('Error', 'Please enter an event name', [{ text: 'OK' }]);
        return;
      }
      if (!location.trim()) {
        Alert.alert('Error', 'Please enter a location', [{ text: 'OK' }]);
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (endDateTime <= startDateTime) {
        Alert.alert('Error', 'End date and time must be after start date and time', [{ text: 'OK' }]);
        return;
      }
      const now = new Date();
      if (startDateTime <= now) {
        Alert.alert('Error', 'Start date and time must be in the future', [{ text: 'OK' }]);
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      // No validation needed for privacy selection, proceed to photo step
      setCurrentStep(4);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const formatDateTime = (date) => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleStartDateTimeChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowStartPicker(false);
    }
    if (event.type === 'set' && selectedDate) {
      setStartDateTime(selectedDate);
      // If start time is after end time, update end time to be 1 hour after start
      if (selectedDate >= endDateTime) {
        const newEndTime = new Date(selectedDate.getTime() + 60 * 60 * 1000);
        setEndDateTime(newEndTime);
      }
    }
    if (Platform.OS === 'android' && event.type === 'dismissed') {
      setShowStartPicker(false);
    }
  };

  const handleEndDateTimeChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowEndPicker(false);
    }
    if (event.type === 'set' && selectedDate) {
      setEndDateTime(selectedDate);
    }
    if (Platform.OS === 'android' && event.type === 'dismissed') {
      setShowEndPicker(false);
    }
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();

    // Validation
    if (!name.trim()) {
      Alert.alert('Error', 'Event name is required.');
      return;
    }

    if (!location.trim()) {
      Alert.alert('Error', 'Location is required.');
      return;
    }

    // Validate that end date/time is after start date/time
    if (endDateTime <= startDateTime) {
      Alert.alert('Error', 'End date and time must be after start date and time.');
      return;
    }

    setSubmitting(true);

    try {
      let photoUrl = null;
      
      // Upload photo if provided
      if (photo && currentUser?.uid) {
        const uploadResult = await uploadImage(photo, currentUser.uid, 'events');
        if (uploadResult.url) {
          photoUrl = uploadResult.url;
        } else if (uploadResult.error) {
          // Show error but still allow event creation with local photo URI
          Alert.alert('Upload Error', uploadResult.error + ' Event will be created with local photo.');
          // Continue with local photo URI
        }
      }

      // Extract date and time from datetime for backward compatibility
      const startDate = new Date(startDateTime);
      startDate.setHours(0, 0, 0, 0);
      const startTime = new Date(startDateTime);
      
      const endDate = new Date(endDateTime);
      endDate.setHours(0, 0, 0, 0);
      const endTime = new Date(endDateTime);

      // Always call onSubmit even if photo upload failed
      onSubmit({
        name: name.trim(),
        description: description.trim() || '', // Optional
        location: location.trim(),
        host: host.trim() || (currentUser?.name || currentUser?.username || ''), // Use current user if not provided
        photo: photoUrl || photo, // Use uploaded URL if available, otherwise local URI
        startDate: startDate,
        endDate: endDate,
        startTime: startTime,
        endTime: endTime,
        friendsOnly: friendsOnly,
      });
      
      // Reset submitting state after successful submission
      setSubmitting(false);
    } catch (error) {
      console.error('Error submitting event:', error);
      Alert.alert('Error', 'Failed to create event. Please try again.');
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  const removePhoto = () => {
    setPhoto(null);
  };

  const handleDelete = async () => {
    if (!onDelete || !event?.id) {
      return;
    }

    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await onDelete(event.id);
            } catch (error) {
              console.error('Error deleting event:', error);
              Alert.alert('Error', 'Failed to delete event. Please try again.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  // Render Step 1: Event Name and Location
  const renderStep1 = () => (
    <ScrollView 
      contentContainerStyle={{ 
        flexGrow: 1, 
        justifyContent: 'flex-start', 
        paddingHorizontal: 16,
        paddingTop: Math.max(10, insets.top),
        paddingBottom: 24
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <Text style={{ color: text, fontSize: 22, fontWeight: 'bold', marginBottom: 4, textAlign: 'center' }}>
        What's the event name?
      </Text>
      <Text style={{ color: subText, fontSize: 14, marginBottom: 16, textAlign: 'center' }}>
        Give your event a memorable name
      </Text>
      <TextInput
        style={{
          backgroundColor: background,
          borderRadius: 12,
          padding: 16,
          color: text,
          fontSize: 18,
          marginBottom: 16,
          width: '100%',
          borderWidth: 1,
          borderColor: border,
        }}
        placeholder="Enter event name"
        placeholderTextColor={subText}
        value={name}
        onChangeText={setName}
        maxLength={100}
        autoFocus
      />
      <Text style={{ color: text, fontSize: 22, fontWeight: 'bold', marginBottom: 4, textAlign: 'center' }}>
        Where is the event?
      </Text>
      <Text style={{ color: subText, fontSize: 14, marginBottom: 16, textAlign: 'center' }}>
        Enter the event location
      </Text>
      <View style={{ position: 'relative', width: '100%', marginBottom: 24 }}>
        <TextInput
          style={{
            backgroundColor: background,
            borderRadius: 12,
            padding: 16,
            color: text,
            fontSize: 18,
            width: '100%',
            borderWidth: 1,
            borderColor: border,
          }}
          placeholder="Enter location"
          placeholderTextColor={subText}
          value={location}
          onChangeText={(text) => {
            setLocation(text);
            // Clear the last selected location ref when user types something different
            if (lastSelectedLocationRef.current && text !== lastSelectedLocationRef.current) {
              lastSelectedLocationRef.current = null;
            }
          }}
          onFocus={() => {
            // Only show suggestions if we haven't just selected one
            if (locationSuggestions.length > 0 && lastSelectedLocationRef.current !== location.trim()) {
              setShowLocationSuggestions(true);
            }
          }}
          onBlur={() => {
            // Don't hide suggestions on blur - let user tap on them
          }}
          maxLength={100}
        />
        {/* Autocomplete Suggestions */}
        {showLocationSuggestions && locationSuggestions.length > 0 && (
          <View style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1000,
            backgroundColor: surface,
            borderRadius: 12,
            marginTop: 4,
            maxHeight: 150,
            borderWidth: 1,
            borderColor: border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5,
          }}>
            <ScrollView 
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              {locationSuggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={suggestion.id || index}
                  activeOpacity={0.7}
                  onPressIn={() => {
                    // Prevent blur from interfering
                  }}
                  onPress={() => {
                    const selectedName = suggestion.name;
                    // Track the selected location FIRST to prevent suggestions from showing
                    lastSelectedLocationRef.current = selectedName;
                    setLocation(selectedName);
                    // Clear suggestions immediately
                    setLocationSuggestions([]);
                    setShowLocationSuggestions(false);
                    // Blur the input to dismiss keyboard
                    Keyboard.dismiss();
                  }}
                  style={{
                    padding: 14,
                    borderBottomWidth: index < locationSuggestions.length - 1 ? 1 : 0,
                    borderBottomColor: divider,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="map-marker" size={18} color={IU_CRIMSON} style={{ marginRight: 8 }} />
                    <Text style={{ color: text, fontSize: 14, flex: 1 }}>{suggestion.name}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
      <Button
        mode="contained"
        buttonColor={IU_CRIMSON}
        textColor="#FFFFFF"
        onPress={handleNext}
        disabled={!name.trim() || !location.trim()}
        icon="arrow-right"
        contentStyle={{ flexDirection: 'row-reverse', paddingVertical: 8 }}
        style={{ width: '100%', marginTop: 8 }}
      >
        Next
      </Button>
    </ScrollView>
  );

  // Render Step 2: Start Date and End Date
  const renderStep2 = () => (
    <ScrollView 
      contentContainerStyle={{ 
        padding: 16, 
        paddingTop: Math.max(20, insets.top + 10)
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={{ color: text, fontSize: 24, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
        When is the event?
      </Text>
      <Text style={{ color: subText, fontSize: 16, marginBottom: 32, textAlign: 'center' }}>
        Set the start and end date and time for your event
      </Text>

      {/* Start Date/Time */}
      <Text style={{ color: text, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
        Start Date & Time *
      </Text>
      <TouchableOpacity
        style={{
          backgroundColor: background,
          borderRadius: 12,
          padding: 16,
          marginBottom: showStartPicker ? 0 : 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderWidth: showStartPicker ? 2 : 1,
          borderColor: showStartPicker ? IU_CRIMSON : border,
        }}
        onPress={() => {
          setShowEndPicker(false);
          setShowStartPicker(!showStartPicker);
        }}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <MaterialCommunityIcons name="calendar-clock" size={24} color={IU_CRIMSON} />
          <Text style={{ color: text, fontSize: 18, marginLeft: 12, fontWeight: showStartPicker ? '600' : '400' }}>
            {formatDateTime(startDateTime)}
          </Text>
        </View>
        <MaterialCommunityIcons 
          name={showStartPicker ? "chevron-up" : "chevron-down"} 
          size={24} 
          color={showStartPicker ? IU_CRIMSON : subText} 
        />
      </TouchableOpacity>

      {/* Start Date/Time Picker */}
      {showStartPicker && (
        <View
          style={{
            backgroundColor: background,
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: divider,
          }}
        >
          {Platform.OS === 'ios' ? (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ color: text, fontSize: 16, fontWeight: '600' }}>Select Start Date & Time</Text>
                <TouchableOpacity
                  onPress={() => setShowStartPicker(false)}
                  style={{
                    backgroundColor: IU_CRIMSON,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={startDateTime}
                mode="datetime"
                display="spinner"
                onChange={handleStartDateTimeChange}
                minimumDate={new Date()}
                maximumDate={endDateTime}
                textColor={text}
              />
            </>
          ) : (
            <DateTimePicker
              value={startDateTime}
              mode="datetime"
              display="default"
              onChange={handleStartDateTimeChange}
              minimumDate={new Date()}
              maximumDate={endDateTime}
            />
          )}
        </View>
      )}

      {/* End Date/Time */}
      <Text style={{ color: text, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
        End Date & Time *
      </Text>
      <TouchableOpacity
        style={{
          backgroundColor: background,
          borderRadius: 12,
          padding: 16,
          marginBottom: showEndPicker ? 0 : 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderWidth: showEndPicker ? 2 : 1,
          borderColor: showEndPicker ? IU_CRIMSON : border,
        }}
        onPress={() => {
          setShowStartPicker(false);
          setShowEndPicker(!showEndPicker);
        }}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <MaterialCommunityIcons name="calendar-clock" size={24} color={IU_CRIMSON} />
          <Text style={{ color: text, fontSize: 18, marginLeft: 12, fontWeight: showEndPicker ? '600' : '400' }}>
            {formatDateTime(endDateTime)}
          </Text>
        </View>
        <MaterialCommunityIcons 
          name={showEndPicker ? "chevron-up" : "chevron-down"} 
          size={24} 
          color={showEndPicker ? IU_CRIMSON : subText} 
        />
      </TouchableOpacity>

      {/* End Date/Time Picker */}
      {showEndPicker && (
        <View
          style={{
            backgroundColor: background,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: divider,
          }}
        >
          {Platform.OS === 'ios' ? (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ color: text, fontSize: 16, fontWeight: '600' }}>Select End Date & Time</Text>
                <TouchableOpacity
                  onPress={() => setShowEndPicker(false)}
                  style={{
                    backgroundColor: IU_CRIMSON,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={endDateTime}
                mode="datetime"
                display="spinner"
                onChange={handleEndDateTimeChange}
                minimumDate={startDateTime}
                textColor={text}
              />
            </>
          ) : (
            <DateTimePicker
              value={endDateTime}
              mode="datetime"
              display="default"
              onChange={handleEndDateTimeChange}
              minimumDate={startDateTime}
            />
          )}
        </View>
      )}

      {/* Navigation Buttons */}
      <Button
        mode="contained"
        buttonColor={IU_CRIMSON}
        textColor="#FFFFFF"
        onPress={handleNext}
        disabled={endDateTime <= startDateTime || startDateTime <= new Date()}
        icon="arrow-right"
        contentStyle={{ flexDirection: 'row-reverse', paddingVertical: 8 }}
        style={{ width: '100%', marginTop: 24 }}
      >
        Next
      </Button>
      <Button
        mode="outlined"
        textColor={text}
        onPress={handleBack}
        style={{ marginTop: 8, width: '100%' }}
        contentStyle={{ paddingVertical: 8 }}
      >
        Back
      </Button>
    </ScrollView>
  );

  // Render Step 3: Privacy Settings
  const renderStep3 = () => (
    <ScrollView 
      contentContainerStyle={{ 
        flexGrow: 1, 
        justifyContent: 'flex-start', 
        paddingHorizontal: 16,
        paddingTop: Math.max(20, insets.top + 10),
        paddingBottom: 24
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={{ color: text, fontSize: 24, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
        Who can see this event?
      </Text>
      <Text style={{ color: subText, fontSize: 16, marginBottom: 32, textAlign: 'center' }}>
        Choose who can view your event
      </Text>

      {/* Public Option */}
      <TouchableOpacity
        style={{
          backgroundColor: !friendsOnly ? IU_CRIMSON : background,
          borderRadius: 12,
          padding: 20,
          marginBottom: 16,
          borderWidth: 2,
          borderColor: !friendsOnly ? IU_CRIMSON : border,
          flexDirection: 'row',
          alignItems: 'center',
        }}
        onPress={() => setFriendsOnly(false)}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons 
          name="earth" 
          size={28} 
          color={!friendsOnly ? '#FFFFFF' : text} 
        />
        <View style={{ marginLeft: 16, flex: 1 }}>
          <Text style={{ color: !friendsOnly ? '#FFFFFF' : text, fontSize: 18, fontWeight: '600' }}>
            Share with Everyone
          </Text>
          <Text style={{ color: !friendsOnly ? 'rgba(255,255,255,0.8)' : subText, fontSize: 14, marginTop: 4 }}>
            Anyone can see and join this event
          </Text>
        </View>
        {!friendsOnly && (
          <MaterialCommunityIcons name="check-circle" size={24} color="#FFFFFF" />
        )}
      </TouchableOpacity>

      {/* Friends Only Option */}
      <TouchableOpacity
        style={{
          backgroundColor: friendsOnly ? IU_CRIMSON : background,
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
          borderWidth: 2,
          borderColor: friendsOnly ? IU_CRIMSON : border,
          flexDirection: 'row',
          alignItems: 'center',
        }}
        onPress={() => setFriendsOnly(true)}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons 
          name="account-group" 
          size={28} 
          color={friendsOnly ? '#FFFFFF' : text} 
        />
        <View style={{ marginLeft: 16, flex: 1 }}>
          <Text style={{ color: friendsOnly ? '#FFFFFF' : text, fontSize: 18, fontWeight: '600' }}>
            Share with Friends Only
          </Text>
          <Text style={{ color: friendsOnly ? 'rgba(255,255,255,0.8)' : subText, fontSize: 14, marginTop: 4 }}>
            Only your friends can see this event
          </Text>
        </View>
        {friendsOnly && (
          <MaterialCommunityIcons name="check-circle" size={24} color="#FFFFFF" />
        )}
      </TouchableOpacity>

      {/* Navigation Buttons */}
      <Button
        mode="contained"
        buttonColor={IU_CRIMSON}
        textColor="#FFFFFF"
        onPress={handleNext}
        icon="arrow-right"
        contentStyle={{ flexDirection: 'row-reverse', paddingVertical: 8 }}
        style={{ width: '100%', marginTop: 8 }}
      >
        Next
      </Button>
      <Button
        mode="outlined"
        textColor={text}
        onPress={handleBack}
        style={{ marginTop: 8, width: '100%' }}
        contentStyle={{ paddingVertical: 8 }}
      >
        Back
      </Button>
    </ScrollView>
  );

  // Render Step 4: Cover Photo
  const renderStep4 = () => (
    <ScrollView 
      contentContainerStyle={{ 
        flexGrow: 1, 
        justifyContent: 'flex-start', 
        paddingHorizontal: 16,
        paddingTop: Math.max(20, insets.top + 10),
        paddingBottom: 24
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={{ color: text, fontSize: 24, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
        Add a cover photo
      </Text>
      <Text style={{ color: subText, fontSize: 16, marginBottom: 32, textAlign: 'center' }}>
        Choose a photo to represent your event (optional)
      </Text>

      {/* Photo Preview or Selection */}
      {photo ? (
        <View style={{ marginBottom: 24, alignItems: 'center' }}>
          <View style={{ position: 'relative', width: '100%', borderRadius: 12, overflow: 'hidden' }}>
            <Image 
              source={{ uri: photo }} 
              style={{ 
                width: '100%', 
                height: 300, 
                borderRadius: 12,
                backgroundColor: background
              }} 
              resizeMode="cover" 
            />
            <TouchableOpacity 
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                borderRadius: 20,
                padding: 8,
              }}
              onPress={() => setPhoto(null)}
            >
              <MaterialCommunityIcons name="close-circle" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={{ marginBottom: 24 }}>
          <View style={{ 
            flexDirection: 'row', 
            gap: 12, 
            marginBottom: 12 
          }}>
            <TouchableOpacity 
              style={{
                flex: 1,
                backgroundColor: background,
                borderRadius: 12,
                padding: 20,
                borderWidth: 2,
                borderColor: border,
                borderStyle: 'dashed',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 120,
              }}
              onPress={handlePickPhoto}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="image-outline" size={32} color={text} />
              <Text style={{ color: text, fontSize: 14, fontWeight: '600', marginTop: 8, textAlign: 'center' }}>
                Choose from Library
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={{
                flex: 1,
                backgroundColor: background,
                borderRadius: 12,
                padding: 20,
                borderWidth: 2,
                borderColor: border,
                borderStyle: 'dashed',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 120,
              }}
              onPress={handleTakePhoto}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="camera-outline" size={32} color={text} />
              <Text style={{ color: text, fontSize: 14, fontWeight: '600', marginTop: 8, textAlign: 'center' }}>
                Take Photo
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={{
              backgroundColor: background,
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: border,
              alignItems: 'center',
            }}
            onPress={() => {
              // Skip photo, proceed to create
              handleSubmit();
            }}
            activeOpacity={0.7}
          >
            <Text style={{ color: subText, fontSize: 16 }}>
              Skip for now
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Create Button */}
      <Button
        mode="contained"
        buttonColor={IU_CRIMSON}
        textColor="#FFFFFF"
        onPress={handleSubmit}
        disabled={submitting}
        loading={submitting}
        icon="check"
        contentStyle={{ paddingVertical: 8 }}
        style={{ width: '100%', marginTop: 8 }}
      >
        {submitting ? 'Creating...' : 'Create Event'}
      </Button>
      <Button
        mode="outlined"
        textColor={text}
        onPress={handleBack}
        style={{ marginTop: 8, width: '100%' }}
        contentStyle={{ paddingVertical: 8 }}
      >
        Back
      </Button>
    </ScrollView>
  );

  // For edit mode, use separate date/time state
  const [editStartDate, setEditStartDate] = React.useState(() => {
    const d = new Date(startDateTime);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [editStartTime, setEditStartTime] = React.useState(() => new Date(startDateTime));
  const [editEndDate, setEditEndDate] = React.useState(() => {
    const d = new Date(endDateTime);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [editEndTime, setEditEndTime] = React.useState(() => new Date(endDateTime));
  const [showStartDatePicker, setShowStartDatePicker] = React.useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = React.useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = React.useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = React.useState(false);

  // Sync edit mode date/time state with datetime only when modal opens or event data loads
  React.useEffect(() => {
    if (isEditMode && visible) {
      const startD = new Date(startDateTime);
      startD.setHours(0, 0, 0, 0);
      setEditStartDate(startD);
      setEditStartTime(new Date(startDateTime));
      
      const endD = new Date(endDateTime);
      endD.setHours(0, 0, 0, 0);
      setEditEndDate(endD);
      setEditEndTime(new Date(endDateTime));
    }
  }, [isEditMode, visible]); // Only sync when modal opens, not on every datetime change

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? -insets.top : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={[isEditMode ? styles.overlay : styles.overlayFullScreen, { backgroundColor: isEditMode ? 'transparent' : surface }]}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[isEditMode ? styles.modal : styles.modalFullScreen, { backgroundColor: surface }]}>
                {isEditMode ? (
                  // Edit Mode - Old UI
                  <>
                    <View style={styles.header}>
                      <TouchableOpacity onPress={handleClose} style={styles.cancelButton}>
                        <Text style={[styles.cancelText, { color: text }]}>Cancel</Text>
                      </TouchableOpacity>
                      <View style={styles.titleContainer}>
                        <Text style={[styles.title, { color: text }]}>Edit Event</Text>
                      </View>
                      <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={(!name.trim() || !location.trim()) || submitting}
                        style={[
                          styles.submitButton,
                          ((!name.trim() || !location.trim()) || submitting) && styles.submitButtonDisabled
                        ]}
                      >
                        <Text style={styles.submitButtonText}>{submitting ? 'Saving...' : 'Save'}</Text>
                      </TouchableOpacity>
                    </View>
                    <ScrollView
                      style={styles.scrollContent}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                    >
                      <View style={styles.content}>
                        {/* Name */}
                        <View style={styles.fieldContainer}>
                          <Text style={[styles.label, { color: text }]}>Event Name *</Text>
                          <TextInput
                            style={[styles.input, { color: text, borderColor: border, backgroundColor: background }]}
                            placeholder="Enter event name"
                            placeholderTextColor={subText}
                            value={name}
                            onChangeText={setName}
                            maxLength={100}
                          />
                        </View>
                        {/* Location */}
                        <View style={styles.fieldContainer}>
                          <Text style={[styles.label, { color: text }]}>Location *</Text>
                          <TextInput
                            style={[styles.input, { color: text, borderColor: border, backgroundColor: background }]}
                            placeholder="Enter event location"
                            placeholderTextColor={subText}
                            value={location}
                            onChangeText={setLocation}
                            maxLength={100}
                          />
                        </View>
                        {/* Start Date */}
                        <View style={styles.fieldContainer}>
                          <Text style={[styles.label, { color: text }]}>Start Date *</Text>
                          <TouchableOpacity
                            style={[styles.input, styles.dateTimeInput, { borderColor: border, backgroundColor: background }]}
                            onPress={() => setShowStartDatePicker(true)}
                          >
                            <Text style={[styles.dateTimeText, { color: text }]}>
                              {editStartDate.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                            </Text>
                            <MaterialCommunityIcons name="calendar" size={20} color={text} />
                          </TouchableOpacity>
                          {showStartDatePicker && (
                            <DateTimePicker
                              value={editStartDate}
                              mode="date"
                              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                              onChange={(event, selectedDate) => {
                                setShowStartDatePicker(Platform.OS === 'ios');
                                if (selectedDate) {
                                  setEditStartDate(selectedDate);
                                  // Update datetime directly
                                  const newStart = new Date(selectedDate);
                                  newStart.setHours(editStartTime.getHours());
                                  newStart.setMinutes(editStartTime.getMinutes());
                                  setStartDateTime(newStart);
                                  if (editEndDate < selectedDate) {
                                    setEditEndDate(selectedDate);
                                    const newEnd = new Date(selectedDate);
                                    newEnd.setHours(editEndTime.getHours());
                                    newEnd.setMinutes(editEndTime.getMinutes());
                                    setEndDateTime(newEnd);
                                  }
                                }
                              }}
                              minimumDate={new Date()}
                            />
                          )}
                        </View>
                        {/* Start Time */}
                        <View style={styles.fieldContainer}>
                          <Text style={[styles.label, { color: text }]}>Start Time *</Text>
                          <TouchableOpacity
                            style={[styles.input, styles.dateTimeInput, { borderColor: border, backgroundColor: background }]}
                            onPress={() => setShowStartTimePicker(true)}
                          >
                            <Text style={[styles.dateTimeText, { color: text }]}>
                              {editStartTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                            </Text>
                            <MaterialCommunityIcons name="clock-outline" size={20} color={text} />
                          </TouchableOpacity>
                          {showStartTimePicker && (
                            <DateTimePicker
                              value={editStartTime}
                              mode="time"
                              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                              onChange={(event, selectedTime) => {
                                setShowStartTimePicker(Platform.OS === 'ios');
                                if (selectedTime) {
                                  setEditStartTime(selectedTime);
                                  // Update datetime directly
                                  const newStart = new Date(editStartDate);
                                  newStart.setHours(selectedTime.getHours());
                                  newStart.setMinutes(selectedTime.getMinutes());
                                  setStartDateTime(newStart);
                                }
                              }}
                            />
                          )}
                        </View>
                        {/* End Date */}
                        <View style={styles.fieldContainer}>
                          <Text style={[styles.label, { color: text }]}>End Date *</Text>
                          <TouchableOpacity
                            style={[styles.input, styles.dateTimeInput, { borderColor: border, backgroundColor: background }]}
                            onPress={() => setShowEndDatePicker(true)}
                          >
                            <Text style={[styles.dateTimeText, { color: text }]}>
                              {editEndDate.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                            </Text>
                            <MaterialCommunityIcons name="calendar" size={20} color={text} />
                          </TouchableOpacity>
                          {showEndDatePicker && (
                            <DateTimePicker
                              value={editEndDate}
                              mode="date"
                              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                              onChange={(event, selectedDate) => {
                                setShowEndDatePicker(Platform.OS === 'ios');
                                if (selectedDate) {
                                  setEditEndDate(selectedDate);
                                  // Update datetime directly
                                  const newEnd = new Date(selectedDate);
                                  newEnd.setHours(editEndTime.getHours());
                                  newEnd.setMinutes(editEndTime.getMinutes());
                                  setEndDateTime(newEnd);
                                }
                              }}
                              minimumDate={editStartDate}
                            />
                          )}
                        </View>
                        {/* End Time */}
                        <View style={styles.fieldContainer}>
                          <Text style={[styles.label, { color: text }]}>End Time *</Text>
                          <TouchableOpacity
                            style={[styles.input, styles.dateTimeInput, { borderColor: border, backgroundColor: background }]}
                            onPress={() => setShowEndTimePicker(true)}
                          >
                            <Text style={[styles.dateTimeText, { color: text }]}>
                              {editEndTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                            </Text>
                            <MaterialCommunityIcons name="clock-outline" size={20} color={text} />
                          </TouchableOpacity>
                          {showEndTimePicker && (
                            <DateTimePicker
                              value={editEndTime}
                              mode="time"
                              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                              onChange={(event, selectedTime) => {
                                setShowEndTimePicker(Platform.OS === 'ios');
                                if (selectedTime) {
                                  setEditEndTime(selectedTime);
                                  // Update datetime directly
                                  const newEnd = new Date(editEndDate);
                                  newEnd.setHours(selectedTime.getHours());
                                  newEnd.setMinutes(selectedTime.getMinutes());
                                  setEndDateTime(newEnd);
                                }
                              }}
                            />
                          )}
                        </View>
                        {/* Friends Only Toggle */}
                        <View style={styles.fieldContainer}>
                          <TouchableOpacity
                            style={[styles.friendsOnlyContainer, { borderColor: border, backgroundColor: background }]}
                            onPress={() => setFriendsOnly(!friendsOnly)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.friendsOnlyContent}>
                              <MaterialCommunityIcons 
                                name={friendsOnly ? "account-group" : "account-group-outline"} 
                                size={24} 
                                color={friendsOnly ? IU_CRIMSON : text} 
                              />
                              <View style={styles.friendsOnlyTextContainer}>
                                <Text style={[styles.friendsOnlyLabel, { color: text }]}>Share with friends only</Text>
                                <Text style={[styles.friendsOnlyDescription, { color: subText }]}>
                                  Only your friends will be able to see this event
                                </Text>
                              </View>
                            </View>
                            <Checkbox
                              status={friendsOnly ? 'checked' : 'unchecked'}
                              onPress={() => setFriendsOnly(!friendsOnly)}
                              color={IU_CRIMSON}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </ScrollView>
                    {/* Delete Button */}
                    <View style={styles.deleteContainer}>
                      <Button
                        mode="outlined"
                        textColor="#FF6B6B"
                        onPress={handleDelete}
                        loading={deleting}
                        disabled={deleting}
                        icon="delete"
                        style={styles.deleteButton}
                      >
                        Delete Event
                      </Button>
                    </View>
                  </>
                ) : (
                  // New Event - Wizard UI
                  <>
                    <View style={[styles.header, { paddingTop: Math.max(10, insets.top + 10) }]}>
                      <TouchableOpacity onPress={handleClose} style={styles.cancelButton}>
                        <Text style={[styles.cancelText, { color: text }]}>Cancel</Text>
                      </TouchableOpacity>
                      <View style={styles.titleContainer}>
                        <Text style={[styles.title, { color: text }]}>Step {currentStep} of 4</Text>
                      </View>
                      <View style={{ width: 64 }} />
                    </View>

                    {/* Progress Indicator */}
                    <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: surface }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', position: 'relative', paddingVertical: 2 }}>
                        {[1, 2, 3, 4].map((step, index) => (
                          <React.Fragment key={step}>
                            <View style={{ alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                              <View
                                style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: 18,
                                  backgroundColor: currentStep >= step ? IU_CRIMSON : background,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderWidth: 2,
                                  borderColor: currentStep >= step ? IU_CRIMSON : divider,
                                }}
                              >
                                {currentStep > step ? (
                                  <MaterialCommunityIcons name="check" size={20} color="#FFFFFF" />
                                ) : (
                                  <Text style={{ color: currentStep >= step ? '#FFFFFF' : subText, fontWeight: '600', fontSize: 16 }}>
                                    {step}
                                  </Text>
                                )}
                              </View>
                            </View>
                            {index < 3 && (
                              <View style={{ flex: 1, height: 2, marginHorizontal: 4, position: 'relative', justifyContent: 'center' }}>
                                <View
                                  style={{
                                    position: 'absolute',
                                    left: 0,
                                    right: 0,
                                    height: 2,
                                    backgroundColor: divider,
                                    zIndex: 0,
                                  }}
                                />
                                {currentStep > step && (
                                  <View
                                    style={{
                                      position: 'absolute',
                                      left: 0,
                                      right: 0,
                                      height: 2,
                                      backgroundColor: IU_CRIMSON,
                                      zIndex: 1,
                                    }}
                                  />
                                )}
                              </View>
                            )}
                          </React.Fragment>
                        ))}
                      </View>
                    </View>

                    {/* Step Content */}
                    <View style={{ flex: 1, width: '100%' }}>
                      {currentStep === 1 && renderStep1()}
                      {currentStep === 2 && renderStep2()}
                      {currentStep === 3 && renderStep3()}
                      {currentStep === 4 && renderStep4()}
                    </View>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  overlayFullScreen: {
    flex: 1,
  },
  modal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    maxHeight: '90%',
    flex: 1,
  },
  modalFullScreen: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  scrollContent: {
    flexGrow: 1,
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
    fontSize: 18,
    fontWeight: '700',
  },
  cancelText: {
    fontSize: 16,
  },
  submitButton: {
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
  submitButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  content: {
    padding: 16,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  photoContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dateTimeInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateTimeText: {
    fontSize: 16,
  },
  deleteContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#D0CFCD',
  },
  deleteButton: {
    borderColor: '#FF6B6B',
  },
  friendsOnlyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  friendsOnlyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  friendsOnlyTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  friendsOnlyLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  friendsOnlyDescription: {
    fontSize: 13,
  },
});

