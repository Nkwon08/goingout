import * as React from 'react';
import { View, Modal, TextInput, StyleSheet, TouchableOpacity, Image, ScrollView, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { Text, Avatar, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { albums } from '../data/mock';
import { useThemeColors } from '../hooks/useThemeColors';

const IU_CRIMSON = '#990000';

export default function ComposePost({ visible, onClose, onSubmit, currentUser }) {
  const [text, setText] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [images, setImages] = React.useState([]);
  const [chooseFromOutlink, setChooseFromOutlink] = React.useState(false);
  const { background, surface, text: textColor, subText, divider } = useThemeColors();

  const appImages = React.useMemo(() => {
    try {
      return (albums || []).flatMap((a) => a.photos || []);
    } catch {
      return [];
    }
  }, []);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need camera roll permissions!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const newImages = result.assets.map(asset => asset.uri);
      setImages((prev) => [...prev, ...newImages]);
    }
  };

  const handleSubmit = () => {
    Keyboard.dismiss();
    if (text.trim()) {
      onSubmit({
        text: text.trim(),
        location: location.trim() || null,
        image: images.length > 0 ? images[0] : null,
        images: images.length > 0 ? images : null,
      });
      setText('');
      setLocation('');
      setImages([]);
      onClose();
    }
  };

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modal}>
              <View style={styles.header}>
                <TouchableOpacity onPress={handleClose}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
            <Text style={styles.title}>New Post</Text>
            <Button
              mode="contained"
              buttonColor={IU_CRIMSON}
              textColor="#FFFFFF"
              onPress={handleSubmit}
              disabled={!text.trim()}
              style={styles.postButton}
            >
              Post
            </Button>
          </View>

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
              />
              {images.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesPreview}>
                  {images.map((img, index) => (
                    <View key={index} style={styles.imagePreview}>
                      <Image source={{ uri: img }} style={styles.previewImage} />
                      <TouchableOpacity style={styles.removeImage} onPress={() => removeImage(index)}>
                        <MaterialCommunityIcons name="close-circle" size={24} color="#FF6B6B" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
              <View style={styles.locationRow}>
                <MaterialCommunityIcons name="map-marker-outline" size={20} color="#666666" />
                <TextInput
                  style={styles.locationInput}
                  placeholder="Location (optional)"
                  placeholderTextColor="#666666"
                  value={location}
                  onChangeText={setLocation}
                  returnKeyType="done"
                  blurOnSubmit={true}
                  onSubmitEditing={Keyboard.dismiss}
                />
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.actionButton} onPress={handlePickImage}>
              <MaterialCommunityIcons name="image-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => setChooseFromOutlink(true)}>
              <MaterialCommunityIcons name="image-multiple-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.charCount}>{text.length}/280</Text>
          </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>

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
              {appImages.map((uri, idx) => (
                <TouchableOpacity key={idx} style={styles.gridItem} onPress={() => { setImages((prev) => [...prev, uri]); }}>
                  <Image source={{ uri }} style={styles.gridImage} />
                </TouchableOpacity>
              ))}
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
  title: {
    color: '#1A1A1A',
    fontSize: 18,
    fontWeight: '700',
  },
  postButton: {
    borderRadius: 20,
  },
  content: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
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
  },
  imagesPreview: {
    marginTop: 12,
  },
  imagePreview: {
    marginRight: 12,
    position: 'relative',
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  removeImage: {
    position: 'absolute',
    top: 8,
    right: 8,
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
    marginTop: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#23283B',
  },
  locationInput: {
    flex: 1,
    color: '#1A1A1A',
    fontSize: 14,
    marginLeft: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#23283B',
  },
  actionButton: {
    padding: 8,
  },
  charCount: {
    color: '#666666',
    fontSize: 14,
  },
});

