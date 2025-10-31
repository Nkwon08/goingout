import * as React from 'react';
import { View, Image, TouchableOpacity, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Text, Avatar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_WIDTH = SCREEN_WIDTH * 0.92;

export default function FeedPost({ post }) {
  const [liked, setLiked] = React.useState(post.liked || false);
  const [likeCount, setLikeCount] = React.useState(post.likes || 0);
  const [commentCount] = React.useState(post.replies || 0);
  const [saved, setSaved] = React.useState(false);
  const [currentImageIndex, setCurrentImageIndex] = React.useState(0);
  const { surface, text, subText, border } = useThemeColors();
  
  // Get images array - support both single image and images array
  const images = React.useMemo(() => {
    if (post.images && Array.isArray(post.images) && post.images.length > 0) {
      return post.images;
    } else if (post.image) {
      return [post.image];
    }
    return [];
  }, [post.image, post.images]);

  const handleLike = () => {
    setLiked(!liked);
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
  };

  const handleSave = () => {
    setSaved(!saved);
  };

  return (
    <View style={[styles.container, { backgroundColor: surface, borderColor: border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Avatar.Image size={32} source={{ uri: post.avatar }} style={styles.avatar} />
          <Text style={[styles.username, { color: text }]}>{post.name || post.user}</Text>
        </View>
        <TouchableOpacity>
          <MaterialCommunityIcons name="dots-horizontal" size={24} color={text} />
        </TouchableOpacity>
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
          >
            {images.map((img, index) => (
              <Image
                key={index}
                source={{ uri: img }}
                style={styles.image}
                resizeMode="cover"
              />
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

      {/* Actions */}
      <View style={styles.actions}>
        <View style={styles.leftActions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
            <MaterialCommunityIcons
              name={liked ? 'heart' : 'heart-outline'}
              size={28}
              color={liked ? '#F91880' : text}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <MaterialCommunityIcons name="comment-outline" size={28} color={text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <MaterialCommunityIcons name="share-outline" size={28} color={text} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.actionButton} onPress={handleSave}>
          <MaterialCommunityIcons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={28}
            color={saved ? '#990000' : text}
          />
        </TouchableOpacity>
      </View>

      {/* Like Count */}
      {likeCount > 0 && (
        <Text style={[styles.likeCount, { color: text }]}>{likeCount.toLocaleString()} likes</Text>
      )}

      {/* Caption */}
      <View style={styles.captionContainer}>
        <Text style={[styles.username, { color: text }]}>{post.name || post.user}</Text>
        <Text style={[styles.caption, { color: text }]}> {post.text || post.caption}</Text>
      </View>

      {/* Comment Count */}
      {commentCount > 0 && (
        <TouchableOpacity>
          <Text style={[styles.commentCount, { color: subText }]}>View all {commentCount} comments</Text>
        </TouchableOpacity>
      )}

      {/* Time Ago */}
      <Text style={[styles.timeAgo, { color: subText }]}>{post.timeAgo}</Text>
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
  image: {
    width: IMAGE_WIDTH,
    aspectRatio: 1,
    backgroundColor: '#D0CFCD',
    borderRadius: 12,
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
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginRight: 16,
    padding: 4,
  },
  likeCount: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  captionContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  caption: {
    fontSize: 14,
    flex: 1,
  },
  commentCount: {
    fontSize: 14,
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  timeAgo: {
    fontSize: 12,
    textTransform: 'uppercase',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
});
