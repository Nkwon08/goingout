import * as React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import ActivityMain from './ActivityMain';
import ActivityRecent from './ActivityRecent';
import { useThemeColors } from '../hooks/useThemeColors';

const TopTab = createMaterialTopTabNavigator();
const IU_CRIMSON = '#990000';

export default function ActivityScreen() {
  const { background, text, subText } = useThemeColors();
  
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: background }} edges={['top']}>
      <TopTab.Navigator
        initialRouteName="Feed"
        screenOptions={{
          tabBarStyle: { backgroundColor: background },
          tabBarIndicatorStyle: { backgroundColor: IU_CRIMSON },
          tabBarActiveTintColor: text,
          tabBarInactiveTintColor: subText,
        }}
      >
        <TopTab.Screen name="Feed" component={ActivityRecent} />
        <TopTab.Screen name="Tonight" component={ActivityMain} />
      </TopTab.Navigator>
    </SafeAreaView>
  );
}


