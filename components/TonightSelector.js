// Tonight Selector component - allows users to vote on bars and add custom options
// Votes are public and location-based - everyone can see each other's votes
import * as React from 'react';
import { View, Modal, TouchableOpacity, TextInput, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { Card, Text, Button, Avatar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeColors } from '../hooks/useThemeColors';
import { useAuth } from '../context/AuthContext';
import { voteForOption, subscribeToVotesForLocation, getUserVoteForLocation } from '../services/votesService';
import { getCurrentLocation } from '../services/locationService';

const IU_CRIMSON = '#DC143C';

// Predefined bar options
const PREDEFINED_BARS = [
  'Kilroys on Kirkwood',
  'Kilroys Sports',
  'Bluebird',
  'La Una',
  'Brothers',
  'The Upstairs Pub',
  'Nicks English Hut',
];

export default function TonightSelector() {
  const { surface, text, subText, divider, background, border } = useThemeColors();
  const { user, userData } = useAuth();
  const [voteCounts, setVoteCounts] = React.useState({});
  const [voters, setVoters] = React.useState({}); // Who voted for each option
  const [dropdownVisible, setDropdownVisible] = React.useState(false);
  const [selectedBar, setSelectedBar] = React.useState(null);
  const [otherModalVisible, setOtherModalVisible] = React.useState(false);
  const [otherText, setOtherText] = React.useState('');
  const [customBars, setCustomBars] = React.useState([]);
  const [location, setLocation] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [voting, setVoting] = React.useState(false);
  const [expandedOption, setExpandedOption] = React.useState(null); // To show/hide voter list

  // Get all available bars (predefined + custom + voted options)
  const allBars = React.useMemo(() => {
    const allOptions = new Set([...PREDEFINED_BARS, ...customBars, ...Object.keys(voteCounts)]);
    return Array.from(allOptions);
  }, [customBars, voteCounts]);

  // Filter to only show bars with votes > 0 (for results display)
  const barsWithVotes = React.useMemo(() => {
    return allBars.filter(bar => (voteCounts[bar] || 0) > 0);
  }, [allBars, voteCounts]);

  // Sort all bars by votes (descending) - highest votes on top, lowest on bottom
  const sortedBars = React.useMemo(() => {
    return [...barsWithVotes].sort((a, b) => (voteCounts[b] || 0) - (voteCounts[a] || 0));
  }, [barsWithVotes, voteCounts]);

  // Sort all predefined bars by votes for dropdown (highest first, lowest last)
  const sortedPredefinedBars = React.useMemo(() => {
    return [...PREDEFINED_BARS].sort((a, b) => (voteCounts[b] || 0) - (voteCounts[a] || 0));
  }, [voteCounts]);

  const totalVotes = React.useMemo(() => {
    return Object.values(voteCounts).reduce((sum, count) => sum + count, 0);
  }, [voteCounts]);

  // Get user's location on mount
  React.useEffect(() => {
    const fetchLocation = async () => {
      try {
        const locationData = await getCurrentLocation();
        if (locationData.error) {
          console.error('Error getting location:', locationData.error);
          Alert.alert('Location Error', locationData.error);
          setLoading(false);
        } else {
          setLocation(locationData.city);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching location:', error);
        setLoading(false);
      }
    };

    fetchLocation();
  }, []);

  // Subscribe to votes for location
  React.useEffect(() => {
    if (!location || !user?.uid) return;

    // Get user's current vote
    getUserVoteForLocation(user.uid, location).then(({ vote, error }) => {
      if (vote && !error) {
        setSelectedBar(vote.option);
      }
    });

    // Subscribe to real-time votes
    const unsubscribe = subscribeToVotesForLocation(location, (result) => {
      if (result.error) {
        console.error('Error subscribing to votes:', result.error);
      } else {
        setVoteCounts(result.voteCounts || {});
        setVoters(result.voters || {});
      }
    });

    return () => unsubscribe();
  }, [location, user?.uid]);

  const handleSelectBar = async (bar) => {
    if (bar === 'Other') {
      setOtherModalVisible(true);
      setDropdownVisible(false);
    } else {
      if (!user?.uid || !location || voting) return;
      
      setVoting(true);
      try {
        const result = await voteForOption(
          user.uid,
          location,
          bar,
          {
            name: userData?.name || user?.displayName || 'User',
            username: userData?.username || 'user',
            photoURL: userData?.photoURL || userData?.avatar || null,
            avatar: userData?.avatar || userData?.photoURL || null,
          }
        );

        if (result.success) {
          if (result.action === 'removed') {
            // Vote removed - clear selection
            setSelectedBar(null);
          } else {
            setSelectedBar(bar);
            // Save last voted bar to AsyncStorage for auto-fill in compose post
            AsyncStorage.setItem('lastVotedBar', bar).catch(err => console.error('Error saving last voted bar:', err));
          }
          setDropdownVisible(false);
        } else {
          Alert.alert('Error', result.error || 'Failed to vote. Please try again.');
        }
      } catch (error) {
        console.error('Error voting:', error);
        Alert.alert('Error', 'Failed to vote. Please try again.');
      } finally {
        setVoting(false);
      }
    }
  };

  const handleOtherSubmit = async () => {
    if (!otherText.trim() || !user?.uid || !location || voting) return;
    
    const newBar = otherText.trim();
    setVoting(true);
    
    try {
      const result = await voteForOption(
        user.uid,
        location,
        newBar,
        {
          name: userData?.name || user?.displayName || 'User',
          username: userData?.username || 'user',
          photoURL: userData?.photoURL || userData?.avatar || null,
          avatar: userData?.avatar || userData?.photoURL || null,
        }
      );

      if (result.success) {
        // Add to custom bars if not already there
        if (!customBars.includes(newBar) && !PREDEFINED_BARS.includes(newBar)) {
          setCustomBars(prev => [...prev, newBar]);
        }
        
        if (result.action !== 'removed') {
          setSelectedBar(newBar);
          // Save last voted bar to AsyncStorage for auto-fill in compose post
          AsyncStorage.setItem('lastVotedBar', newBar).catch(err => console.error('Error saving last voted bar:', err));
        }
        setOtherText('');
        setOtherModalVisible(false);
      } else {
        Alert.alert('Error', result.error || 'Failed to vote. Please try again.');
      }
    } catch (error) {
      console.error('Error voting:', error);
      Alert.alert('Error', 'Failed to vote. Please try again.');
    } finally {
      setVoting(false);
    }
  };

  const handleOtherCancel = () => {
    setOtherText('');
    setOtherModalVisible(false);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Card mode="contained" style={{ backgroundColor: surface, borderRadius: 16 }}>
          <Card.Content style={{ padding: 20 }}>
            <ActivityIndicator size="small" color={IU_CRIMSON} />
            <Text style={[styles.loadingText, { color: subText, marginTop: 12 }]}>
              Loading location...
            </Text>
          </Card.Content>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Card mode="contained" style={{ backgroundColor: surface, borderRadius: 16 }}>
        <Card.Title 
          title="Where's everyone going tonight?" 
          titleStyle={{ color: text }}
          subtitle={location ? `Showing results for ${location}` : undefined}
          subtitleStyle={{ color: subText }}
        />
        <Card.Content>
          {/* Dropdown button */}
          <TouchableOpacity
            style={[styles.dropdownButton, { borderColor: border, backgroundColor: background }]}
            onPress={() => setDropdownVisible(true)}
            activeOpacity={0.7}
            disabled={voting || !location}
          >
            {voting ? (
              <ActivityIndicator size="small" color={IU_CRIMSON} />
            ) : (
              <>
                <Text style={[styles.dropdownText, { color: selectedBar ? text : subText }]}>
                  {selectedBar || 'Select'}
                </Text>
                <MaterialCommunityIcons 
                  name={dropdownVisible ? 'chevron-up' : 'chevron-down'} 
                  size={24} 
                  color={subText} 
                />
              </>
            )}
          </TouchableOpacity>

          {/* Results - only show bars with votes */}
          {sortedBars.length > 0 && (
            <View style={styles.resultsContainer}>
              <Text style={[styles.resultsTitle, { color: text, marginTop: 16 }]}>
                Current Results ({totalVotes} {totalVotes === 1 ? 'vote' : 'votes'})
              </Text>
              {sortedBars.map((bar) => {
                const voteCount = voteCounts[bar] || 0;
                const ratio = totalVotes > 0 ? voteCount / totalVotes : 0;
                const optionVoters = voters[bar] || [];
                const isExpanded = expandedOption === bar;
                
                return (
                  <View key={bar} style={styles.resultItem}>
                    <View style={styles.resultHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.resultLabel, { color: text }]}>{bar}</Text>
                        {selectedBar === bar && (
                          <Text style={[styles.yourVote, { color: IU_CRIMSON }]}>
                            Your vote
                          </Text>
                        )}
                      </View>
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
                    
                    {/* Voters list - expandable */}
                    {optionVoters.length > 0 && (
                      <TouchableOpacity
                        style={styles.votersToggle}
                        onPress={() => setExpandedOption(isExpanded ? null : bar)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.votersToggleText, { color: subText }]}>
                          {isExpanded ? 'Hide' : 'Show'} who voted ({optionVoters.length})
                        </Text>
                        <MaterialCommunityIcons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color={subText}
                        />
                      </TouchableOpacity>
                    )}
                    
                    {/* Expanded voters list */}
                    {isExpanded && optionVoters.length > 0 && (
                      <View style={[styles.votersList, { borderTopColor: divider }]}>
                        {optionVoters.map((voter, index) => (
                          <View key={voter.userId || index} style={styles.voterItem}>
                            <Avatar.Image
                              size={24}
                              source={{ uri: voter.userAvatar || 'https://i.pravatar.cc/100?img=12' }}
                              style={styles.voterAvatar}
                            />
                            <Text style={[styles.voterName, { color: text }]}>
                              @{voter.userUsername || 'user'}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
          
          {!loading && sortedBars.length === 0 && (
            <Text style={[styles.noVotesText, { color: subText, marginTop: 16 }]}>
              No votes yet. Be the first to vote!
            </Text>
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
              {sortedPredefinedBars.map((bar) => (
                <TouchableOpacity
                  key={bar}
                  style={styles.dropdownItem}
                  onPress={() => handleSelectBar(bar)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dropdownItemText, { color: text }]}>{bar}</Text>
                  {voteCounts[bar] > 0 && (
                    <Text style={[styles.dropdownVoteCount, { color: subText }]}>
                      {voteCounts[bar]} vote{voteCounts[bar] !== 1 ? 's' : ''}
                    </Text>
                  )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownItemText: {
    fontSize: 16,
    flex: 1,
  },
  dropdownVoteCount: {
    fontSize: 14,
    marginLeft: 8,
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
  loadingText: {
    fontSize: 14,
    textAlign: 'center',
  },
  yourVote: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  votersToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingVertical: 8,
  },
  votersToggleText: {
    fontSize: 12,
  },
  votersList: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  voterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  voterAvatar: {
    marginRight: 8,
  },
  voterName: {
    fontSize: 13,
  },
  noVotesText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

