import * as React from 'react';
import { View, ScrollView, Image, TouchableOpacity, Modal, TouchableWithoutFeedback, ActivityIndicator, Alert, TextInput, Keyboard } from 'react-native';
import { Appbar, FAB, Text, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import MapView, { Marker } from 'react-native-maps';
import { GiftedChat } from 'react-native-gifted-chat';
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GroupCard from '../components/GroupCard';
import PollCard from '../components/PollCard';
import { polls } from '../data/mock';
import { useGroupPhotos } from '../context/GroupPhotosContext';
import { useThemeColors } from '../hooks/useThemeColors';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { subscribeToUserGroups, deleteGroup } from '../services/groupsService';

const TopTab = createMaterialTopTabNavigator();

const IU_CRIMSON = '#990000';

function MapTab() {
  const { background, subText } = useThemeColors();
  const region = { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.05, longitudeDelta: 0.05 };
  const members = []; // Empty - will come from Firebase
  
  return (
    <View style={{ flex: 1, backgroundColor: background, justifyContent: 'center', alignItems: 'center' }}>
      {members.length > 0 ? (
        <MapView style={{ flex: 1 }} initialRegion={region}>
          {members.map((m) => (
            <Marker key={m.id} coordinate={{ latitude: m.lat, longitude: m.lng }} title={m.name} />
          ))}
        </MapView>
      ) : (
        <Text style={{ color: subText }}>Empty</Text>
      )}
    </View>
  );
}

function ChatTab({ groupId }) {
  const { background, subText, surface, text } = useThemeColors();
  const { isDarkMode } = useTheme();
  const { user, userData } = useAuth();
  const [messages, setMessages] = React.useState([]);
  const [sending, setSending] = React.useState(false);
  const [showMediaPicker, setShowMediaPicker] = React.useState(false);
  const inputRef = React.useRef(null);
  
  const groupChatService = require('../services/groupChatService');
  const { sendMessage, sendImageMessage, sendVideoMessage, subscribeToMessages } = groupChatService;
  
  // Determine chat colors based on dark mode
  const chatBackground = isDarkMode ? '#000000' : '#F5F5F5';
  const inputBackground = isDarkMode ? '#1C1C1E' : '#F2F2F7';
  const inputBorder = isDarkMode ? '#38383A' : '#E5E5EA';
  const bubbleOwn = isDarkMode ? '#0A84FF' : '#007AFF'; // iOS blue
  const bubbleOther = isDarkMode ? '#2C2C2E' : '#E5E5EA';
  const textOwn = '#FFFFFF';
  const textOther = isDarkMode ? '#FFFFFF' : '#000000';
  const textSecondary = isDarkMode ? '#8E8E93' : '#8E8E93';
  
  // Subscribe to messages when groupId changes
  React.useEffect(() => {
    if (!groupId || !user?.uid) {
      setMessages([]);
      return;
    }

    const unsubscribe = subscribeToMessages(groupId, ({ messages: newMessages, error }) => {
      if (error) {
        console.error('Error loading messages:', error);
        return;
      }
      // Convert to GiftedChat format
      // GiftedChat expects messages sorted by createdAt DESCENDING (newest first in array)
      // Service returns ascending (oldest first), so we reverse it
      const giftedChatMessages = newMessages.map((msg) => ({
        _id: msg._id,
        text: msg.text || '',
        createdAt: msg.createdAt,
        user: {
          ...msg.user,
          _id: String(msg.user._id), // Ensure user ID is a string for consistent comparison
        },
        image: msg.image || undefined,
        video: msg.video || undefined,
      })).reverse();
      setMessages(giftedChatMessages);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [groupId, user?.uid]);

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
        showUserAvatar={true}
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
        renderAvatar={(props) => {
          // Only show avatar for messages from other users (left position)
          if (props.position === 'right') {
            return null; // Don't show avatar for own messages
          }
          return (
            <View style={{ marginRight: 8, marginBottom: 4 }}>
              <Image
                source={{ uri: props.currentMessage.user.avatar || 'https://i.pravatar.cc/100?img=12' }}
                style={{ width: 32, height: 32, borderRadius: 16 }}
              />
            </View>
          );
        }}
        renderBubble={(props) => {
          // Use GiftedChat's position prop to determine if message is from current user
          // position === 'left' means other user, position === 'right' means current user
          const isOwnMessage = props.position === 'right';
          return (
            <View
              style={{
                backgroundColor: isOwnMessage ? bubbleOwn : bubbleOther,
                borderRadius: 18,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderTopLeftRadius: isOwnMessage ? 18 : 4,
                borderTopRightRadius: isOwnMessage ? 4 : 18,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
                elevation: 2,
                maxWidth: '75%',
              }}
            >
              {props.currentMessage.image && (
                <Image
                  source={{ uri: props.currentMessage.image }}
                  style={{
                    width: 200,
                    height: 200,
                    borderRadius: 12,
                    marginBottom: props.currentMessage.text ? 8 : 0,
                  }}
                  resizeMode="cover"
                />
              )}
              {props.currentMessage.video && (
                <View
                  style={{
                    width: 200,
                    height: 200,
                    borderRadius: 12,
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
                  }}
                >
                  {props.currentMessage.text}
                </Text>
              )}
            </View>
          );
        }}
        renderTime={(props) => {
          return (
            <Text
              style={{
                fontSize: 11,
                color: textSecondary,
                marginHorizontal: 8,
                marginVertical: 4,
                alignSelf: props.position === 'right' ? 'flex-end' : 'flex-start',
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
        renderMessageContainer={(props) => {
          // Ensure all messages have consistent full-width container with proper flex layout
          const isOwnMessage = props.position === 'right';
          return (
            <View
              style={{
                width: '100%',
                flexDirection: 'row',
                justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
                marginVertical: 4,
                paddingHorizontal: 8,
                alignItems: 'flex-end',
              }}
            >
              {props.children}
            </View>
          );
        }}
        renderInputToolbar={(props) => {
          return (
            <View
              style={{
                backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
                borderTopWidth: 0.5,
                borderTopColor: inputBorder,
                paddingHorizontal: 8,
                paddingVertical: 8,
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
          },
          right: { 
            marginLeft: 0,
            marginRight: 0,
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
    </View>
  );
}

function AlbumTab() {
  const { groupPhotos } = useGroupPhotos();
  const { background, divider, subText } = useThemeColors();
  // Remove albums dependency - only use groupPhotos from context
  const [items, setItems] = React.useState([...groupPhotos]);
  
  React.useEffect(() => {
    setItems([...groupPhotos]);
  }, [groupPhotos]);

  const pick = async () => {
    await ImagePicker.requestMediaLibraryPermissionsAsync();
    const res = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8 
    });
    if (!res.canceled) {
      const newItem = res.assets[0].type === 'video' 
        ? { type: 'video', uri: res.assets[0].uri }
        : { type: 'photo', uri: res.assets[0].uri };
      setItems((prev) => [newItem, ...prev]);
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
            <View key={i} style={{ width: '31%', aspectRatio: 1, backgroundColor: divider, borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
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
            </View>
          );
        })}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: subText }}>Empty</Text>
        </View>
      )}
      <FAB icon="plus" onPress={pick} style={{ position: 'absolute', right: 16, bottom: 16, backgroundColor: IU_CRIMSON }} iconColor="#FFFFFF" customSize={56} variant="primary" />
    </View>
  );
}

function PollsTab() {
  const { background, subText } = useThemeColors();
  
  return (
    <ScrollView style={{ flex: 1, backgroundColor: background }} contentContainerStyle={{ padding: 12 }}>
      {polls.length > 0 ? (
        polls.map((p) => (
          <PollCard key={p.id} poll={p} onVote={() => {}} />
        ))
      ) : (
        <Text style={{ color: subText, textAlign: 'center', padding: 20 }}>Empty</Text>
      )}
    </ScrollView>
  );
}

function GroupDetail({ group, onBack }) {
  const { background, text, subText } = useThemeColors();
  const { user } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  
  // Check if current user is the group owner
  const isOwner = group?.creator === user?.uid;
  
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
      const { error } = await deleteGroup(group.id);
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
        <Appbar.Content title={group?.name || 'Group'} color={text} />
        {isOwner && (
          <Appbar.Action 
            icon="delete" 
            onPress={handleDeleteGroup} 
            color={IU_CRIMSON}
            disabled={deleting}
          />
        )}
        <Button mode="contained" buttonColor={IU_CRIMSON} textColor="#FFFFFF" style={{ marginRight: 12 }}>
          {formatTimeRemaining()}
        </Button>
      </Appbar.Header>
      <TopTab.Navigator
        initialRouteName="Chat"
        screenOptions={{
          tabBarStyle: { backgroundColor: background },
          tabBarIndicatorStyle: { backgroundColor: IU_CRIMSON },
          tabBarActiveTintColor: text,
          tabBarInactiveTintColor: subText,
        }}
      >
        <TopTab.Screen name="Chat">
          {(props) => <ChatTab {...props} groupId={group?.id} />}
        </TopTab.Screen>
        <TopTab.Screen name="Map" component={MapTab} />
        <TopTab.Screen name="Polls" component={PollsTab} />
        <TopTab.Screen name="Album" component={AlbumTab} />
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
      const { error } = await deleteGroup(selectedGroupForDelete.id);
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
        ) : groups.length > 0 ? (
          groups.map((g) => {
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
          })
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


