import * as React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';

const IU_CRIMSON = '#990000';

export default function TrendingSection({ trendingLocations, onLocationPress, selectedLocation }) {
  const { surface, text, subText, divider, background, isDarkMode } = useThemeColors();
  
  return (
    <View style={[styles.container, { backgroundColor: surface, borderBottomColor: divider }]}>
      <Text style={[styles.title, { color: text }]}>Trending in your area</Text>
      {trendingLocations.map((item, index) => (
        <TouchableOpacity
          key={item.location}
          style={[
            styles.trendingItem, 
            selectedLocation === item.location && { backgroundColor: isDarkMode ? '#3A3A3A' : '#E0DFDD' }
          ]}
          onPress={() => onLocationPress(item.location)}
          activeOpacity={0.7}
        >
          <View style={styles.trendingContent}>
            <Text style={[styles.trendingNumber, { color: subText }]}>{index + 1}</Text>
            <View style={styles.trendingInfo}>
              <Text style={[styles.trendingLocation, { color: text }]}>{item.location}</Text>
              <Text style={[styles.trendingCount, { color: subText }]}>{item.count} posts</Text>
            </View>
          </View>
          {selectedLocation === item.location && (
            <MaterialCommunityIcons name="check-circle" size={20} color={IU_CRIMSON} />
          )}
        </TouchableOpacity>
      ))}
      {selectedLocation && (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={() => onLocationPress(null)}
          activeOpacity={0.7}
        >
          <Text style={styles.clearText}>Clear filter</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  trendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 4,
  },
  trendingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  trendingNumber: {
    fontSize: 15,
    fontWeight: '700',
    minWidth: 24,
    marginRight: 12,
  },
  trendingInfo: {
    flex: 1,
  },
  trendingLocation: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  trendingCount: {
    fontSize: 13,
  },
  clearButton: {
    marginTop: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  clearText: {
    color: IU_CRIMSON,
    fontSize: 14,
    fontWeight: '600',
  },
});

