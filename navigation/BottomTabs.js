// Bottom tab navigation - main navigation structure
import * as React from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ActivityScreen from '../screens/ActivityScreen';
import GroupsStack from './GroupsStack';
import CameraScreen from '../screens/CameraScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileStack from './AccountStack';
import { useThemeColors } from '../hooks/useThemeColors';
import { useAuth } from '../context/AuthContext';
import { subscribeToNotifications } from '../services/notificationsService';

const Tab = createBottomTabNavigator();
const IU_CRIMSON = '#CC0000';

// Custom Bell Icon Component with shake animation and badge
function NotificationBellIcon({ color, size, focused }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = React.useState(0);
  const previousCountRef = React.useRef(0);
  const isInitialLoadRef = React.useRef(true);
  const shakeAnimation = React.useRef(new Animated.Value(0)).current;
  
  // Subscribe to notifications to get unread count
  React.useEffect(() => {
    if (!user?.uid) {
      setUnreadCount(0);
      previousCountRef.current = 0;
      isInitialLoadRef.current = true;
      return;
    }
    
    const unsubscribe = subscribeToNotifications(user.uid, (result) => {
      if (result.error) {
        console.error('Error loading notifications:', result.error);
        return;
      }
      
      const notifications = result.notifications || [];
      const unread = notifications.filter(n => !n.read).length;
      const previousCount = previousCountRef.current;
      
      // Trigger shake animation when count increases (but not on initial load)
      if (!isInitialLoadRef.current && unread > previousCount && unread > 0) {
        // Shake animation
        Animated.sequence([
          Animated.timing(shakeAnimation, {
            toValue: 10,
            duration: 50,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnimation, {
            toValue: -10,
            duration: 50,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnimation, {
            toValue: 10,
            duration: 50,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnimation, {
            toValue: 0,
            duration: 50,
            useNativeDriver: true,
          }),
        ]).start();
      }
      
      // Mark that initial load is complete
      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
      }
      
      previousCountRef.current = unread;
      setUnreadCount(unread);
    });
    
    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [user?.uid]);
  
  const translateX = shakeAnimation.interpolate({
    inputRange: [-10, 10],
    outputRange: [-10, 10],
  });
  
  return (
    <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          transform: [{ translateX }],
        }}
      >
        <MaterialCommunityIcons name="bell-outline" size={size} color={color} />
      </Animated.View>
      {unreadCount > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: -8,
            backgroundColor: IU_CRIMSON,
            borderRadius: 10,
            minWidth: 20,
            height: 20,
            paddingHorizontal: 6,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: '#000000',
          }}
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 11,
              fontWeight: 'bold',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function BottomTabs() {
  const { background, border, subText } = useThemeColors();
  
  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <Tab.Navigator
      screenOptions={({ route }) => {
        const routeName = route?.name || '';
        
        return {
          headerShown: false,
          // Style the bottom tab bar as a floating oval
          tabBarStyle: {
            backgroundColor: '#000000',
            borderTopColor: 'transparent',
            borderTopWidth: 0,
            borderWidth: 0,
            paddingBottom: 20,
            paddingTop: 8,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            borderRadius: 30,
            marginHorizontal: 16,
            marginBottom: 16,
            height: 70,
            position: 'absolute',
          },
          tabBarBackground: () => (
            <View style={{ 
              flex: 1, 
              backgroundColor: '#000000',
              borderRadius: 30,
            }} />
          ),
          // Active/inactive tab colors
          tabBarActiveTintColor: IU_CRIMSON,
          tabBarInactiveTintColor: subText,
          // Custom tab button with circular background for active tab
          tabBarButton: (props) => {
            const { children, onPress, accessibilityState } = props;
            const isFocused = accessibilityState?.selected;
            
            return (
              <TouchableOpacity
                {...props}
                style={styles.tabButtonContainer}
                activeOpacity={0.7}
              >
                {isFocused && (
                  <View style={styles.activeTabCircle} />
                )}
                <View style={styles.tabButton}>
                  {children}
                </View>
              </TouchableOpacity>
            );
          },
          // Render icons for each tab
          tabBarIcon: ({ color, size, focused }) => {
            const iconMap = {
              Activity: 'compass-outline',
              Groups: 'account-group-outline',
              Camera: 'camera-outline',
              Profile: 'account-circle-outline',
            };
            
            // Special handling for notifications bell with shake and badge
            if (routeName === 'NotificationsMain') {
              return <NotificationBellIcon color={color} size={size} focused={focused} />;
            }
            
            const name = iconMap[routeName] || 'circle-outline';
            return <MaterialCommunityIcons name={name} size={size} color={color} />;
          },
        };
      }}
    >
      {/* Define all tab screens */}
      <Tab.Screen 
        name="Activity" 
        component={ActivityScreen}
        options={{
          tabBarLabel: 'Feed',
        }}
      />
      <Tab.Screen name="Groups" component={GroupsStack} />
      <Tab.Screen name="Camera" component={CameraScreen} />
      <Tab.Screen 
        name="NotificationsMain" 
        component={NotificationsScreen}
        options={{
          tabBarLabel: 'Activity',
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileStack}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // Always navigate to ProfileMain when Profile tab is pressed
            // This ensures clicking the Profile tab always shows your own profile
            navigation.navigate('Profile', { 
              screen: 'ProfileMain',
            });
          },
        })}
      />
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  tabButtonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeTabCircle: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(153, 0, 0, 0.15)', // Semi-translucent red circle
    zIndex: 0,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    zIndex: 1,
    paddingTop: 4, // Move icons and text down slightly to center in oval
  },
});


