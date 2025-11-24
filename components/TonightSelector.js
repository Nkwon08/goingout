// Tonight Selector component - allows users to vote on bars and add custom options
// Votes are public and location-based - everyone can see each other's votes
import * as React from 'react';
import { View, Modal, TouchableOpacity, TextInput, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { Card, Text, Button, Avatar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeColors } from '../hooks/useThemeColors';
import { getCardBorderOnly } from '../utils/cardStyles';
import { useAuth } from '../context/AuthContext';
import { voteForOption, subscribeToVotesForLocation, getUserVoteForLocation } from '../services/votesService';
import { getCurrentLocation } from '../services/locationService';

const IU_CRIMSON = '#CC0000';

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
  const { surface, text, subText, divider, background, border, isDarkMode } = useThemeColors();
  const { user, userData } = useAuth();
  const [voteCounts, setVoteCounts] = React.useState({});
  const [voters, setVoters] = React.useState({}); // Who voted for each option
  const [selectedBar, setSelectedBar] = React.useState(null);
  const [otherModalVisible, setOtherModalVisible] = React.useState(false);
  const [otherText, setOtherText] = React.useState('');
  const [location, setLocation] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [voting, setVoting] = React.useState(false);
  const [expandedOption, setExpandedOption] = React.useState(null); // To show/hide voter list

  // Get all options that have been voted on (only show options that exist in voteCounts)
  // Poll starts empty - users add options by voting for them
  const allBars = React.useMemo(() => {
    // Only show options that have votes (users add options by voting for them)
    return Object.keys(voteCounts).filter(option => (voteCounts[option] || 0) > 0);
  }, [voteCounts]);

  // Sort all bars by votes (descending) - highest votes on top, lowest on bottom
  const sortedBars = React.useMemo(() => {
    return [...allBars].sort((a, b) => (voteCounts[b] || 0) - (voteCounts[a] || 0));
  }, [allBars, voteCounts]);

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
        <Card mode="contained" style={{ 
          backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.2)' : 'rgba(255, 255, 255, 0.3)',
          borderRadius: 20,
          ...getCardBorderOnly(),
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
          elevation: 8,
        }}>
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
        <Card mode="contained" style={{ 
          backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.2)' : 'rgba(255, 255, 255, 0.3)',
          borderRadius: 20,
          ...getCardBorderOnly(),
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
          elevation: 8,
        }}>
        <Card.Title 
          title="Where is everyone going tonight?" 
          titleStyle={{ color: text }}
          subtitle={location ? `Showing results for ${location}` : undefined}
          subtitleStyle={{ color: subText }}
        />
        <Card.Content>
          {/* Results - show all bars (with or without votes) */}
          {sortedBars.length > 0 ? (
            <View style={styles.resultsContainer}>
              <Text style={[styles.resultsTitle, { color: text }]}>
                Results ({totalVotes} {totalVotes === 1 ? 'vote' : 'votes'})
              </Text>
              {sortedBars.map((bar) => {
                const voteCount = voteCounts[bar] || 0;
                const ratio = totalVotes > 0 ? voteCount / totalVotes : 0;
                const optionVoters = voters[bar] || [];
                const isExpanded = expandedOption === bar;
                const isSelected = selectedBar === bar;
                
                return (
                  <TouchableOpacity
                    key={bar}
                    style={[
                      styles.resultItem,
                      isSelected && { backgroundColor: isDarkMode ? 'rgba(204, 0, 0, 0.15)' : 'rgba(204, 0, 0, 0.1)' },
                      { borderColor: isSelected ? IU_CRIMSON : divider }
                    ]}
                    onPress={() => handleSelectBar(bar)}
                    activeOpacity={0.7}
                    disabled={voting || !location}
                  >
                    <View style={styles.resultHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.resultLabel, { color: text }]}>{bar}</Text>
                        {isSelected && (
                          <Text style={[styles.yourVote, { color: IU_CRIMSON }]}>
                            Your vote
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.resultVotes, { color: subText }]}>
                        {voteCount} vote{voteCount !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    {totalVotes > 0 && (
                      <View style={[styles.progressBarContainer, { backgroundColor: divider }]}>
                        <View 
                          style={[
                            styles.progressBar, 
                            { width: `${ratio * 100}%`, backgroundColor: IU_CRIMSON }
                          ]} 
                        />
                      </View>
                    )}
                    
                    {/* Voters list - expandable */}
                    {optionVoters.length > 0 && (
                      <TouchableOpacity
                        style={styles.votersToggle}
                        onPress={(e) => {
                          e.stopPropagation();
                          setExpandedOption(isExpanded ? null : bar);
                        }}
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
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            !loading && (
              <Text style={[styles.noVotesText, { color: subText, marginTop: 16 }]}>
                No options yet. Add an option to get started!
              </Text>
            )
          )}

          {/* Add Option Button */}
          <TouchableOpacity
            style={[styles.addOptionButton, { borderColor: border, backgroundColor: background }]}
            onPress={() => setOtherModalVisible(true)}
            activeOpacity={0.7}
            disabled={voting || !location}
          >
            {voting ? (
              <ActivityIndicator size="small" color={IU_CRIMSON} />
            ) : (
              <>
                <MaterialCommunityIcons name="plus-circle" size={20} color={IU_CRIMSON} />
                <Text style={[styles.addOptionText, { color: IU_CRIMSON }]}>
                  Add Option
                </Text>
              </>
            )}
          </TouchableOpacity>
        </Card.Content>
      </Card>

      {/* Add Option Modal */}
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
                Add an Option
              </Text>
              <Text style={[styles.otherModalSubtitle, { color: subText, marginBottom: 16 }]}>
                Add an option to vote for. You'll automatically vote for it when you add it.
              </Text>
              <TextInput
                style={[styles.otherInput, { color: text, borderColor: border, backgroundColor: background }]}
                placeholder="Enter option name..."
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
                  Add & Vote
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
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  resultItem: {
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  resultLabel: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  resultVotes: {
    fontSize: 12,
  },
  progressBarContainer: {
    height: 6,
    borderRadius: 6,
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
    marginBottom: 8,
  },
  otherModalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
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
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  votersToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingVertical: 6,
  },
  votersToggleText: {
    fontSize: 11,
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
  addOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    gap: 6,
  },
  addOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

