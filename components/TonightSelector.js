// Tonight Selector component - allows users to vote on bars and add custom options
import * as React from 'react';
import { View, Modal, TouchableOpacity, TextInput, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Card, Text, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';

const IU_CRIMSON = '#990000';

// Predefined bar options
const PREDEFINED_BARS = [
  'Kilroys on Kirkwook',
  'Kilroys Sports',
  'Blue Bird',
  'Brothers',
  'The Vid',
  'Nicks English Hut',
  'La Una',
  'Root Cellar',
];

export default function TonightSelector() {
  const { surface, text, subText, divider, background, border } = useThemeColors();
  const [votes, setVotes] = React.useState({});
  const [dropdownVisible, setDropdownVisible] = React.useState(false);
  const [selectedBar, setSelectedBar] = React.useState(null);
  const [otherModalVisible, setOtherModalVisible] = React.useState(false);
  const [otherText, setOtherText] = React.useState('');
  const [customBars, setCustomBars] = React.useState([]);

  // Get all available bars (predefined + custom)
  const allBars = React.useMemo(() => {
    return [...PREDEFINED_BARS, ...customBars];
  }, [customBars]);

  // Filter to only show bars with votes > 0 (for both dropdown and results)
  const barsWithVotes = React.useMemo(() => {
    return allBars.filter(bar => (votes[bar] || 0) > 0);
  }, [allBars, votes]);

  // Sort by votes (descending)
  const sortedBars = React.useMemo(() => {
    return [...barsWithVotes].sort((a, b) => (votes[b] || 0) - (votes[a] || 0));
  }, [barsWithVotes, votes]);

  const totalVotes = React.useMemo(() => {
    return Object.values(votes).reduce((sum, count) => sum + count, 0);
  }, [votes]);

  const handleSelectBar = (bar) => {
    if (bar === 'Other') {
      setOtherModalVisible(true);
      setDropdownVisible(false);
    } else {
      setVotes(prev => ({
        ...prev,
        [bar]: (prev[bar] || 0) + 1
      }));
      setSelectedBar(bar);
      setDropdownVisible(false);
    }
  };

  const handleOtherSubmit = () => {
    if (otherText.trim()) {
      const newBar = otherText.trim();
      // Add to custom bars if not already there
      if (!customBars.includes(newBar)) {
        setCustomBars(prev => [...prev, newBar]);
      }
      // Add vote for the new bar
      setVotes(prev => ({
        ...prev,
        [newBar]: (prev[newBar] || 0) + 1
      }));
      setSelectedBar(newBar);
      setOtherText('');
      setOtherModalVisible(false);
    }
  };

  const handleOtherCancel = () => {
    setOtherText('');
    setOtherModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <Card mode="contained" style={{ backgroundColor: surface, borderRadius: 16 }}>
        <Card.Title 
          title="Where's everyone going tonight?" 
          titleStyle={{ color: text }} 
        />
        <Card.Content>
          {/* Dropdown button */}
          <TouchableOpacity
            style={[styles.dropdownButton, { borderColor: border, backgroundColor: background }]}
            onPress={() => setDropdownVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.dropdownText, { color: selectedBar ? text : subText }]}>
              {selectedBar || 'Select a bar...'}
            </Text>
            <MaterialCommunityIcons 
              name={dropdownVisible ? 'chevron-up' : 'chevron-down'} 
              size={24} 
              color={subText} 
            />
          </TouchableOpacity>

          {/* Results - only show bars with votes */}
          {sortedBars.length > 0 && (
            <View style={styles.resultsContainer}>
              <Text style={[styles.resultsTitle, { color: text, marginTop: 16 }]}>
                Current Results
              </Text>
              {sortedBars.map((bar) => {
                const voteCount = votes[bar] || 0;
                const ratio = totalVotes > 0 ? voteCount / totalVotes : 0;
                return (
                  <View key={bar} style={styles.resultItem}>
                    <View style={styles.resultHeader}>
                      <Text style={[styles.resultLabel, { color: text }]}>{bar}</Text>
                      <Text style={[styles.resultVotes, { color: subText }]}>
                        {voteCount} vote{voteCount !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <View style={[styles.progressBarContainer, { backgroundColor: divider }]}>
                      <View 
                        style={[
                          styles.progressBar, 
                          { width: `${ratio * 100}%`, backgroundColor: IU_CRIMSON }
                        ]} 
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Dropdown Modal */}
      <Modal
        visible={dropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdownVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDropdownVisible(false)}
        >
          <View style={[styles.dropdownContainer, { backgroundColor: surface, borderColor: border }]}>
            <ScrollView style={styles.dropdownScroll} keyboardShouldPersistTaps="handled">
              {barsWithVotes.map((bar) => (
                <TouchableOpacity
                  key={bar}
                  style={styles.dropdownItem}
                  onPress={() => handleSelectBar(bar)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dropdownItemText, { color: text }]}>{bar}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => handleSelectBar('Other')}
                activeOpacity={0.7}
              >
                <Text style={[styles.dropdownItemText, { color: IU_CRIMSON }]}>Other</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Other Modal */}
      <Modal
        visible={otherModalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleOtherCancel}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={handleOtherCancel}
          >
            <TouchableOpacity
              style={[styles.otherModalContainer, { backgroundColor: surface, borderColor: border }]}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={[styles.otherModalTitle, { color: text }]}>
                Enter a bar name
              </Text>
              <TextInput
                style={[styles.otherInput, { color: text, borderColor: border, backgroundColor: background }]}
                placeholder="Type bar name here..."
                placeholderTextColor={subText}
                value={otherText}
                onChangeText={setOtherText}
                autoFocus
              />
              <View style={styles.otherModalActions}>
                <Button
                  mode="outlined"
                  textColor={text}
                  onPress={handleOtherCancel}
                  style={styles.otherButton}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  buttonColor={IU_CRIMSON}
                  textColor="#FFFFFF"
                  onPress={handleOtherSubmit}
                  disabled={!otherText.trim()}
                  style={styles.otherButton}
                >
                  Submit
                </Button>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  dropdownText: {
    fontSize: 16,
    flex: 1,
  },
  resultsContainer: {
    marginTop: 8,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  resultItem: {
    marginBottom: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  resultVotes: {
    fontSize: 13,
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContainer: {
    width: '80%',
    maxHeight: '60%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 400,
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  dropdownItemText: {
    fontSize: 16,
  },
  keyboardView: {
    flex: 1,
  },
  otherModalContainer: {
    width: '85%',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
  },
  otherModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  otherInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  otherModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  otherButton: {
    minWidth: 100,
  },
});

