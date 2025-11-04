import * as React from 'react';
import { View, ScrollView } from 'react-native';
import { List, Divider } from 'react-native-paper';
import { Text } from 'react-native-paper';
import { notifications } from '../data/mock';
import { useTheme } from '../context/ThemeContext';

export default function NotificationsTab() {
  const { isDarkMode } = useTheme();
  
  const bgColor = isDarkMode ? '#1A1A1A' : '#EEEDEB';
  const surfaceColor = isDarkMode ? '#2A2A2A' : '#F5F4F2';
  const textColor = isDarkMode ? '#E6E8F0' : '#1A1A1A';
  const dividerColor = isDarkMode ? '#3A3A3A' : '#D0CFCD';
  
  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {notifications.length > 0 ? (
          <View style={{ backgroundColor: surfaceColor, borderRadius: 16 }}>
            {notifications.map((n, idx) => (
              <View key={n.id}>
                <List.Item 
                  title={n.text} 
                  titleStyle={{ color: textColor }} 
                  left={(props) => <List.Icon {...props} color={textColor} icon="bell-outline" />} 
                />
                {idx < notifications.length - 1 && <Divider style={{ backgroundColor: dividerColor }} />}
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: textColor === '#E6E8F0' ? '#8A90A6' : '#666666', textAlign: 'center', padding: 20 }}>Empty</Text>
        )}
      </ScrollView>
    </View>
  );
}

