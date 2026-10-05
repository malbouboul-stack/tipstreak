import React, { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradientStreak } from '../theme';

// Logo TipStreak : 7 barres montantes, une par jour de la semaine — une série qui grandit —
// et une pièce (le tip) posée sur la plus haute. Dégradé cyan (Seeker) → violet (Solana).
const HEIGHTS = [0.34, 0.44, 0.54, 0.64, 0.75, 0.87, 1];
const BAR_STAGGER_MS = 70;
const BAR_DURATION_MS = 380;

type Props = {
  size: number; // hauteur des barres en px (la pièce dépasse au-dessus)
  animate?: boolean; // les barres poussent l'une après l'autre, puis la pièce tombe
  delay?: number;
};

export default function StreakMark({ size, animate = false, delay = 0 }: Props) {
  const barWidth = size / 8;
  const gap = barWidth * 0.45;
  const coinSize = barWidth * 1.25;
  const [progress] = useState(() => HEIGHTS.map(() => new Animated.Value(animate ? 0 : 1)));
  const [coin] = useState(() => new Animated.Value(animate ? 0 : 1));

  useEffect(() => {
    if (!animate) return;
    Animated.sequence([
      Animated.stagger(
        BAR_STAGGER_MS,
        progress.map((value, i) =>
          Animated.timing(value, {
            toValue: 1,
            duration: BAR_DURATION_MS,
            delay: i === 0 ? delay : 0,
            easing: Easing.out(Easing.back(1.6)),
            useNativeDriver: true,
          })
        )
      ),
      Animated.timing(coin, { toValue: 1, duration: 520, easing: Easing.bounce, useNativeDriver: true }),
    ]).start();
  }, [animate, delay, progress, coin]);

  return (
    <View
      style={{ height: size, flexDirection: 'row', alignItems: 'flex-end', gap }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {HEIGHTS.map((ratio, i) => (
        <Animated.View
          key={i}
          style={{
            width: barWidth,
            height: size * ratio,
            transformOrigin: 'bottom',
            transform: [{ scaleY: progress[i] }],
          }}
        >
          <LinearGradient
            colors={gradientStreak}
            start={{ x: 0, y: 1 }}
            end={{ x: 0, y: 0 }}
            style={{ flex: 1, borderRadius: barWidth / 2 }}
          />
        </Animated.View>
      ))}
      {/* La pièce : tombe d'au-dessus et rebondit sur la dernière barre */}
      <Animated.View
        style={{
          position: 'absolute',
          right: (barWidth - coinSize) / 2,
          bottom: size + size * 0.07,
          width: coinSize,
          height: coinSize,
          borderRadius: coinSize / 2,
          backgroundColor: colors.green,
          opacity: coin.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 1] }),
          transform: [{ translateY: coin.interpolate({ inputRange: [0, 1], outputRange: [-size * 0.7, 0] }) }],
        }}
      />
    </View>
  );
}
