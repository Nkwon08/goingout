import * as React from 'react';
import { View, Modal, Image, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, Avatar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Video } from 'expo-av';

const IU_CRIMSON = '#CC0000';

export default function MediaPreview({ visible, media, onDelete, onAddToGroup, onPostToFeed, onPostPublicly, onCancel, groups, initialSelectedGroup, navigation, showGroupSelection: externalShowGroupSelection, onShowGroupSelection: setExternalShowGroupSelection }) {
  const [selectedGroup, setSelectedGroup] = React.useState(initialSelectedGroup || null);
  const [internalShowGroupSelection, setInternalShowGroupSelection] = React.useState(false);
  const isVideo = media?.type === 'video';
  
  // Use external state if provided, otherwise use internal state
  const showGroupSelection = externalShowGroupSelection !== undefined ? externalShowGroupSelection : internalShowGroupSelection;
  const setShowGroupSelection = setExternalShowGroupSelection || setInternalShowGroupSelection;
  
  // Update selectedGroup when initialSelectedGroup changes or when preview opens
  React.useEffect(() => {
    if (visible && initialSelectedGroup) {
      setSelectedGroup(initialSelectedGroup);
    } else if (!visible) {
      // Reset selection when preview closes
      setSelectedGroup(null);
      setShowGroupSelection(false);
    }
  }, [visible, initialSelectedGroup]);

  const handleGroupSelect = async (group) => {
    console.log('handleGroupSelect called with group:', group?.id, 'media:', media?.uri);
    if (!group) {
      console.error('No group selected');
      return;
    }
    if (!media || !media.uri) {
      console.error('No media available');
      Alert.alert('Error', 'No media to post. Please try again.');
      return;
    }
    setSelectedGroup(group);
    setShowGroupSelection(false);
    // Pass media along with group to ensure it's available
    if (onAddToGroup) {
      onAddToGroup(group, media);
    }
  };

  // Early return if no media - but only after all hooks are called
  if (!media || !media.uri) {
    return (
      <>
        {/* Group Selection Modal - can still be shown even if main preview is closed */}
        <Modal 
          visible={showGroupSelection} 
          animationType="slide" 
          transparent 
          onRequestClose={() => setShowGroupSelection(false)}
        >
          <View style={styles.overlay}>
            <View style={styles.groupModal}>
              <View style={styles.groupModalHeader}>
                <Text style={styles.groupModalTitle}>Select Group</Text>
                <TouchableOpacity onPress={() => setShowGroupSelection(false)}>
                  <MaterialCommunityIcons name="close" size={24} color="#000000" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.groupModalList}>
                {groups && groups.length > 0 ? (
                  groups.map((group) => (
                    <TouchableOpacity
                      key={group.id}
                      style={styles.groupModalItem}
                      onPress={() => handleGroupSelect(group)}
                      activeOpacity={0.7}
                    >
                      {group?.coverPhoto ? (
                        <Avatar.Image
                          size={50}
                          source={{ uri: group.coverPhoto }}
                          style={{ backgroundColor: '#E0E0E0', marginRight: 12 }}
                        />
                      ) : group?.profilePicture ? (
                        <Avatar.Image
                          size={50}
                          source={{ uri: group.profilePicture }}
                          style={{ backgroundColor: '#E0E0E0', marginRight: 12 }}
                        />
                      ) : (
                        <Avatar.Text
                          size={50}
                          label={group?.name?.slice(0, 2).toUpperCase() || 'GR'}
                          style={{ backgroundColor: IU_CRIMSON, marginRight: 12 }}
                        />
                      )}
                      <View style={styles.groupModalItemContent}>
                        <Text style={styles.groupModalItemText}>{group.name || 'Group'}</Text>
                        <Text style={styles.groupModalItemSubtext}>
                          {group?.memberCount || (Array.isArray(group.members) ? group.members.length : 0)} member{(group?.memberCount || (Array.isArray(group.members) ? group.members.length : 0)) !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={24} color="#8A90A6" />
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.groupModalEmpty}>
                    <MaterialCommunityIcons name="account-group-outline" size={64} color="#8A90A6" />
                    <Text style={styles.groupModalEmptyText}>No groups available</Text>
                    <Text style={styles.groupModalEmptySubtext}>
                      You need to be a member of at least one active group to post.
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  return (
    <>
      <Modal visible={visible && !!media?.uri} animationType="slide" transparent onRequestClose={onCancel}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
          {/* Media Preview */}
          <View style={styles.previewContainer}>
            {isVideo ? (
              <Video
                source={{ uri: media?.uri }}
                style={styles.media}
                useNativeControls
                resizeMode="contain"
              />
            ) : (
              <Image source={{ uri: media?.uri }} style={styles.media} resizeMode="contain" />
            )}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {onPostPublicly && (

<TouchableOpacity style={styles.actionButton} onPress={onPostPublicly}>
                <MaterialCommunityIcons name="share-outline" size={24} color="#FFFFFF" />
                <Text style={styles.actionText}>Post</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => {
                console.log('Post to Group button pressed, groups available:', groups?.length);
                if (!groups || groups.length === 0) {
                  Alert.alert('No Groups', 'You need to be a member of at least one active group to post.');
                  return;
                }
                // Close preview modal first, then show group selection
                if (onCancel) {
                  onCancel();
                }
                // Use a small delay to ensure preview closes before showing group selection
                setTimeout(() => {
                  console.log('Showing group selection modal, groups:', groups?.length);
                  setShowGroupSelection(true);
                }, 300);
              }}
            >
              <MaterialCommunityIcons name="account-group" size={24} color="#FFFFFF" />
              <Text style={styles.actionText}>Post to Group</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Button mode="outlined" textColor="#FFFFFF" onPress={onCancel}>
              Cancel
            </Button>
          </View>
        </View>
      </View>
    </Modal>

    {/* Group Selection Modal */}
    <Modal 
      visible={showGroupSelection} 
      animationType="slide" 
      transparent 
      onRequestClose={() => setShowGroupSelection(false)}
    >
      <View style={styles.overlay}>
        <View style={styles.groupModal}>
          <View style={styles.groupModalHeader}>
            <Text style={styles.groupModalTitle}>Select Group</Text>
            <TouchableOpacity onPress={() => setShowGroupSelection(false)}>
              <MaterialCommunityIcons name="close" size={24} color="#000000" />
            </TouchableOpacity>
          </View>
              <ScrollView style={styles.groupModalList}>
                {groups && groups.length > 0 ? (
                  groups.map((group) => (
                    <TouchableOpacity
                      key={group.id}
                      style={styles.groupModalItem}
                      onPress={() => handleGroupSelect(group)}
                      activeOpacity={0.7}
                    >
                      {group?.coverPhoto ? (
                        <Avatar.Image
                          size={50}
                          source={{ uri: group.coverPhoto }}
                          style={{ backgroundColor: '#E0E0E0', marginRight: 12 }}
                        />
                      ) : group?.profilePicture ? (
                        <Avatar.Image
                          size={50}
                          source={{ uri: group.profilePicture }}
                          style={{ backgroundColor: '#E0E0E0', marginRight: 12 }}
                        />
                      ) : (
                        <Avatar.Text
                          size={50}
                          label={group?.name?.slice(0, 2).toUpperCase() || 'GR'}
                          style={{ backgroundColor: IU_CRIMSON, marginRight: 12 }}
                        />
                      )}
                      <View style={styles.groupModalItemContent}>
                        <Text style={styles.groupModalItemText}>{group.name || 'Group'}</Text>
                        <Text style={styles.groupModalItemSubtext}>
                          {group?.memberCount || (Array.isArray(group.members) ? group.members.length : 0)} member{(group?.memberCount || (Array.isArray(group.members) ? group.members.length : 0)) !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={24} color="#8A90A6" />
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.groupModalEmpty}>
                    <MaterialCommunityIcons name="account-group-outline" size={64} color="#8A90A6" />
                    <Text style={styles.groupModalEmptyText}>No groups available</Text>
                    <Text style={styles.groupModalEmptySubtext}>
                      You need to be a member of at least one active group to post.
                    </Text>
                  </View>
                )}
              </ScrollView>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '95%',
    maxHeight: '90%',
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    overflow: 'hidden',
  },
  previewContainer: {
    width: '100%',
    height: 400,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: IU_CRIMSON,
    minHeight: 48,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  groupModal: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
  },
  groupModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  groupModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  groupModalList: {
    maxHeight: 400,
  },
  groupModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  groupModalItemContent: {
    flex: 1,
    marginLeft: 0,
  },
  groupModalItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  groupModalItemSubtext: {
    fontSize: 14,
    color: '#8A90A6',
  },
  groupModalEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  groupModalEmptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    textAlign: 'center',
  },
  groupModalEmptySubtext: {
    fontSize: 14,
    color: '#8A90A6',
    marginTop: 8,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
});

