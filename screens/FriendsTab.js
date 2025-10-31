import * as React from 'react';
import { View, ScrollView } from 'react-native';
import { Searchbar, Button, Avatar, List, Divider, Text } from 'react-native-paper';
import { friends } from '../data/mock';
import { useTheme } from '../context/ThemeContext';

export default function FriendsTab() {
  const [query, setQuery] = React.useState('');
  const { isDarkMode } = useTheme();
  
  const bgColor = isDarkMode ? '#1A1A1A' : '#EEEDEB';
  const surfaceColor = isDarkMode ? '#2A2A2A' : '#F5F4F2';
  const textColor = isDarkMode ? '#E6E8F0' : '#1A1A1A';
  const subTextColor = isDarkMode ? '#8A90A6' : '#666666';
  const dividerColor = isDarkMode ? '#3A3A3A' : '#D0CFCD';
  
  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Searchbar 
          placeholder="Search friends" 
          onChangeText={setQuery} 
          value={query} 
          style={{ backgroundColor: surfaceColor, marginBottom: 12 }} 
          inputStyle={{ color: textColor }} 
          iconColor={subTextColor}
          placeholderTextColor={subTextColor}
        />

        <Text style={{ color: subTextColor, marginBottom: 6 }}>Requests</Text>
        {friends.requests.map((f) => (
          <View 
            key={f.id} 
            style={{ 
              backgroundColor: surfaceColor, 
              borderRadius: 16, 
              padding: 12, 
              marginBottom: 10, 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'space-between' 
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar.Image size={40} source={{ uri: f.avatar }} />
              <Text style={{ color: textColor }}>{f.name}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button mode="contained" buttonColor="#990000" textColor="#FFFFFF">Accept</Button>
              <Button mode="outlined" textColor={textColor}>Decline</Button>
            </View>
          </View>
        ))}

        <Text style={{ color: subTextColor, marginVertical: 6 }}>Friends</Text>
        <View style={{ backgroundColor: surfaceColor, borderRadius: 16 }}>
          {friends.accepted.map((f, idx) => (
            <View key={f.id}>
              <List.Item 
                title={f.name} 
                titleStyle={{ color: textColor }} 
                left={() => <Avatar.Image size={36} source={{ uri: f.avatar }} />} 
              />
              {idx < friends.accepted.length - 1 && <Divider style={{ backgroundColor: dividerColor }} />}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

