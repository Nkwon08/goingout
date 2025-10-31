import * as React from 'react';
import { View, ScrollView, Image } from 'react-native';
import { Appbar, FAB, Text, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import MapView, { Marker } from 'react-native-maps';
import { GiftedChat } from 'react-native-gifted-chat';
import * as ImagePicker from 'expo-image-picker';
import GroupCard from '../components/GroupCard';
import PollCard from '../components/PollCard';
import { groups, albums, polls } from '../data/mock';
import { useGroupPhotos } from '../context/GroupPhotosContext';
import { useThemeColors } from '../hooks/useThemeColors';

const TopTab = createMaterialTopTabNavigator();

const IU_CRIMSON = '#990000';

function MapTab() {
  const region = { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.05, longitudeDelta: 0.05 };
  const members = [
    { id: 'm1', name: 'Alex', lat: 37.77, lng: -122.42 },
    { id: 'm2', name: 'Morgan', lat: 37.78, lng: -122.41 },
  ];
  return (
    <MapView style={{ flex: 1 }} initialRegion={region}>
      {members.map((m) => (
        <Marker key={m.id} coordinate={{ latitude: m.lat, longitude: m.lng }} title={m.name} />
      ))}
    </MapView>
  );
}

function ChatTab() {
  const [messages, setMessages] = React.useState([
    { _id: 1, text: 'Meet at Neon Lounge at 9?', createdAt: new Date(), user: { _id: 2, name: 'Alex' } },
    { _id: 2, text: 'I’m in!', createdAt: new Date(Date.now() - 1000 * 60), user: { _id: 1, name: 'You' } },
  ]);
  const onSend = React.useCallback((newMessages = []) => {
    setMessages((prev) => GiftedChat.append(prev, newMessages));
  }, []);
  return (
    <GiftedChat messages={messages} onSend={(msgs) => onSend(msgs)} user={{ _id: 1, name: 'You' }} />
  );
}

function AlbumTab() {
  const { groupPhotos } = useGroupPhotos();
  const { background, divider } = useThemeColors();
  const [items, setItems] = React.useState([...albums[0]?.photos?.map(p => ({ type: 'photo', uri: p })) ?? [], ...groupPhotos]);
  
  React.useEffect(() => {
    setItems([...albums[0]?.photos?.map(p => ({ type: 'photo', uri: p })) ?? [], ...groupPhotos]);
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
      <FAB icon="plus" onPress={pick} style={{ position: 'absolute', right: 16, bottom: 16, backgroundColor: IU_CRIMSON }} iconColor="#FFFFFF" customSize={56} variant="primary" />
    </View>
  );
}

function PollsTab() {
  const { background } = useThemeColors();
  
  return (
    <ScrollView style={{ flex: 1, backgroundColor: background }} contentContainerStyle={{ padding: 12 }}>
      {polls.map((p) => (
        <PollCard key={p.id} poll={p} onVote={() => {}} />
      ))}
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

export default function GroupsScreen() {
  const [selected, setSelected] = React.useState(null);
  const { background, text } = useThemeColors();
  
  if (selected) {
    return <GroupDetail onBack={() => setSelected(null)} />;
  }
  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      <Appbar.Header mode="center-aligned" style={{ backgroundColor: background }}>
        <Appbar.Content title="My Groups" color={text} />
      </Appbar.Header>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {groups.map((g) => (
          <GroupCard key={g.id} group={g} onPress={() => setSelected(g)} />
        ))}
      </ScrollView>
      <FAB 
        icon="plus" 
        style={{ 
          position: 'absolute', 
          right: 16, 
          bottom: 16,
          backgroundColor: IU_CRIMSON,
        }} 
        iconColor="#FFFFFF"
        onPress={() => {}} 
        customSize={56} 
      />
    </View>
  );
}


