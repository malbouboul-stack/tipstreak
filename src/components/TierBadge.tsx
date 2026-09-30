import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, gradient, getWeeklyTier, isLegend, tierLabel } from '../theme';

type Props = {
  weeklyCount: number;
  consecutiveWeeks: number;
};

export default function TierBadge({ weeklyCount, consecutiveWeeks }: Props) {
  const legend = isLegend(consecutiveWeeks);
  const tier = getWeeklyTier(weeklyCount);

  if (legend) {
    return (
      <View style={[styles.badge, { backgroundColor: 'rgba(255,184,77,0.12)', borderColor: 'rgba(255,184,77,0.4)' }]}>
        <Text style={[styles.text, { color: colors.gold }]}>🏆 Légende</Text>
      </View>
    );
  }

  if (tier === 'fanActif') {
    return (
      <LinearGradient
        colors={['rgba(153,69,255,0.18)', 'rgba(20,241,149,0.18)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.badge, { borderColor: 'rgba(20,241,149,0.4)' }]}
      >
        <Text style={[styles.text, { color: colors.green }]}>🔥 {tierLabel.fanActif}</Text>
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.badge, { backgroundColor: 'rgba(153,69,255,0.14)', borderColor: 'rgba(153,69,255,0.35)' }]}>
      <Text style={[styles.text, { color: colors.purple }]}>{tierLabel.supporter}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  text: { fontFamily: fonts.bodyBold, fontSize: 10 },
});
