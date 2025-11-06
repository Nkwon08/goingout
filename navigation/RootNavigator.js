// Root navigator - wraps BottomTabs with a modal stack for UserProfile and EventDetail
import * as React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BottomTabs from './BottomTabs';
import UserProfileScreen from '../screens/UserProfileScreen';
import EventDetailScreen from '../screens/EventDetailScreen';

const RootStack = createNativeStackNavigator();

export default function RootNavigator() {
  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* Main app with bottom tabs */}
      <RootStack.Screen name="MainTabs" component={BottomTabs} />
      
      {/* UserProfile as a modal - accessible from any tab */}
      <RootStack.Screen
        name="UserProfileModal"
        component={UserProfileScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      
      {/* EventDetail as a modal - accessible from any tab */}
      <RootStack.Screen
        name="EventDetailModal"
        component={EventDetailScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
    </RootStack.Navigator>
  );
}

