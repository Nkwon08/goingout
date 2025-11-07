// Onboarding screen - introduces app features before login/signup
import * as React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
  TouchableOpacity,
  Image,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
  Extrapolate,
  Easing,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SvgXml } from 'react-native-svg';
import { Asset } from 'expo-asset';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IU_CRIMSON = '#CC0000';
const IU_CREAM = '#EEEDEB';
const BLACK = '#000000';
const DARK_GRAY = '#1A1A1A';
const CRIMSON_DARK = '#770000';
const DARK_RED = '#660000'; // Dark red for background

// Use regular PagerView - animations handled by content

const onboardingData = [
  {
    title: 'Plan Your Night',
    description: 'Create and organize plans with friends',
    icon: 'calendar-multiple',
    useSvg: true, // Use SVG instead of icon for this page
    svgFile: 'image1', // Specify which SVG file to use
  },
  {
    title: 'Discover Hot Spots',
    description: 'Find popular places and events nearby',
    icon: 'map-marker-radius',
    useSvg: true, // Use SVG instead of icon for this page
    svgFile: 'image2', // Specify which SVG file to use
  },
  {
    title: 'Stay Safe, Stay Connected',
    description: 'Share your location and check in easily',
    icon: 'shield-check',
    useSvg: true, // Use SVG instead of icon for this page
    svgFile: 'image3', // Specify which SVG file to use
  },
];

export default function OnboardingScreen({ navigation }) {
  const [currentPage, setCurrentPage] = React.useState(0);
  const pagerRef = React.useRef(null);
  const scrollOffset = useSharedValue(0);
  const pageIndex = useSharedValue(0);

  // Animated values for pulsing effects
  const pulseAnim = useSharedValue(0);
  const glowAnim = useSharedValue(0);

  React.useEffect(() => {
    // Continuous pulse animation
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500 }),
        withTiming(0, { duration: 1500 })
      ),
      -1,
      false
    );

    // Continuous glow animation - smooth and consistent
    glowAnim.value = withRepeat(
      withTiming(1, { 
        duration: 2400,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true // Reverse the animation for smooth loop
    );
  }, []);

  const handlePageSelected = (e) => {
    const page = e.nativeEvent.position;
    setCurrentPage(page);
    pageIndex.value = page;
  };

  const handlePageScroll = (e) => {
    const offset = e.nativeEvent.offset;
    const position = e.nativeEvent.position;
    scrollOffset.value = offset;
    pageIndex.value = position;
  };

  const handleGetStarted = () => {
    navigation.navigate('Login');
  };

  const renderPage = (item, index) => {
    const animatedStyle = useAnimatedStyle(() => {
      const pageDiff = pageIndex.value - index;
      const opacity = interpolate(
        pageDiff,
        [-1, 0, 1],
        [0.3, 1, 0.3],
        Extrapolate.CLAMP
      );
      const translateY = interpolate(
        pageDiff,
        [-1, 0, 1],
        [50, 0, -50],
        Extrapolate.CLAMP
      );
      const scale = interpolate(
        pageDiff,
        [-1, 0, 1],
        [0.8, 1, 0.8],
        Extrapolate.CLAMP
      );

      return {
        opacity: withTiming(opacity, { duration: 300 }),
        transform: [
          { translateY: withTiming(translateY, { duration: 300 }) },
          { scale: withTiming(scale, { duration: 300 }) },
        ],
      };
    });

    const iconAnimatedStyle = useAnimatedStyle(() => {
      const pageDiff = pageIndex.value - index;
      const scale = interpolate(
        pageDiff,
        [-0.5, 0, 0.5],
        [0.9, 1.1, 0.9],
        Extrapolate.CLAMP
      );
      const rotate = interpolate(
        pageDiff,
        [-1, 0, 1],
        [-10, 0, 10],
        Extrapolate.CLAMP
      );

      return {
        transform: [
          { scale: withTiming(scale, { duration: 300 }) },
          { rotate: `${withTiming(rotate, { duration: 300 })}deg` },
        ],
      };
    });

    const glowStyle = useAnimatedStyle(() => {
      // Smooth interpolation for continuous glow effect
      const opacity = interpolate(
        glowAnim.value,
        [0, 0.5, 1],
        [0.3, 0.5, 0.3],
        Extrapolate.CLAMP
      );
      const scale = interpolate(
        glowAnim.value,
        [0, 0.5, 1],
        [1, 1.15, 1],
        Extrapolate.CLAMP
      );

      return {
        opacity,
        transform: [{ scale }],
      };
    });

    const titleAnimatedStyle = useAnimatedStyle(() => {
      const pageDiff = pageIndex.value - index;
      const opacity = interpolate(
        pageDiff,
        [-1, 0, 1],
        [0, 1, 0],
        Extrapolate.CLAMP
      );
      const translateY = interpolate(
        pageDiff,
        [-1, 0, 1],
        [30, 0, -30],
        Extrapolate.CLAMP
      );

      return {
        opacity: withTiming(opacity, { duration: 300 }),
        transform: [{ translateY: withTiming(translateY, { duration: 300 }) }],
      };
    });

    const descriptionAnimatedStyle = useAnimatedStyle(() => {
      const pageDiff = pageIndex.value - index;
      const opacity = interpolate(
        pageDiff,
        [-1, 0, 1],
        [0, 1, 0],
        Extrapolate.CLAMP
      );
      const translateY = interpolate(
        pageDiff,
        [-1, 0, 1],
        [20, 0, -20],
        Extrapolate.CLAMP
      );

      return {
        opacity: withTiming(opacity, { duration: 300 }),
        transform: [{ translateY: withTiming(translateY, { duration: 300 }) }],
      };
    });

    return (
      <View key={index} style={styles.pageContainer}>
        <View style={styles.pageBackground}>
          {/* Main content */}
          <Animated.View style={[styles.contentContainer, animatedStyle]}>
            {/* Icon with glow effect */}
            <Animated.View style={[styles.iconContainer, iconAnimatedStyle]}>
              <Animated.View style={[styles.iconGlow, glowStyle]} />
              {item.useSvg ? (
                item.svgFile === 'image1' ? (
                  <PlanningImage size={250} />
                ) : item.svgFile === 'image2' ? (
                  <HotSpotsImage size={250} />
                ) : (
                  <StaySafeImage size={250} />
                )
              ) : (
                <MaterialCommunityIcons
                  name={item.icon}
                  size={80}
                  color={IU_CRIMSON}
                />
              )}
            </Animated.View>

            {/* Title */}
            <Animated.View style={titleAnimatedStyle}>
              <Text style={styles.title}>
                {item.title}
              </Text>
            </Animated.View>

            {/* Description */}
            <Animated.View style={descriptionAnimatedStyle}>
              <Text style={styles.description}>
                {item.description}
              </Text>
            </Animated.View>

            {/* Get Started button on last page */}
            {index === onboardingData.length - 1 && (
              <GetStartedButton onPress={handleGetStarted} />
            )}
          </Animated.View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <PagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={0}
        onPageSelected={handlePageSelected}
        onPageScroll={handlePageScroll}
      >
        {onboardingData.map((item, index) => renderPage(item, index))}
      </PagerView>

      {/* Pagination dots */}
      <View style={styles.paginationContainer}>
        {onboardingData.map((_, index) => (
          <PaginationDot
            key={index}
            index={index}
            currentPage={currentPage}
            pageIndex={pageIndex}
          />
        ))}
      </View>
    </View>
  );
}

// Planning SVG image component
function PlanningImage({ size = 200 }) {
  const [svgXml, setSvgXml] = React.useState(null);

  React.useEffect(() => {
    // Load SVG file using expo-asset
    const loadSvg = async () => {
      try {
        const asset = Asset.fromModule(require('../assets/image1.svg'));
        await asset.downloadAsync();
        const response = await fetch(asset.localUri || asset.uri);
        const svg = await response.text();
        setSvgXml(svg);
      } catch (err) {
        console.error('Error loading SVG:', err);
      }
    };
    loadSvg();
  }, []);

  if (!svgXml) {
    return null; // or a loading indicator
  }

  return (
    <SvgXml
      xml={svgXml}
      width={size}
      height={size}
    />
  );
}

// Hot Spots SVG image component
function HotSpotsImage({ size = 200 }) {
  const [svgXml, setSvgXml] = React.useState(null);

  React.useEffect(() => {
    // Load SVG file using expo-asset
    const loadSvg = async () => {
      try {
        const asset = Asset.fromModule(require('../assets/image2.svg'));
        await asset.downloadAsync();
        const response = await fetch(asset.localUri || asset.uri);
        const svg = await response.text();
        setSvgXml(svg);
      } catch (err) {
        console.error('Error loading SVG:', err);
      }
    };
    loadSvg();
  }, []);

  if (!svgXml) {
    return null; // or a loading indicator
  }

  return (
    <SvgXml
      xml={svgXml}
      width={size}
      height={size}
    />
  );
}

// Stay Safe SVG image component
function StaySafeImage({ size = 200 }) {
  const [svgXml, setSvgXml] = React.useState(null);

  React.useEffect(() => {
    // Load SVG file using expo-asset
    const loadSvg = async () => {
      try {
        const asset = Asset.fromModule(require('../assets/image3.svg'));
        await asset.downloadAsync();
        const response = await fetch(asset.localUri || asset.uri);
        const svg = await response.text();
        setSvgXml(svg);
      } catch (err) {
        console.error('Error loading SVG:', err);
      }
    };
    loadSvg();
  }, []);

  if (!svgXml) {
    return null; // or a loading indicator
  }

  return (
    <SvgXml
      xml={svgXml}
      width={size}
      height={size}
    />
  );
}

// Animated pagination dot component
function PaginationDot({ index, currentPage, pageIndex }) {
  const animatedStyle = useAnimatedStyle(() => {
    const isActive = Math.round(pageIndex.value) === index;
    
    const scale = withTiming(isActive ? 1.4 : 1, {
      duration: 300,
      easing: Easing.out(Easing.ease),
    });
    
    const opacity = withTiming(isActive ? 1 : 0.4, {
      duration: 300,
      easing: Easing.out(Easing.ease),
    });

    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <Animated.View style={[styles.dot, animatedStyle]} />
  );
}

// Simple Get Started button component
function GetStartedButton({ onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.buttonTouchable}
    >
      <View style={styles.button}>
        <Text style={styles.buttonText}>Get Started</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BLACK,
  },
  pagerView: {
    flex: 1,
  },
  pageContainer: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
  pageBackground: {
    flex: 1,
    backgroundColor: DARK_RED,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
    paddingBottom: 120,
    overflow: 'hidden',
  },
  contentContainer: {
    alignItems: 'center',
    zIndex: 1,
  },
  iconContainer: {
    marginBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlow: {
    position: 'absolute',
    width: 290,
    height: 290,
    borderRadius: 160,
    backgroundColor: IU_CRIMSON,
    opacity: 0.25,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: IU_CREAM,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 18,
    color: '#D0D0D0',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BLACK,
  },
  buttonTouchable: {
    marginTop: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    backgroundColor: IU_CRIMSON,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 30,
    minWidth: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: IU_CREAM,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
