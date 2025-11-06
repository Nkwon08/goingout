// CreateEventModal component - modal for creating new events
import * as React from 'react';
import { View, Modal, TextInput, StyleSheet, TouchableOpacity, Image, ScrollView, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Text, Avatar, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useThemeColors } from '../hooks/useThemeColors';
import { uploadImage } from '../services/storageService';

const IU_CRIMSON = '#990000';

export default function CreateEventModal({ visible, onClose, onSubmit, currentUser }) {
  const { surface, text, subText, background, border } = useThemeColors();
  
  // State for event content
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [host, setHost] = React.useState('');
  const [photo, setPhoto] = React.useState(null);
  const [submitting, setSubmitting] = React.useState(false);
  
  // Date and time state
  const [date, setDate] = React.useState(new Date());
  const [startTime, setStartTime] = React.useState(new Date());
  const [endTime, setEndTime] = React.useState(new Date());
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = React.useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = React.useState(false);

  // Set default host from current user when modal opens
  React.useEffect(() => {
    if (visible) {
      // Reset form when modal opens
      setName('');
      setDescription('');
      setLocation('');
      setHost(currentUser?.name || currentUser?.username || '');
      setPhoto(null);
      setSubmitting(false);
      // Set default date to today, start time to current hour, end time to 2 hours later
      const now = new Date();
      setDate(now);
      setStartTime(now);
      const endTimeDefault = new Date(now);
      endTimeDefault.setHours(now.getHours() + 2);
      setEndTime(endTimeDefault);
      setShowDatePicker(false);
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
      setShowDatePicker(false);
      setShowStartTimePicker(false);
      setShowEndTimePicker(false);
    }
  }, [visible, currentUser]);

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

    // Validate that end time is after start time
    const startDateTime = new Date(date);
    startDateTime.setHours(startTime.getHours());
    startDateTime.setMinutes(startTime.getMinutes());
    
    const endDateTime = new Date(date);
    endDateTime.setHours(endTime.getHours());
    endDateTime.setMinutes(endTime.getMinutes());
    
    if (endDateTime <= startDateTime) {
      Alert.alert('Error', 'End time must be after start time.');
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
        date: date,
        startTime: startTime,
        endTime: endTime,
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
                    <Text style={[styles.title, { color: text }]}>Create Event</Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={(!name.trim() || !description.trim() || !location.trim() || !host.trim()) || submitting}
                    style={[
                      styles.submitButton,
                      ((!name.trim() || !description.trim() || !location.trim() || !host.trim()) || submitting) && styles.submitButtonDisabled
                    ]}
                  >
                    <Text style={styles.submitButtonText}>{submitting ? 'Creating...' : 'Create'}</Text>
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

                    {/* Date */}
                    <View style={styles.fieldContainer}>
                      <Text style={[styles.label, { color: text }]}>Date *</Text>
                      <TouchableOpacity
                        style={[styles.input, styles.dateTimeInput, { borderColor: border, backgroundColor: background }]}
                        onPress={() => setShowDatePicker(true)}
                      >
                        <Text style={[styles.dateTimeText, { color: text }]}>
                          {date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                        </Text>
                        <MaterialCommunityIcons name="calendar" size={20} color={text} />
                      </TouchableOpacity>
                      {showDatePicker && (
                        <DateTimePicker
                          value={date}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={(event, selectedDate) => {
                            setShowDatePicker(Platform.OS === 'ios');
                            if (selectedDate) {
                              setDate(selectedDate);
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
                  </View>
                </ScrollView>
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
});

