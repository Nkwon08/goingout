// FeedPost component - displays a single post in the feed
import * as React from 'react';
import { View, Image, TouchableOpacity, StyleSheet, ScrollView, Dimensions, Modal, Alert, TextInput, KeyboardAvoidingView, Platform, FlatList } from 'react-native';
import { Text, Avatar, Button, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { deletePost, likePost, checkIfLiked } from '../services/postsService';
import { addComment, subscribeToComments, deleteComment } from '../services/commentsService';
import { subscribeToUserGroups } from '../services/groupsService';
import { sendImageMessage, sendImageMessageWithUrl, sendMessage } from '../services/groupChatService';
import { createGroup } from '../services/groupsService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_WIDTH = SCREEN_WIDTH * 0.92 - 12; // Narrower by 12 pixels
const IMAGE_HEIGHT = IMAGE_WIDTH * (4 / 3); // 3:4 aspect ratio (width:height = 3:4)
const IU_CRIMSON = '#990000';

export default function FeedPost({ post, onDelete }) {
      // Get current user and userData to check if they own this post and get current profile picture
  const { user, userData } = useAuth();
  const navigation = useNavigation();

  // State for post interactions
  const [liked, setLiked] = React.useState(false);
  const [likeCount, setLikeCount] = React.useState(post.likes || 0);
  const [commentCount, setCommentCount] = React.useState(post.replies || 0);
  const [currentImageIndex, setCurrentImageIndex] = React.useState(0);
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [commentsVisible, setCommentsVisible] = React.useState(false);
  const [comments, setComments] = React.useState([]);
  const [commentText, setCommentText] = React.useState('');
  const [submittingComment, setSubmittingComment] = React.useState(false);
  const [liking, setLiking] = React.useState(false);
  const [showSendToGroupModal, setShowSendToGroupModal] = React.useState(false);
  const [groups, setGroups] = React.useState([]);
  const [selectedGroup, setSelectedGroup] = React.useState(null);
  const [sendingToGroup, setSendingToGroup] = React.useState(false);
  const [showCreateGroup, setShowCreateGroup] = React.useState(false);
  
  // Get stable createdAt timestamp for this specific post - each post has its own timer
  // This timestamp is calculated once per post.id and doesn't change when new posts are added
  const createdAtTimestamp = React.useMemo(() => {
    if (!post.createdAt) return null;
    let timestamp;
    if (post.createdAt?.toDate) {
      timestamp = post.createdAt.toDate().getTime();
    } else if (post.createdAt instanceof Date) {
      timestamp = post.createdAt.getTime();
    } else if (typeof post.createdAt === 'string' || typeof post.createdAt === 'number') {
      timestamp = new Date(post.createdAt).getTime();
    } else {
      return null;
    }
    // Return timestamp - each post uses its own unique timestamp
    return timestamp;
  }, [post.id, post.createdAt]); // Include post.createdAt to handle initial load, but only re-calc if post ID changes
  
  const [timeAgo, setTimeAgo] = React.useState(() => {
    if (!createdAtTimestamp) return 'now';
    const now = new Date().getTime();
    const seconds = Math.floor((now - createdAtTimestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(days / 365);
    return `${years}y ago`;
  });
  
  const { surface, text, subText, border } = useThemeColors();
  
  // Check if current user owns this post
  const isOwnPost = user && post.userId === user.uid;
  
  // For own posts, use current userData avatar (always up-to-date)
  // For other posts, use post.avatar (snapshot from when post was created)
  const displayAvatar = isOwnPost && userData 
    ? (userData.photoURL || userData.avatar || post.avatar)
    : post.avatar;
  
  // Current user's avatar for comment input (always show the person typing)
  const currentUserAvatar = userData 
    ? (userData.photoURL || userData.avatar || null)
    : null;

  // Check if user liked this post on mount
  React.useEffect(() => {
    if (user?.uid && post.id) {
      checkIfLiked(post.id, user.uid).then((isLiked) => {
        setLiked(isLiked);
      });
    }
  }, [user?.uid, post.id]);

  // Subscribe to comments when comments modal is visible
  React.useEffect(() => {
    if (!commentsVisible || !post.id) return;
    
    const unsubscribe = subscribeToComments(post.id, (result) => {
      if (result.error) {
        console.error('Error loading comments:', result.error);
      } else {
        setComments(result.comments);
        setCommentCount(result.comments.length);
      }
    });

    return () => unsubscribe();
  }, [commentsVisible, post.id]);

  // Subscribe to user groups when send modal is visible
  React.useEffect(() => {
    if (!showSendToGroupModal || !user?.uid) {
      setGroups([]);
      return;
    }

    const unsubscribe = subscribeToUserGroups(user.uid, ({ groups: userGroups, error }) => {
      if (error) {
        console.error('Error loading groups:', error);
      } else {
        // Filter out expired groups - only show active groups
        const now = new Date();
        const activeGroups = (userGroups || []).filter((group) => {
          if (!group.endTime) return true; // Groups without endTime are considered active
          const endTime = group.endTime instanceof Date ? group.endTime : new Date(group.endTime);
          return endTime.getTime() > now.getTime();
        });
        setGroups(activeGroups);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [showSendToGroupModal, user?.uid]);

  // Each post has its own independent timer
  // Timer continues from where it was (doesn't restart when new posts are added)
  React.useEffect(() => {
    if (!createdAtTimestamp) return;

    // Each post calculates its own time ago based on its own createdAt timestamp
    const updateTimeAgo = () => {
      const now = new Date().getTime();
      const seconds = Math.floor((now - createdAtTimestamp) / 1000);

      if (seconds < 60) {
        setTimeAgo(`${seconds}s ago`);
      } else {
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) {
          setTimeAgo(`${minutes}m ago`);
        } else {
          const hours = Math.floor(minutes / 60);
          if (hours < 24) {
            setTimeAgo(`${hours}h ago`);
          } else {
            const days = Math.floor(hours / 24);
            if (days < 7) {
              setTimeAgo(`${days}d ago`);
            } else {
              const weeks = Math.floor(days / 7);
              if (weeks < 4) {
                setTimeAgo(`${weeks}w ago`);
              } else {
                const months = Math.floor(days / 30);
                if (months < 12) {
                  setTimeAgo(`${months}mo ago`);
                } else {
                  const years = Math.floor(days / 365);
                  setTimeAgo(`${years}y ago`);
                }
              }
            }
          }
        }
      }
    };

    // Update immediately
    updateTimeAgo();

    // Update every second
    const interval = setInterval(updateTimeAgo, 1000);

    return () => clearInterval(interval);
  }, [createdAtTimestamp]); // Only depend on timestamp, not post object (prevents reset when new posts added)
  
      // Normalize images to array format (support both single image and images array)
      // Carousel post: multiple images in one post that can be swiped through
  const images = React.useMemo(() => {
        // First check for images array (carousel post with multiple photos)
    if (post.images && Array.isArray(post.images) && post.images.length > 0) {
      return post.images;
        }
        // Fallback to single image (backwards compatibility)
        if (post.image) {
      return [post.image];
    }
    return [];
  }, [post.image, post.images]);

  // Handle like button tap
  const handleLike = async () => {
    if (!user?.uid || liking) return;
    
    setLiking(true);
    const previousLiked = liked;
    const previousCount = likeCount;
    
    // Optimistic update
    setLiked(!liked);
    setLikeCount(previousLiked ? previousCount - 1 : previousCount + 1);
    
    try {
      const result = await likePost(post.id, user.uid, post.userId);
      if (result.success) {
        setLiked(result.isLiked);
        setLikeCount(result.likes);
      } else {
        // Revert on error
        setLiked(previousLiked);
        setLikeCount(previousCount);
        Alert.alert('Error', result.error || 'Failed to like post');
      }
    } catch (error) {
      console.error('Error liking post:', error);
      // Revert on error
      setLiked(previousLiked);
      setLikeCount(previousCount);
      Alert.alert('Error', 'Failed to like post. Please try again.');
    } finally {
      setLiking(false);
    }
  };

  // Handle comment button tap
  const handleCommentPress = () => {
    setCommentsVisible(true);
  };

  // Handle submit comment
  const handleSubmitComment = async () => {
    if (!user?.uid || !commentText.trim() || submittingComment) return;
    
    setSubmittingComment(true);
    try {
      const result = await addComment(
        post.id,
        user.uid,
        post.userId,
        {
          name: userData?.name || user?.displayName || 'User',
          username: userData?.username || 'user',
          photoURL: userData?.photoURL || userData?.avatar || null,
          avatar: userData?.avatar || userData?.photoURL || null,
        },
        commentText.trim()
      );
      
      if (result.success) {
        setCommentText('');
        setCommentCount((prev) => prev + 1);
      } else {
        Alert.alert('Error', result.error || 'Failed to add comment');
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
      Alert.alert('Error', 'Failed to add comment. Please try again.');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Handle delete comment
  const handleDeleteComment = async (commentId) => {
    if (!user?.uid) return;
    
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteComment(post.id, commentId, user.uid);
              if (result.success) {
                setCommentCount((prev) => Math.max(0, prev - 1));
              } else {
                Alert.alert('Error', result.error || 'Failed to delete comment');
              }
            } catch (error) {
              console.error('Error deleting comment:', error);
              Alert.alert('Error', 'Failed to delete comment. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Handle profile picture/name tap - navigate to user profile modal
  const handleProfileTap = () => {
    if (!post.username) {
      return;
    }

    // Navigate to UserProfileModal in the root navigator
    // Go up navigation hierarchy to find root navigator
    let rootNavigator = navigation;
    let parent = navigation.getParent();
    
    // Navigate up to find root navigator
    while (parent) {
      rootNavigator = parent;
      parent = parent.getParent();
    }
    
    // Navigate to the root modal
    rootNavigator.navigate('UserProfileModal', { 
      username: post.username 
    });
  };

  // Handle menu button press
  const handleMenuPress = () => {
    setMenuVisible(true);
  };

  // Handle share/send button press
  const handleSharePress = () => {
    if (!user?.uid) {
      Alert.alert('Error', 'Please sign in to send posts to groups.');
      return;
    }
    setShowSendToGroupModal(true);
  };

  // Handle sending post to group
  const handleSendToGroup = async () => {
    if (!selectedGroup || !user?.uid || !userData || sendingToGroup) return;

    setSendingToGroup(true);
    try {
      // If post has images, send each image as a separate message
      if (images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const imageUrl = images[i];
          // Check if image is already a Firebase Storage URL (starts with http/https)
          const isFirebaseUrl = imageUrl.startsWith('http://') || imageUrl.startsWith('https://');
          
          let result;
          if (isFirebaseUrl) {
            // Use existing Firebase Storage URL directly
            result = await sendImageMessageWithUrl(
              selectedGroup.id,
              user.uid,
              imageUrl,
              i === 0 ? (post.text || '') : '', // Include post text as caption for first image only
              userData,
              true // isPost = true
            );
          } else {
            // Upload local image
            result = await sendImageMessage(
              selectedGroup.id,
              user.uid,
              imageUrl,
              i === 0 ? (post.text || '') : '', // Include post text as caption for first image only
              userData,
              true // isPost = true
            );
          }
          
          if (result.error) {
            Alert.alert('Error', `Failed to send image: ${result.error}`);
            setSendingToGroup(false);
            return;
          }
        }
      } else if (post.text) {
        // If no images but has text, send as text message
        const { error } = await sendMessage(
          selectedGroup.id,
          user.uid,
          post.text,
          userData,
          true // isPost = true
        );
        if (error) {
          Alert.alert('Error', `Failed to send message: ${error}`);
          setSendingToGroup(false);
          return;
        }
      } else {
        Alert.alert('Error', 'Post has no content to send.');
        setSendingToGroup(false);
        return;
      }

      Alert.alert('Success!', `Post sent to ${selectedGroup.name}.`);
      setShowSendToGroupModal(false);
      setSelectedGroup(null);
    } catch (error) {
      console.error('Error sending post to group:', error);
      Alert.alert('Error', error.message || 'Failed to send post to group. Please try again.');
    } finally {
      setSendingToGroup(false);
    }
  };

  // Handle create new group
  const handleCreateNewGroup = () => {
    setShowSendToGroupModal(false);
    setShowCreateGroup(true);
    // Navigate to CreateGroup screen
    navigation.navigate('Groups', {
      screen: 'CreateGroup',
      params: { returnToPost: true, postData: post }
    });
  };

  // Handle delete post
  const handleDelete = () => {
    setMenuVisible(false);
    
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
                setDeleting(true);
                try {
                  await deletePost(post.id);
                  
                  // Notify parent component that post was deleted
                  if (onDelete) {
                    onDelete(post.id);
                  }
            } catch (error) {
              console.error('❌ Error deleting post:', error);
              Alert.alert('Error', 'Failed to delete post. Please try again.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: surface, borderColor: border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <TouchableOpacity onPress={handleProfileTap}>
            <Avatar.Image size={32} source={{ uri: displayAvatar }} style={styles.avatar} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleProfileTap}>
            <Text style={[styles.username, { color: text }]}>{post.name || post.user}</Text>
          </TouchableOpacity>
        </View>
        {isOwnPost && (
          <TouchableOpacity onPress={handleMenuPress}>
          <MaterialCommunityIcons name="dots-horizontal" size={24} color={text} />
        </TouchableOpacity>
        )}
      </View>

      {/* Images with Swipe */}
      {images.length > 0 && (
        <View style={styles.imagesContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / IMAGE_WIDTH);
              setCurrentImageIndex(index);
            }}
            style={styles.imagesScrollView}
            contentContainerStyle={styles.scrollContent}
            decelerationRate="fast"
            snapToInterval={IMAGE_WIDTH}
            snapToAlignment="start"
          >
            {images.map((img, index) => (
              <View key={index} style={styles.imageWrapper}>
              <Image
                source={{ uri: img }}
                style={styles.image}
                  resizeMode="contain"
              />
              </View>
            ))}
          </ScrollView>
          
          {/* Dot Indicators */}
          {images.length > 1 && (
            <View style={styles.dotsContainer}>
              {images.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    currentImageIndex === index && styles.dotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* Caption - shown first under the name */}
      {post.text && (
        <View style={styles.captionContainer}>
          <Text style={[styles.caption, { color: text }]}>{post.text}</Text>
        </View>
      )}

      {/* Location - show bar if available, otherwise show city location */}
      {(post.bar || post.location) && (
        <View style={styles.locationContainer}>
          <MaterialCommunityIcons name="map-marker-outline" size={16} color={subText} />
          <Text style={[styles.locationText, { color: subText }]}>
            {post.bar || post.location}
          </Text>
        </View>
      )}

      {/* Actions - likes, comments, shares underneath caption */}
      <View style={styles.actions}>
        <View style={styles.leftActions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
            <MaterialCommunityIcons
              name={liked ? 'heart' : 'heart-outline'}
              size={24}
              color={liked ? '#F91880' : text}
            />
            {likeCount > 0 && (
              <Text style={[styles.actionCount, { color: text }]}> {likeCount.toLocaleString()}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleCommentPress}>
            <MaterialCommunityIcons name="comment-outline" size={24} color={text} />
            {commentCount > 0 && (
              <Text style={[styles.actionCount, { color: text }]}> {commentCount.toLocaleString()}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleSharePress}>
            <MaterialCommunityIcons name="send" size={24} color={text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Time Ago - updates every second */}
      <Text style={[styles.timeAgo, { color: subText }]}>{timeAgo}</Text>

      {/* Comments Modal */}
      <Modal
        visible={commentsVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCommentsVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: surface }}>
          {/* Header */}
          <View style={[styles.commentsHeader, { backgroundColor: surface, borderBottomColor: border }]}>
            <TouchableOpacity onPress={() => setCommentsVisible(false)}>
              <MaterialCommunityIcons name="close" size={24} color={text} />
            </TouchableOpacity>
            <Text style={[styles.commentsTitle, { color: text }]}>Comments</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Comments List */}
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isOwnComment = item.userId === user?.uid;
              return (
                <View style={[styles.commentItem, { borderBottomColor: border }]}>
                  <Avatar.Image
                    size={32}
                    source={{ uri: item.avatar || 'https://i.pravatar.cc/100?img=12' }}
                    style={styles.commentAvatar}
                  />
                  <View style={styles.commentContent}>
                    <View style={styles.commentHeader}>
                      <Text style={[styles.commentUsername, { color: text }]}>
                        @{item.username || 'user'}
                      </Text>
                      {isOwnComment && (
                        <TouchableOpacity
                          onPress={() => handleDeleteComment(item.id)}
                          style={styles.deleteCommentButton}
                        >
                          <MaterialCommunityIcons name="delete-outline" size={16} color={subText} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={[styles.commentText, { color: text }]}>{item.text}</Text>
                  </View>
                </View>
              );
            }}
            contentContainerStyle={styles.commentsList}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListEmptyComponent={
              <View style={styles.emptyComments}>
                <Text style={{ color: subText, textAlign: 'center' }}>No comments yet</Text>
              </View>
            }
          />

          {/* Comment Input - Wrapped in KeyboardAvoidingView */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            style={{ marginBottom: Platform.OS === 'ios' ? 10 : 0 }}
          >
            <View style={[styles.commentInputContainer, { backgroundColor: surface, borderTopColor: border }]}>
              <Avatar.Image
                size={32}
                source={{ uri: currentUserAvatar || 'https://i.pravatar.cc/100?img=12' }}
                style={styles.commentInputAvatar}
              />
              <TextInput
                style={[styles.commentInput, { color: text, backgroundColor: border }]}
                placeholder="Add a comment..."
                placeholderTextColor={subText}
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
                returnKeyType="default"
                blurOnSubmit={false}
              />
              <TouchableOpacity
                onPress={handleSubmitComment}
                disabled={!commentText.trim() || submittingComment}
                style={[
                  styles.submitCommentButton,
                  { opacity: commentText.trim() && !submittingComment ? 1 : 0.5 },
                ]}
              >
                {submittingComment ? (
                  <ActivityIndicator size="small" color={IU_CRIMSON} />
                ) : (
                  <MaterialCommunityIcons name="send" size={24} color={IU_CRIMSON} />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Menu Popup - Only show if user owns the post */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={[styles.menuContainer, { backgroundColor: surface, borderColor: border }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleDelete}
              disabled={deleting}
            >
              <MaterialCommunityIcons name="delete-outline" size={24} color="#FF6B6B" />
              <Text style={[styles.menuItemText, { color: '#FF6B6B' }]}>
                {deleting ? 'Deleting...' : 'Delete Post'}
              </Text>
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: border }} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setMenuVisible(false)}
            >
              <MaterialCommunityIcons name="close" size={24} color={text} />
              <Text style={[styles.menuItemText, { color: text }]}>Cancel</Text>
            </TouchableOpacity>
      </View>
        </TouchableOpacity>
      </Modal>

      {/* Send to Group Modal */}
      <Modal
        visible={showSendToGroupModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowSendToGroupModal(false);
          setSelectedGroup(null);
        }}
      >
        <View style={styles.sendModalOverlay}>
          <View style={[styles.sendModalContainer, { backgroundColor: surface, borderColor: border }]}>
            {/* Header */}
            <View style={[styles.sendModalHeader, { borderBottomColor: border }]}>
              <Text style={[styles.sendModalTitle, { color: text }]}>Send to Group</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowSendToGroupModal(false);
                  setSelectedGroup(null);
                }}
              >
                <MaterialCommunityIcons name="close" size={24} color={text} />
              </TouchableOpacity>
            </View>

            {/* Groups List */}
            <ScrollView style={styles.sendModalContent}>
              {groups.length > 0 ? (
                groups.map((group) => (
                  <TouchableOpacity
                    key={group.id}
                    style={[
                      styles.groupOption,
                      { borderBottomColor: border },
                      selectedGroup?.id === group.id && { backgroundColor: border }
                    ]}
                    onPress={() => setSelectedGroup(group)}
                  >
                    <View style={styles.groupOptionContent}>
                      <MaterialCommunityIcons
                        name="account-group"
                        size={24}
                        color={selectedGroup?.id === group.id ? IU_CRIMSON : text}
                      />
                      <View style={styles.groupOptionText}>
                        <Text style={[styles.groupOptionName, { color: text }]}>{group.name}</Text>
                        {group.description && (
                          <Text style={[styles.groupOptionDescription, { color: subText }]} numberOfLines={1}>
                            {group.description}
                          </Text>
                        )}
                      </View>
                    </View>
                    {selectedGroup?.id === group.id && (
                      <MaterialCommunityIcons name="check-circle" size={24} color={IU_CRIMSON} />
                    )}
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyGroupsContainer}>
                  <Text style={[styles.emptyGroupsText, { color: subText }]}>No active groups</Text>
                </View>
              )}

              {/* Create New Group Option */}
              <TouchableOpacity
                style={[styles.createGroupOption, { borderTopColor: border, borderBottomColor: border }]}
                onPress={handleCreateNewGroup}
              >
                <MaterialCommunityIcons name="plus-circle" size={24} color={IU_CRIMSON} />
                <Text style={[styles.createGroupText, { color: IU_CRIMSON }]}>Create New Group</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Footer */}
            <View style={[styles.sendModalFooter, { borderTopColor: border }]}>
              <Button
                mode="outlined"
                onPress={() => {
                  setShowSendToGroupModal(false);
                  setSelectedGroup(null);
                }}
                textColor={text}
                style={[styles.sendModalButton, { borderColor: border }]}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSendToGroup}
                disabled={!selectedGroup || sendingToGroup}
                buttonColor={IU_CRIMSON}
                textColor="#FFFFFF"
                style={styles.sendModalButton}
                loading={sendingToGroup}
              >
                {sendingToGroup ? 'Sending...' : 'Send'}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    marginHorizontal: 12,
    borderRadius: 16,
    overflow: 'hidden',
    paddingBottom: 12,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    marginRight: 12,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
  },
  imagesContainer: {
    position: 'relative',
    marginVertical: 8,
  },
  imagesScrollView: {
    width: IMAGE_WIDTH,
    alignSelf: 'center',
  },
  scrollContent: {
    flexDirection: 'row',
  },
  imageWrapper: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    backgroundColor: '#D0CFCD',
    borderRadius: 12,
    maxHeight: 800,
    minHeight: 250,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 3,
  },
  dotActive: {
    backgroundColor: '#990000',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    padding: 4,
  },
  actionCount: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  captionContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 6,
  },
  locationText: {
    fontSize: 13,
    fontWeight: '500',
  },
  timeAgo: {
    fontSize: 12,
    textTransform: 'uppercase',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    width: '70%',
    maxWidth: 300,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#D0CFCD',
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  commentsList: {
    padding: 16,
  },
  commentItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  commentAvatar: {
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '600',
  },
  deleteCommentButton: {
    padding: 4,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyComments: {
    paddingVertical: 40,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
    borderTopWidth: 1,
  },
  commentInputAvatar: {
    marginRight: 12,
  },
  commentInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  submitCommentButton: {
    marginLeft: 8,
    padding: 8,
  },
  sendModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sendModalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    borderWidth: 1,
  },
  sendModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  sendModalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sendModalContent: {
    maxHeight: 400,
  },
  groupOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  groupOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupOptionText: {
    marginLeft: 12,
    flex: 1,
  },
  groupOptionName: {
    fontSize: 16,
    fontWeight: '500',
  },
  groupOptionDescription: {
    fontSize: 14,
    marginTop: 4,
  },
  emptyGroupsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyGroupsText: {
    fontSize: 16,
  },
  createGroupOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginTop: 8,
  },
  createGroupText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  sendModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  sendModalButton: {
    flex: 1,
  },
});
