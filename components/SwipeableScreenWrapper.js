// SwipeableScreenWrapper - Adds swipe gestures without interfering with navigator registration
import * as React from 'react';
import { View, PanResponder, Animated, Dimensions, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const SWIPE_VELOCITY_THRESHOLD = 0.5;
const HORIZONTAL_SWIPE_RATIO = 2;

const TAB_ORDER = ['Feed', 'Tonight', 'Groups', 'Activity', 'Profile'];

export default function SwipeableScreenWrapper({ children, tabName }) {
  const navigation = useNavigation();
  const route = useRoute();
  const translateX = React.useRef(new Animated.Value(0)).current;
  const [isAnimating, setIsAnimating] = React.useState(false);
  const currentIndex = TAB_ORDER.indexOf(tabName);

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (isAnimating) return false;
        
        const { dx, dy } = gestureState;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        
        const isHorizontalSwipe = absDx > absDy * HORIZONTAL_SWIPE_RATIO;
        const isSignificantSwipe = absDx > 20;
        
        const canSwipeLeft = currentIndex < TAB_ORDER.length - 1 && dx < 0;
        const canSwipeRight = currentIndex > 0 && dx > 0;
        
        return isHorizontalSwipe && isSignificantSwipe && (canSwipeLeft || canSwipeRight);
      },
      onPanResponderGrant: () => {
        translateX.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        const { dx } = gestureState;
        const maxTranslate = SCREEN_WIDTH;
        const clampedDx = Math.max(-maxTranslate, Math.min(maxTranslate, dx));
        
        if (currentIndex === 0 && dx > 0) return;
        if (currentIndex === TAB_ORDER.length - 1 && dx < 0) return;
        
        translateX.setValue(clampedDx);
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, vx } = gestureState;
        const absDx = Math.abs(dx);
        const shouldNavigate = absDx > SWIPE_THRESHOLD || Math.abs(vx) > SWIPE_VELOCITY_THRESHOLD;
        
        if (shouldNavigate) {
          if (dx < 0 && currentIndex < TAB_ORDER.length - 1) {
            const nextTab = TAB_ORDER[currentIndex + 1];
            navigation.navigate(nextTab);
            translateX.setValue(0);
            setIsAnimating(false);
          } else if (dx > 0 && currentIndex > 0) {
            const previousTab = TAB_ORDER[currentIndex - 1];
            navigation.navigate(previousTab);
            translateX.setValue(0);
            setIsAnimating(false);
          } else {
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              tension: 50,
              friction: 8,
            }).start();
          }
        } else {
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
        pointerEvents="box-none"
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  animatedView: {
    flex: 1,
    width: SCREEN_WIDTH,
    backgroundColor: 'transparent',
  },
});

