// Bottom tab navigation - main navigation structure
import * as React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ActivityScreen from '../screens/ActivityScreen';
import GroupsStack from './GroupsStack';
import CameraScreen from '../screens/CameraScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileStack from './AccountStack';
import { useThemeColors } from '../hooks/useThemeColors';

const Tab = createBottomTabNavigator();
const IU_CRIMSON = '#990000';

export default function BottomTabs() {
  const { background, border, subText } = useThemeColors();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        // Style the bottom tab bar as a floating oval
        tabBarStyle: {
          backgroundColor: '#000000',
          borderTopColor: 'transparent',
          borderTopWidth: 0,
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
        },
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
            NotificationsMain: 'bell-outline',
            Profile: 'account-circle-outline',
          };
          const name = iconMap[route.name] || 'circle-outline';
          return <MaterialCommunityIcons name={name} size={size} color={color} />;
        },
      })}
    >
      {/* Define all tab screens */}
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Groups" component={GroupsStack} />
      <Tab.Screen name="Camera" component={CameraScreen} />
      <Tab.Screen 
        name="NotificationsMain" 
        component={NotificationsScreen}
        options={{
          tabBarLabel: 'Notifications',
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
  },
});


