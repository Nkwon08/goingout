import * as React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Text, Avatar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';

const IU_CRIMSON = '#DC143C';

export default function GroupCard({ group, onPress, onMenuPress, showMenu = false }) {
  const { surface, text, subText, divider } = useThemeColors();
  
  // Handle both array and number for members (backward compatibility)
  const memberCount = group.memberCount || (Array.isArray(group.members) ? group.members.length : group.members || 0);
  
  const handleMenuPress = (e) => {
    e.stopPropagation(); // Prevent triggering onPress
    if (onMenuPress) {
      onMenuPress(group);
    }
  };
  
  return (
    <View style={{ backgroundColor: surface, padding: 16, borderRadius: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
      <TouchableOpacity onPress={onPress} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        {group?.profilePicture ? (
          <Avatar.Image
            size={40}
            source={{ uri: group.profilePicture }}
            style={{ backgroundColor: divider, marginRight: 12 }}
          />
        ) : (
          <Avatar.Text size={40} label={group?.name?.slice(0, 2).toUpperCase() || 'GR'} style={{ backgroundColor: divider, marginRight: 12 }} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: text, fontSize: 16 }}>{group?.name || 'Group'}</Text>
          <Text style={{ color: subText }}>{group?.time || ''} • {memberCount} member{memberCount !== 1 ? 's' : ''}</Text>
        </View>
      </TouchableOpacity>
      {showMenu && (
        <TouchableOpacity onPress={handleMenuPress} style={{ padding: 8, marginLeft: 8 }}>
          <MaterialCommunityIcons name="dots-vertical" size={24} color={text} />
        </TouchableOpacity>
      )}
    </View>
  );
}


