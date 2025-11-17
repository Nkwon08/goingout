// Bottom tab navigation - main navigation structure
import * as React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import FeedScreen from '../screens/FeedScreen';
import TonightScreen from '../screens/TonightScreen';
import GroupsStack from './GroupsStack';
import ActivityScreenNew from '../screens/ActivityScreenNew';
import ProfileStack from './AccountStack';
import SwipeableScreenWrapper from '../components/SwipeableScreenWrapper';
import { useThemeColors } from '../hooks/useThemeColors';

const Tab = createBottomTabNavigator();
const IU_CRIMSON = '#CC0000';

export default function BottomTabs() {
  const { background, border, subText } = useThemeColors();
  
  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <Tab.Navigator
        lazy={false}
        detachInactiveScreens={false}
        backBehavior="none"
        screenOptions={({ route }) => {
          const routeName = route?.name || '';
          
          return {
            headerShown: false,
            animation: 'none',
            animationEnabled: false,
            // Style the bottom tab bar as a floating oval
            tabBarStyle: {
              backgroundColor: '#000000',
              borderTopColor: 'transparent',
              borderTopWidth: 0,
              borderWidth: 0,
              paddingBottom: 20,
              paddingTop: 12,
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              borderRadius: 30,
              marginHorizontal: 16,
              marginBottom: 16,
              height: 60,
              position: 'absolute',
            },
            tabBarItemStyle: {
              paddingVertical: 0,
            },
            tabBarShowLabel: false,
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
                Feed: 'home',
                Tonight: 'compass-outline',
                Groups: 'account-group-outline',
                Activity: 'magnify',
                Profile: 'account-circle-outline',
              };
              
              const name = iconMap[routeName] || 'circle-outline';
              return <MaterialCommunityIcons name={name} size={size} color={color} />;
            },
          };
        }}
      >
        {/* Define all tab screens */}
        <Tab.Screen 
          name="Feed" 
          options={{
            tabBarLabel: '',
            unmountOnBlur: false,
          }}
        >
          {(props) => (
            <SwipeableScreenWrapper tabName="Feed">
              <FeedScreen {...props} />
            </SwipeableScreenWrapper>
          )}
        </Tab.Screen>
        <Tab.Screen 
          name="Tonight" 
          options={{
            tabBarLabel: '',
            unmountOnBlur: false,
          }}
        >
          {(props) => (
            <SwipeableScreenWrapper tabName="Tonight">
              <TonightScreen {...props} />
            </SwipeableScreenWrapper>
          )}
        </Tab.Screen>
        <Tab.Screen 
          name="Groups" 
          options={{
            tabBarLabel: '',
            unmountOnBlur: false,
          }}
        >
          {(props) => (
            <SwipeableScreenWrapper tabName="Groups">
              <GroupsStack {...props} />
            </SwipeableScreenWrapper>
          )}
        </Tab.Screen>
        <Tab.Screen 
          name="Activity" 
          options={{
            tabBarLabel: '',
            unmountOnBlur: false,
          }}
        >
          {(props) => (
            <SwipeableScreenWrapper tabName="Activity">
              <ActivityScreenNew {...props} />
            </SwipeableScreenWrapper>
          )}
        </Tab.Screen>
        <Tab.Screen 
          name="Profile" 
          options={{
            tabBarLabel: '',
            unmountOnBlur: false,
          }}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              // Always navigate to ProfileMain when Profile tab is pressed
              // This ensures clicking the Profile tab always shows your own profile
              navigation.navigate('Profile', { 
                screen: 'ProfileMain',
              });
            },
          })}
        >
          {(props) => (
            <SwipeableScreenWrapper tabName="Profile">
              <ProfileStack {...props} />
            </SwipeableScreenWrapper>
          )}
        </Tab.Screen>
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
    height: '100%',
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

