// Activity screen - main screen with tabs for Feed and Tonight
import * as React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import ActivityMain from './ActivityMain';
import ActivityRecent from './ActivityRecent';
import { useThemeColors } from '../hooks/useThemeColors';
import { useTheme } from '../context/ThemeContext';

const TopTab = createMaterialTopTabNavigator();
const IU_CRIMSON = '#CC0000';

export default function ActivityScreen() {
  const { background, text, subText } = useThemeColors();
  const { isDarkMode } = useTheme();
  
  return (
    <LinearGradient
      colors={isDarkMode ? ['#1a0000', '#121212', '#0a0000'] : ['#ffe5e5', '#FAFAFA', '#fff5f5']}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Top tab navigator with Feed and Tonight tabs */}
        <TopTab.Navigator
          initialRouteName="Feed"
          screenOptions={{
            tabBarStyle: { backgroundColor: 'transparent' },
            tabBarIndicatorStyle: { backgroundColor: IU_CRIMSON },
            tabBarActiveTintColor: text,
            tabBarInactiveTintColor: subText,
          }}
        >
          <TopTab.Screen name="Feed" component={ActivityRecent} />
          <TopTab.Screen name="Tonight" component={ActivityMain} />
        </TopTab.Navigator>
      </SafeAreaView>
    </LinearGradient>
  );
}


