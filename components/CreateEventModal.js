// CreateEventModal component - modal for creating new events
import * as React from 'react';
import { View, Modal, TextInput, StyleSheet, TouchableOpacity, Image, ScrollView, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, Platform, Alert, FlatList } from 'react-native';
import { Text, Avatar, Button, Checkbox } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useThemeColors } from '../hooks/useThemeColors';
import { uploadImage } from '../services/storageService';

const IU_CRIMSON = '#DC143C';

export default function CreateEventModal({ visible, onClose, onSubmit, currentUser, event, isEditMode = false, onDelete }) {
  const { surface, text, subText, background, border } = useThemeColors();
  
  // State for event content
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [host, setHost] = React.useState('');
  const [photo, setPhoto] = React.useState(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [friendsOnly, setFriendsOnly] = React.useState(false);
  
  // Date and time state
  const [startDate, setStartDate] = React.useState(new Date());
  const [endDate, setEndDate] = React.useState(new Date());
  const [startTime, setStartTime] = React.useState(new Date());
  const [endTime, setEndTime] = React.useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = React.useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = React.useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = React.useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = React.useState(false);
  

  // Set default host from current user when modal opens, or load event data if editing
  React.useEffect(() => {
    if (visible) {
      if (isEditMode && event) {
        // Load event data for editing
        setName(event.title || '');
        setDescription(event.description || '');
        setLocation(event.location || '');
        setHost(event.host || '');
        setPhoto(event.image || null);
        setFriendsOnly(event.friendsOnly || false);
        
        // Set dates and times
        // Handle backward compatibility: if event.date exists but not startDate/endDate, use date for both
        if (event.startDate) {
          const startD = event.startDate instanceof Date ? event.startDate : event.startDate.toDate ? event.startDate.toDate() : new Date(event.startDate);
          setStartDate(startD);
        } else if (event.date) {
          // Backward compatibility: use date for startDate
          const eventDate = event.date instanceof Date ? event.date : event.date.toDate ? event.date.toDate() : new Date(event.date);
          setStartDate(eventDate);
        }
        
        if (event.endDate) {
          const endD = event.endDate instanceof Date ? event.endDate : event.endDate.toDate ? event.endDate.toDate() : new Date(event.endDate);
          setEndDate(endD);
        } else if (event.date) {
          // Backward compatibility: use date for endDate
          const eventDate = event.date instanceof Date ? event.date : event.date.toDate ? event.date.toDate() : new Date(event.date);
          setEndDate(eventDate);
        }
        
        if (event.startTime) {
          const start = event.startTime instanceof Date ? event.startTime : event.startTime.toDate ? event.startTime.toDate() : new Date(event.startTime);
          setStartTime(start);
        }
        if (event.endTime) {
          const end = event.endTime instanceof Date ? event.endTime : event.endTime.toDate ? event.endTime.toDate() : new Date(event.endTime);
          setEndTime(end);
        }
      } else {
        // Reset form when creating new event
        setName('');
        setDescription('');
        setLocation('');
        setHost(currentUser?.name || currentUser?.username || '');
        setPhoto(null);
        setFriendsOnly(false);
        // Set default dates to today, start time to current hour, end time to 2 hours later
        const now = new Date();
        setStartDate(now);
        setEndDate(now);
        setStartTime(now);
        const endTimeDefault = new Date(now);
        endTimeDefault.setHours(now.getHours() + 2);
        setEndTime(endTimeDefault);
      }
      setSubmitting(false);
      setShowStartDatePicker(false);
      setShowEndDatePicker(false);
      setShowStartTimePicker(false);
      setShowEndTimePicker(false);
    } else {
      // Reset form when modal closes
      setName('');
      setDescription('');
      setLocation('');
      setHost('');
      setPhoto(null);
      setSubmitting(false);
      setShowStartDatePicker(false);
      setShowEndDatePicker(false);
      setShowStartTimePicker(false);
      setShowEndTimePicker(false);
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

  const handleSubmit = async () => {
    Keyboard.dismiss();

    // Validation
    if (!name.trim()) {
      Alert.alert('Error', 'Event name is required.');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Description is required.');
      return;
    }

    if (!location.trim()) {
      Alert.alert('Error', 'Location is required.');
      return;
    }

    if (!host.trim()) {
      Alert.alert('Error', 'Host is required.');
      return;
    }

    // Validate that end date/time is after start date/time
    const startDateTime = new Date(startDate);
    startDateTime.setHours(startTime.getHours());
    startDateTime.setMinutes(startTime.getMinutes());
    startDateTime.setSeconds(0);
    startDateTime.setMilliseconds(0);
    
    const endDateTime = new Date(endDate);
    endDateTime.setHours(endTime.getHours());
    endDateTime.setMinutes(endTime.getMinutes());
    endDateTime.setSeconds(0);
    endDateTime.setMilliseconds(0);
    
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

      // Always call onSubmit even if photo upload failed
      onSubmit({
        name: name.trim(),
        description: description.trim(),
        location: location.trim(),
        host: host.trim(),
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
              <View style={[styles.modal, { backgroundColor: surface }]}>
                <View style={styles.header}>
                  <TouchableOpacity onPress={handleClose} style={styles.cancelButton}>
                    <Text style={[styles.cancelText, { color: text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <View style={styles.titleContainer}>
                    <Text style={[styles.title, { color: text }]}>{isEditMode ? 'Edit Event' : 'Create Event'}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={(!name.trim() || !description.trim() || !location.trim() || !host.trim()) || submitting}
                    style={[
                      styles.submitButton,
                      ((!name.trim() || !description.trim() || !location.trim() || !host.trim()) || submitting) && styles.submitButtonDisabled
                    ]}
                  >
                    <Text style={styles.submitButtonText}>{submitting ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save' : 'Create')}</Text>
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

                    {/* Photo */}
                    <View style={styles.fieldContainer}>
                      <Text style={[styles.label, { color: text }]}>Photo</Text>
                      {photo ? (
                        <View style={styles.photoContainer}>
                          <Image source={{ uri: photo }} style={styles.photoPreview} resizeMode="cover" />
                          <TouchableOpacity style={styles.removePhotoButton} onPress={removePhoto}>
                            <MaterialCommunityIcons name="close-circle" size={24} color="#FF6B6B" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.photoButtons}>
                          <TouchableOpacity style={[styles.photoButton, { borderColor: border, backgroundColor: background }]} onPress={handlePickPhoto}>
                            <MaterialCommunityIcons name="image-outline" size={24} color={text} />
                            <Text style={[styles.photoButtonText, { color: text }]}>Choose from Library</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.photoButton, { borderColor: border, backgroundColor: background }]} onPress={handleTakePhoto}>
                            <MaterialCommunityIcons name="camera-outline" size={24} color={text} />
                            <Text style={[styles.photoButtonText, { color: text }]}>Take Photo</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    {/* Description */}
                    <View style={styles.fieldContainer}>
                      <Text style={[styles.label, { color: text }]}>Description *</Text>
                      <TextInput
                        style={[styles.textArea, { color: text, borderColor: border, backgroundColor: background }]}
                        placeholder="Describe your event"
                        placeholderTextColor={subText}
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={4}
                        maxLength={500}
                        textAlignVertical="top"
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

                    {/* Host */}
                    <View style={styles.fieldContainer}>
                      <Text style={[styles.label, { color: text }]}>Host *</Text>
                      <TextInput
                        style={[styles.input, { color: text, borderColor: border, backgroundColor: background }]}
                        placeholder="Enter host name"
                        placeholderTextColor={subText}
                        value={host}
                        onChangeText={setHost}
                        maxLength={50}
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
                          {startDate.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                        </Text>
                        <MaterialCommunityIcons name="calendar" size={20} color={text} />
                      </TouchableOpacity>
                      {showStartDatePicker && (
                        <DateTimePicker
                          value={startDate}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={(event, selectedDate) => {
                            setShowStartDatePicker(Platform.OS === 'ios');
                            if (selectedDate) {
                              setStartDate(selectedDate);
                              // If end date is before new start date, update end date
                              if (endDate < selectedDate) {
                                setEndDate(selectedDate);
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
                          {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </Text>
                        <MaterialCommunityIcons name="clock-outline" size={20} color={text} />
                      </TouchableOpacity>
                      {showStartTimePicker && (
                        <DateTimePicker
                          value={startTime}
                          mode="time"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={(event, selectedTime) => {
                            setShowStartTimePicker(Platform.OS === 'ios');
                            if (selectedTime) {
                              setStartTime(selectedTime);
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
                          {endDate.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                        </Text>
                        <MaterialCommunityIcons name="calendar" size={20} color={text} />
                      </TouchableOpacity>
                      {showEndDatePicker && (
                        <DateTimePicker
                          value={endDate}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={(event, selectedDate) => {
                            setShowEndDatePicker(Platform.OS === 'ios');
                            if (selectedDate) {
                              setEndDate(selectedDate);
                            }
                          }}
                          minimumDate={startDate}
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
                          {endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </Text>
                        <MaterialCommunityIcons name="clock-outline" size={20} color={text} />
                      </TouchableOpacity>
                      {showEndTimePicker && (
                        <DateTimePicker
                          value={endTime}
                          mode="time"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={(event, selectedTime) => {
                            setShowEndTimePicker(Platform.OS === 'ios');
                            if (selectedTime) {
                              setEndTime(selectedTime);
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

                {/* Delete Button - Only show in edit mode */}
                {isEditMode && (
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    maxHeight: '90%',
    flex: 1,
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

