import * as React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Card, Text, Button, ProgressBar } from 'react-native-paper';
import { useThemeColors } from '../hooks/useThemeColors';

const IU_CRIMSON = '#DC143C';

export default function PollCard({ poll, onVote, currentUserId, showVoteButton = true }) {
  const totalVotes = poll.options.reduce((sum, o) => sum + (o.votes || 0), 0) || 1;
  const { surface, text, subText, divider } = useThemeColors();
  
  // Find which option the current user voted for
  const userVotedOptionId = React.useMemo(() => {
    if (!currentUserId) return null;
    for (const option of poll.options || []) {
      if (option.voters && option.voters.includes(currentUserId)) {
        return option.id;
      }
    }
    return null;
  }, [poll.options, currentUserId]);

  const handleOptionPress = (optionId) => {
    if (onVote && showVoteButton) {
      onVote(poll.id, optionId);
    }
  };

  return (
    <Card mode="contained" style={{ backgroundColor: surface, marginBottom: 12, borderRadius: 16 }}>
      <Card.Title 
        title={poll.question} 
        titleStyle={{ color: text }}
        subtitle={poll.creatorName ? `Created by ${poll.creatorName}` : undefined}
        subtitleStyle={{ color: subText, fontSize: 12 }}
      />
      <Card.Content>
        {(poll.options || []).map((opt) => {
          const ratio = (opt.votes || 0) / totalVotes;
          const isVoted = userVotedOptionId === opt.id;
          
          return (
            <TouchableOpacity
              key={opt.id}
              onPress={() => handleOptionPress(opt.id)}
              disabled={!showVoteButton}
              style={{
                marginBottom: 10,
                padding: 8,
                borderRadius: 8,
                backgroundColor: isVoted ? (IU_CRIMSON + '20') : 'transparent',
                borderWidth: isVoted ? 2 : 0,
                borderColor: IU_CRIMSON,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Text style={{ color: text, fontSize: 16, flex: 1 }}>{opt.label}</Text>
                  {isVoted && (
                    <Text style={{ color: IU_CRIMSON, fontSize: 12, fontWeight: '600', marginLeft: 8 }}>
                      Your vote
                    </Text>
                  )}
                </View>
                <Text style={{ color: subText, fontSize: 14, marginLeft: 8 }}>
                  {opt.votes || 0} {opt.votes === 1 ? 'vote' : 'votes'}
                </Text>
              </View>
              <ProgressBar 
                progress={ratio} 
                color={IU_CRIMSON} 
                style={{ height: 8, borderRadius: 8, backgroundColor: divider }} 
              />
            </TouchableOpacity>
          );
        })}
      </Card.Content>
      {totalVotes === 0 && showVoteButton && (
        <Card.Actions>
          <Text style={{ color: subText, fontSize: 12, paddingHorizontal: 16 }}>
            Tap an option above to vote
          </Text>
        </Card.Actions>
      )}
    </Card>
  );
}


