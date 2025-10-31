import * as React from 'react';
import { View } from 'react-native';
import { Card, Text, Button, ProgressBar } from 'react-native-paper';
import { useThemeColors } from '../hooks/useThemeColors';

const IU_CRIMSON = '#990000';

export default function PollCard({ poll, onVote }) {
  const totalVotes = poll.options.reduce((sum, o) => sum + (o.votes || 0), 0) || 1;
  const { surface, text, subText, divider } = useThemeColors();

  return (
    <Card mode="contained" style={{ backgroundColor: surface, marginBottom: 12, borderRadius: 16 }}>
      <Card.Title title={poll.question} titleStyle={{ color: text }} />
      <Card.Content>
        {poll.options.map((opt) => {
          const ratio = (opt.votes || 0) / totalVotes;
          return (
            <View key={opt.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: text }}>{opt.label}</Text>
                <Text style={{ color: subText }}>{opt.votes} votes</Text>
              </View>
              <ProgressBar progress={ratio} color={IU_CRIMSON} style={{ height: 8, borderRadius: 8, backgroundColor: divider }} />
            </View>
          );
        })}
      </Card.Content>
      <Card.Actions>
        <Button mode="contained" buttonColor={IU_CRIMSON} textColor="#FFFFFF" onPress={() => onVote?.(poll.id)}>
          Vote
        </Button>
      </Card.Actions>
    </Card>
  );
}


