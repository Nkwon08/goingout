import * as React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Text, Avatar } from 'react-native-paper';
import { useThemeColors } from '../hooks/useThemeColors';

export default function GroupCard({ group, onPress }) {
  const { surface, text, subText, divider } = useThemeColors();
  
  return (
    <TouchableOpacity onPress={onPress} style={{ backgroundColor: surface, padding: 16, borderRadius: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
      <Avatar.Text size={40} label={group.name.slice(0, 2).toUpperCase()} style={{ backgroundColor: divider, marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: text, fontSize: 16 }}>{group.name}</Text>
        <Text style={{ color: subText }}>{group.time} • {group.members} members</Text>
      </View>
    </TouchableOpacity>
  );
}


