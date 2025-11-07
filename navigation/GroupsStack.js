// Groups stack navigation - handles groups screen and create group
import * as React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import GroupsScreen from '../screens/GroupsScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import SelectGroupScreen from '../screens/SelectGroupScreen';

const Stack = createNativeStackNavigator();

export default function GroupsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="GroupsMain" component={GroupsScreen} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
      <Stack.Screen name="SelectGroup" component={SelectGroupScreen} />
    </Stack.Navigator>
  );
}

