import * as React from 'react';
import { TouchableOpacity, View, Image } from 'react-native';
import { Text, Avatar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';

const IU_CRIMSON = '#DC143C';

export default function GroupCard({ group, onPress, onMenuPress, onAvatarPress, showMenu = false, latestMessage = null, isExpired = false }) {
  const { surface, text, subText, divider, background } = useThemeColors();
  
  // Handle both array and number for members (backward compatibility)
  const memberCount = group.memberCount || (Array.isArray(group.members) ? group.members.length : group.members || 0);
  
  const handleMenuPress = (e) => {
    e.stopPropagation(); // Prevent triggering onPress
    if (onMenuPress) {
      onMenuPress(group);
    }
  };
  
  const handleAvatarPress = (e) => {
    e.stopPropagation(); // Prevent triggering onPress
    if (onAvatarPress) {
      onAvatarPress(group);
    }
  };
  
  // Format chat preview based on message type
  const getChatPreview = () => {
    if (!latestMessage) {
      return 'No messages yet';
    }
    
    const userName = latestMessage.user?.name || latestMessage.user?.username || 'User';
    
    if (latestMessage.type === 'image' || latestMessage.type === 'video') {
      return `${userName} sent an attachment`;
    } else if (latestMessage.type === 'post') {
      // For post messages, show "xyz sent xyzs post"
      return `${userName} sent ${userName}'s post`;
    } else {
      // Normal text message - show the message text
      return latestMessage.text || 'No message text';
    }
  };
  
  // Old style for expired groups
  if (isExpired) {
    return (
      <View style={{ backgroundColor: surface, padding: 16, borderRadius: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={onPress} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.7}>
            {group?.coverPhoto ? (
              <Avatar.Image
                size={40}
                source={{ uri: group.coverPhoto }}
                style={{ backgroundColor: divider, marginRight: 12 }}
              />
            ) : group?.profilePicture ? (
              <Avatar.Image
                size={40}
                source={{ uri: group.profilePicture }}
                style={{ backgroundColor: divider, marginRight: 12 }}
              />
            ) : (
              <Avatar.Text size={40} label={group?.name?.slice(0, 2).toUpperCase() || 'GR'} style={{ backgroundColor: divider, marginRight: 12 }} />
            )}
          </TouchableOpacity>
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
  
  // New style for active groups
  return (
    <TouchableOpacity 
      onPress={onPress} 
      style={{ 
        backgroundColor: surface, 
        borderRadius: 16, 
        marginBottom: 16, 
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}
      activeOpacity={0.8}
    >
      {/* Cover Photo */}
      <View style={{ position: 'relative', width: '100%', height: 200, backgroundColor: divider }}>
        {group?.coverPhoto ? (
          <Image
            source={{ uri: group.coverPhoto }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : group?.profilePicture ? (
          <Image
            source={{ uri: group.profilePicture }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ width: '100%', height: '100%', backgroundColor: divider, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: subText, fontSize: 48, fontWeight: 'bold' }}>
              {group?.name?.slice(0, 2).toUpperCase() || 'GR'}
            </Text>
          </View>
        )}
        
        {/* Avatar circle overlay on cover photo */}
        <TouchableOpacity 
          onPress={handleAvatarPress} 
          activeOpacity={0.7}
          style={{ 
            position: 'absolute', 
            bottom: -30, 
            left: 16,
            borderWidth: 4,
            borderColor: background,
            borderRadius: 40,
          }}
        >
          {group?.coverPhoto ? (
            <Avatar.Image
              size={60}
              source={{ uri: group.coverPhoto }}
              style={{ backgroundColor: divider }}
            />
          ) : group?.profilePicture ? (
            <Avatar.Image
              size={60}
              source={{ uri: group.profilePicture }}
              style={{ backgroundColor: divider }}
            />
          ) : (
            <Avatar.Text 
              size={60} 
              label={group?.name?.slice(0, 2).toUpperCase() || 'GR'} 
              style={{ backgroundColor: divider }} 
            />
          )}
        </TouchableOpacity>
        
        {/* Menu button */}
        {showMenu && (
          <TouchableOpacity 
            onPress={handleMenuPress} 
            style={{ 
              position: 'absolute', 
              top: 12, 
              right: 12,
              padding: 8,
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: 20,
            }}
          >
            <MaterialCommunityIcons name="dots-vertical" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Group Name and Chat Preview */}
      <View style={{ padding: 16, paddingTop: 40 }}>
        <Text style={{ color: text, fontSize: 20, fontWeight: '600', marginBottom: 8 }}>
          {group?.name || 'Group'}
        </Text>
        
        {/* Chat Preview */}
        <Text 
          style={{ 
            color: subText, 
            fontSize: 14,
            marginBottom: 4,
          }}
          numberOfLines={1}
        >
          {getChatPreview()}
        </Text>
        
        {/* Member count */}
        <Text style={{ color: subText, fontSize: 12 }}>
          {memberCount} member{memberCount !== 1 ? 's' : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
}


