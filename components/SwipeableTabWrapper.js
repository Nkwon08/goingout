// SwipeableTabWrapper - adds swipe gestures with smooth transitions to navigate between tabs
import * as React from 'react';
import { View, PanResponder, Animated, Dimensions, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25; // 25% of screen width to trigger navigation
const SWIPE_VELOCITY_THRESHOLD = 0.5; // Minimum velocity to trigger swipe
const HORIZONTAL_SWIPE_RATIO = 2; // dx must be at least 2x dy to be considered horizontal
const ANIMATION_DURATION = 250; // Animation duration in ms

const TAB_ORDER = ['Feed', 'Tonight', 'Groups', 'Activity', 'Profile'];

export default function SwipeableTabWrapper({ children, tabName }) {
  const navigation = useNavigation();
  const route = useRoute();
  const translateX = React.useRef(new Animated.Value(0)).current;
  const [isAnimating, setIsAnimating] = React.useState(false);
  const currentIndex = TAB_ORDER.indexOf(tabName);

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to clearly horizontal swipes when not animating
        if (isAnimating) return false;
        
        const { dx, dy } = gestureState;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        
        // Must be clearly horizontal (dx is at least 2x dy) and significant
        const isHorizontalSwipe = absDx > absDy * HORIZONTAL_SWIPE_RATIO;
        const isSignificantSwipe = absDx > 20; // Minimum distance
        
        // Check if we can swipe in this direction
        const canSwipeLeft = currentIndex < TAB_ORDER.length - 1 && dx < 0;
        const canSwipeRight = currentIndex > 0 && dx > 0;
        
        return isHorizontalSwipe && isSignificantSwipe && (canSwipeLeft || canSwipeRight);
      },
      onPanResponderGrant: () => {
        // Reset animation value when starting a new gesture
        translateX.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        // Animate the current screen as user swipes
        const { dx } = gestureState;
        
        // Clamp the translation to prevent over-swiping
        const maxTranslate = SCREEN_WIDTH;
        const clampedDx = Math.max(-maxTranslate, Math.min(maxTranslate, dx));
        
        // Only allow swiping in valid directions
        if (currentIndex === 0 && dx > 0) return; // Can't swipe right on first tab
        if (currentIndex === TAB_ORDER.length - 1 && dx < 0) return; // Can't swipe left on last tab
        
        translateX.setValue(clampedDx);
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, vx } = gestureState;
        const absDx = Math.abs(dx);
        
        // Determine if we should navigate based on distance or velocity
        const shouldNavigate = absDx > SWIPE_THRESHOLD || Math.abs(vx) > SWIPE_VELOCITY_THRESHOLD;
        
        if (shouldNavigate) {
          // Navigate immediately, don't wait for animation
          if (dx < 0 && currentIndex < TAB_ORDER.length - 1) {
            // Swipe left - go to next tab
            const nextTab = TAB_ORDER[currentIndex + 1];
            // Navigate immediately
            navigation.navigate(nextTab);
            // Reset animation immediately
            translateX.setValue(0);
            setIsAnimating(false);
          } else if (dx > 0 && currentIndex > 0) {
            // Swipe right - go to previous tab
            const previousTab = TAB_ORDER[currentIndex - 1];
            // Navigate immediately
            navigation.navigate(previousTab);
            // Reset animation immediately
            translateX.setValue(0);
            setIsAnimating(false);
          } else {
            // Snap back to original position
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              tension: 50,
              friction: 8,
            }).start();
          }
        } else {
          // Snap back to original position
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  // Reset animation when tab changes
  React.useEffect(() => {
    translateX.setValue(0);
    setIsAnimating(false);
  }, [tabName]);

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Animated.View
        style={[
          styles.animatedView,
          {
            transform: [{ translateX }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  animatedView: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
});

