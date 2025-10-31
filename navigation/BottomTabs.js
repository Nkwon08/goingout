import * as React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ActivityScreen from '../screens/ActivityScreen';
import GroupsScreen from '../screens/GroupsScreen';
import CameraScreen from '../screens/CameraScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import AccountScreen from '../screens/AccountScreen';
import { useThemeColors } from '../hooks/useThemeColors';

const Tab = createBottomTabNavigator();

const IU_CRIMSON = '#990000';

export default function BottomTabs() {
  const { background, border, subText } = useThemeColors();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: background,
          borderTopColor: border,
          borderTopWidth: 1,
          paddingBottom: 20,
          paddingTop: 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: IU_CRIMSON,
        tabBarInactiveTintColor: subText,
        tabBarIcon: ({ color, size }) => {
          const iconMap = {
            Activity: 'compass-outline',
            Groups: 'account-group-outline',
            Camera: 'camera-outline',
            Notifications: 'bell-outline',
            Account: 'account-circle-outline',
          };
          const name = iconMap[route.name] || 'circle-outline';
          return <MaterialCommunityIcons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Groups" component={GroupsScreen} />
      <Tab.Screen name="Camera" component={CameraScreen} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}


