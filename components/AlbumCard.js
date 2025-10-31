import * as React from 'react';
import { View, Image } from 'react-native';
import { Card, Text } from 'react-native-paper';

export default function AlbumCard({ album, onPress }) {
  const photos = album.photos.slice(0, 4);
  return (
    <Card mode="contained" onPress={onPress} style={{ backgroundColor: '#151823', borderRadius: 16 }}>
      <Card.Content>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {photos.map((uri, idx) => (
            <Image key={idx} source={{ uri }} style={{ width: 70, height: 70, borderRadius: 10 }} />
          ))}
        </View>
        <Text style={{ color: '#E6E8F0', marginTop: 8 }}>{album.user} • {album.location}</Text>
        <Text style={{ color: '#8A90A6' }}>{album.date}</Text>
      </Card.Content>
    </Card>
  );
}


