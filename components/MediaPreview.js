import * as React from 'react';
import { View, Modal, Image, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Video } from 'expo-av';

const IU_CRIMSON = '#DC143C';

export default function MediaPreview({ visible, media, onDelete, onAddToGroup, onPostToFeed, onPostPublicly, onCancel, groups, initialSelectedGroup }) {
  const [selectedGroup, setSelectedGroup] = React.useState(initialSelectedGroup || null);
  const isVideo = media?.type === 'video';

  // Update selectedGroup when initialSelectedGroup changes or when preview opens
  React.useEffect(() => {
    if (visible && initialSelectedGroup) {
      setSelectedGroup(initialSelectedGroup);
    } else if (!visible) {
      // Reset selection when preview closes
      setSelectedGroup(null);
    }
  }, [visible, initialSelectedGroup]);

  if (!visible || !media || !media.uri) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Media Preview */}
          <View style={styles.previewContainer}>
            {isVideo ? (
              <Video
                source={{ uri: media.uri }}
                style={styles.media}
                useNativeControls
                resizeMode="contain"
              />
            ) : (
              <Image source={{ uri: media.uri }} style={styles.media} resizeMode="contain" />
            )}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
              <MaterialCommunityIcons name="delete-outline" size={24} color="#FF6B6B" />
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>

            {onPostPublicly && (
              <TouchableOpacity style={styles.postButton} onPress={onPostPublicly}>
                <MaterialCommunityIcons name="share-outline" size={24} color="#FFFFFF" />
                <Text style={[styles.postText, { marginLeft: 8 }]}>Post</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.saveButton} onPress={() => onAddToGroup(selectedGroup)}>
              <MaterialCommunityIcons name="account-group" size={24} color="#FFFFFF" />
              <Text style={[styles.saveText, { marginLeft: 8 }]}>Add to Group</Text>
            </TouchableOpacity>
          </View>

          {/* Group Selection */}
          <View style={styles.groupSelection}>
            <Text style={[styles.groupSelectionTitle, { color: IU_CRIMSON }]}>Select Group:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupList}>
              {groups && groups.length > 0 ? (
                groups.map((group) => (
                  <TouchableOpacity
                    key={group.id}
                    style={[
                      styles.groupChip,
                      selectedGroup?.id === group.id && styles.groupChipSelected,
                    ]}
                    onPress={() => setSelectedGroup(group)}
                  >
                    <Text
                      style={[
                        styles.groupChipText,
                        selectedGroup?.id === group.id && styles.groupChipTextSelected,
                      ]}
                    >
                      {group.name}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={{ color: '#8A90A6', padding: 12 }}>Empty</Text>
              )}
            </ScrollView>
          </View>

          <View style={styles.footer}>
            <Button mode="outlined" textColor="#000000" onPress={onCancel}>
              Cancel
            </Button>
          </View>
        </View>
      </View>
    </Modal>
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
    backgroundColor: '#EEEDEB',
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
    justifyContent: 'space-around',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#23283B',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  deleteText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: IU_CRIMSON,
  },
  postText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: IU_CRIMSON,
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  groupSelection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#23283B',
  },
  groupSelectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  groupList: {
    paddingRight: 8,
  },
  groupChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#151823',
    borderWidth: 1,
    borderColor: '#23283B',
    marginRight: 8,
  },
  groupChipSelected: {
    backgroundColor: IU_CRIMSON,
    borderColor: IU_CRIMSON,
  },
  groupChipText: {
    color: '#8A90A6',
    fontSize: 14,
  },
  groupChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
});

