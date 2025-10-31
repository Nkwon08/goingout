import * as React from 'react';
import { View, ScrollView, Image, Modal, Pressable } from 'react-native';
import { Appbar, Text } from 'react-native-paper';
import { albums } from '../data/mock';

export default function PhotosScreen() {
  const [open, setOpen] = React.useState(null);
  return (
    <View style={{ flex: 1, backgroundColor: '#EEEDEB' }}>
      <Appbar.Header mode="center-aligned" style={{ backgroundColor: '#EEEDEB' }}>
        <Appbar.Content title="Photos" color="#E6E8F0" />
      </Appbar.Header>
      <ScrollView contentContainerStyle={{ padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {albums.map((a) => (
          <Pressable key={a.id} onPress={() => setOpen(a)} style={{ width: '48%', backgroundColor: '#151823', borderRadius: 14, overflow: 'hidden' }}>
            <Image source={{ uri: a.photos[0] }} style={{ width: '100%', aspectRatio: 1 }} />
            <View style={{ padding: 10 }}>
              <Text style={{ color: '#E6E8F0' }}>{a.location}</Text>
              <Text style={{ color: '#8A90A6' }}>{a.date}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={!!open} transparent animationType="slide" onRequestClose={() => setOpen(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', paddingTop: 60 }}>
          <Appbar.Header mode="small" style={{ backgroundColor: 'transparent' }}>
            <Appbar.Action icon="close" onPress={() => setOpen(null)} color="#E6E8F0" />
            <Appbar.Content title={open?.location || 'Album'} color="#E6E8F0" />
          </Appbar.Header>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
            {open?.photos.map((u, i) => (
              <Image key={i} source={{ uri: u }} style={{ width: '100%', aspectRatio: 1, borderRadius: 12 }} />
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}


