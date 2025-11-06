import * as React from 'react';
import { View, ScrollView, Image, TouchableOpacity, Modal, TouchableWithoutFeedback, ActivityIndicator } from 'react-native';
import { Appbar, FAB, Text, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import MapView, { Marker } from 'react-native-maps';
import { GiftedChat } from 'react-native-gifted-chat';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GroupCard from '../components/GroupCard';
import PollCard from '../components/PollCard';
import { polls } from '../data/mock';
import { useGroupPhotos } from '../context/GroupPhotosContext';
import { useThemeColors } from '../hooks/useThemeColors';
import { useAuth } from '../context/AuthContext';
import { subscribeToUserGroups } from '../services/groupsService';

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

function ChatTab() {
  const { background, subText } = useThemeColors();
  const [messages, setMessages] = React.useState([]); // Empty - will come from Firebase
  const onSend = React.useCallback((newMessages = []) => {
    setMessages((prev) => GiftedChat.append(prev, newMessages));
  }, []);
  
  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      {messages.length > 0 ? (
        <GiftedChat messages={messages} onSend={(msgs) => onSend(msgs)} user={{ _id: 1, name: 'You' }} />
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: subText }}>Empty</Text>
        </View>
      )}
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

function GroupDetail({ onBack }) {
  const { background, text, subText } = useThemeColors();
  
  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      <Appbar.Header mode="small" elevated={false} style={{ backgroundColor: background }}>
        <Appbar.Action icon="arrow-left" onPress={onBack} color={text} />
        <Appbar.Content title="Group" color={text} />
        <Button mode="contained" buttonColor={IU_CRIMSON} textColor="#FFFFFF" style={{ marginRight: 12 }}>02:15:47</Button>
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
        <TopTab.Screen name="Chat" component={ChatTab} />
        <TopTab.Screen name="Map" component={MapTab} />
        <TopTab.Screen name="Polls" component={PollsTab} />
        <TopTab.Screen name="Album" component={AlbumTab} />
      </TopTab.Navigator>
    </View>
  );
}

export default function GroupsScreen({ navigation }) {
  const [selected, setSelected] = React.useState(null);
  const [showGroupMenu, setShowGroupMenu] = React.useState(false);
  const [groups, setGroups] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
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
  
  if (selected) {
    return <GroupDetail onBack={() => setSelected(null)} />;
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
          groups.map((g) => (
            <GroupCard key={g.id} group={g} onPress={() => setSelected(g)} />
          ))
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
    </View>
  );
}


