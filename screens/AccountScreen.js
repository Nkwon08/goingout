import * as React from 'react';
import { View, ScrollView } from 'react-native';
import { Appbar, Avatar, Text, Button, Switch, List, Divider } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';

export default function AccountScreen() {
  const [publicAlbums, setPublicAlbums] = React.useState(true);
  const { isDarkMode, toggleTheme } = useTheme();
  
  const bgColor = isDarkMode ? '#1A1A1A' : '#EEEDEB';
  const surfaceColor = isDarkMode ? '#2A2A2A' : '#F5F4F2';
  const textColor = isDarkMode ? '#E6E8F0' : '#1A1A1A';
  const subTextColor = isDarkMode ? '#8A90A6' : '#666666';
  const dividerColor = isDarkMode ? '#3A3A3A' : '#D0CFCD';
  
  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <Appbar.Header mode="center-aligned" style={{ backgroundColor: bgColor }}>
        <Appbar.Content title="Account" color={textColor} />
      </Appbar.Header>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <Avatar.Image size={96} source={{ uri: 'https://i.pravatar.cc/200?img=12' }} />
          <Text variant="titleLarge" style={{ color: textColor, marginTop: 8 }}>You</Text>
          <Text style={{ color: subTextColor, marginTop: 2 }}>"Hunting neon lights."</Text>
          <Button mode="contained" buttonColor="#990000" textColor="#FFFFFF" style={{ marginTop: 10 }} onPress={() => {}}>Edit Profile</Button>
        </View>

        <View style={{ backgroundColor: surfaceColor, borderRadius: 16, padding: 12, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ color: textColor }}>Show Public Albums</Text>
            <Switch value={publicAlbums} onValueChange={setPublicAlbums} />
          </View>
          <View style={{ height: 1, backgroundColor: dividerColor, marginVertical: 8 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: textColor }}>Dark Mode</Text>
            <Switch value={isDarkMode} onValueChange={toggleTheme} />
          </View>
        </View>

        <View style={{ backgroundColor: surfaceColor, borderRadius: 16 }}>
          <List.Item title="Privacy" titleStyle={{ color: textColor }} left={(p) => <List.Icon {...p} color={textColor} icon="shield-outline" />} onPress={() => {}} />
          <Divider style={{ backgroundColor: dividerColor }} />
          <List.Item title="Help" titleStyle={{ color: textColor }} left={(p) => <List.Icon {...p} color={textColor} icon="help-circle-outline" />} onPress={() => {}} />
          <Divider style={{ backgroundColor: dividerColor }} />
          <List.Item title="Logout" titleStyle={{ color: '#FF6B6B' }} left={(p) => <List.Icon {...p} color="#FF6B6B" icon="logout" />} onPress={() => {}} />
        </View>
      </ScrollView>
    </View>
  );
}
