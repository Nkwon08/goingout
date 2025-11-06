import * as React from 'react';
import { Image, TouchableOpacity } from 'react-native';
import { Card, Text, Button } from 'react-native-paper';
import { useThemeColors } from '../hooks/useThemeColors';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

const IU_CRIMSON = '#990000';

export default function EventCard({ event, onJoin, onEdit, style }) {
  const { surface, text, subText } = useThemeColors();
  const navigation = useNavigation();
  const { user } = useAuth();
  
  // Check if current user is the event creator
  const isCreator = user?.uid && event?.userId && String(user.uid) === String(event.userId);
  
  // Navigate to event detail screen
  const handlePress = () => {
    // Navigate up to find root navigator
    let rootNavigator = navigation;
    let parent = navigation.getParent();
    
    while (parent) {
      rootNavigator = parent;
      parent = parent.getParent();
    }
    
    // Navigate to the event detail modal
    rootNavigator.navigate('EventDetailModal', { 
      eventId: event.id,
      event: event,
    });
  };
  
  // Handle join button press
  const handleJoinPress = () => {
    onJoin?.(event.id);
  };
  
  // Handle edit button press
  const handleEditPress = () => {
    onEdit?.(event);
  };
  
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={handlePress}>
      <Card mode="contained" style={[{ width: 280, backgroundColor: surface, borderRadius: 16 }, style]}>
        <Image source={{ uri: event.image }} style={{ width: '100%', height: 140, borderTopLeftRadius: 16, borderTopRightRadius: 16 }} />
        <Card.Content>
          <Text variant="titleMedium" style={{ color: text, marginTop: 8 }}>{event.title}</Text>
          <Text style={{ color: subText, marginTop: 2 }}>
            {event.location} • {event.time}
            {event.host && ` • Host: ${event.host}`}
          </Text>
          <Text style={{ color: subText, marginTop: 6 }}>{event.description}</Text>
        </Card.Content>
        <Card.Actions>
          {isCreator ? (
            <Button mode="contained" buttonColor={IU_CRIMSON} textColor="#FFFFFF" onPress={handleEditPress}>
              Edit
            </Button>
          ) : (
            <Button mode="contained" buttonColor={IU_CRIMSON} textColor="#FFFFFF" onPress={handleJoinPress}>
              Join
            </Button>
          )}
        </Card.Actions>
      </Card>
    </TouchableOpacity>
  );
}
