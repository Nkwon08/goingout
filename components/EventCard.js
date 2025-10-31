import * as React from 'react';
import { Image } from 'react-native';
import { Card, Text, Button } from 'react-native-paper';
import { useThemeColors } from '../hooks/useThemeColors';

const IU_CRIMSON = '#990000';

export default function EventCard({ event, onJoin, onSave, style }) {
  const { surface, text, subText } = useThemeColors();
  
  return (
    <Card mode="contained" style={[{ width: 280, backgroundColor: surface, borderRadius: 16 }, style]}>
      <Image source={{ uri: event.image }} style={{ width: '100%', height: 140, borderTopLeftRadius: 16, borderTopRightRadius: 16 }} />
      <Card.Content>
        <Text variant="titleMedium" style={{ color: text, marginTop: 8 }}>{event.title}</Text>
        <Text style={{ color: subText, marginTop: 2 }}>{event.location} • {event.time}</Text>
        <Text style={{ color: subText, marginTop: 6 }}>{event.description}</Text>
      </Card.Content>
      <Card.Actions>
        <Button mode="contained" buttonColor={IU_CRIMSON} textColor="#FFFFFF" onPress={() => onJoin?.(event.id)}>
          Join
        </Button>
        <Button mode="outlined" textColor={text} onPress={() => onSave?.(event.id)}>
          Save
        </Button>
      </Card.Actions>
    </Card>
  );
}


