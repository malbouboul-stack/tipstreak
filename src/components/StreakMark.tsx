import React, { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { colors, streakColors } from '../theme';

// Logo TipStreak : 7 barres montantes, une par jour de la semaine, chacune de l'indigo au cyan —
// une série qui grandit et "chauffe" — et une pièce dorée (le tip) posée sur la plus haute.
const HEIGHTS = [0.34, 0.44, 0.54, 0.64, 0.75, 0.87, 1];
const BAR_STAGGER_MS = 110;
const BAR_DURATION_MS = 420;

type Props = {
  size: number; // hauteur des barres en px (la pièce dépasse au-dessus)
  animate?: boolean; // les barres poussent l'une après l'autre, puis la pièce tombe
  onAnimationEnd?: () => void;
};

export default function StreakMark({ size, animate = false, onAnimationEnd }: Props) {
  const barWidth = size / 8;
  const gap = barWidth * 0.45;
  const coinSize = barWidth * 1.25;
  // Valeur initiale figée au premier rendu : 0 si on anime, sinon logo déjà complet
  const [progress] = useState(() => HEIGHTS.map(() => new Animated.Value(animate ? 0 : 1)));
  const [coin] = useState(() => new Animated.Value(animate ? 0 : 1));

  useEffect(() => {
    if (!animate) return;
    // On attend que le premier écran soit affiché, sinon l'animation se jouerait "dans le vide"
    const frame = requestAnimationFrame(() => {
      Animated.sequence([
        Animated.stagger(
          BAR_STAGGER_MS,
          progress.map((value) =>
            Animated.timing(value, {
              toValue: 1,
              duration: BAR_DURATION_MS,
              easing: Easing.out(Easing.back(1.8)),
              useNativeDriver: true,
            })
          )
        ),
        Animated.timing(coin, { toValue: 1, duration: 650, easing: Easing.bounce, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) onAnimationEnd?.();
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [animate, progress, coin, onAnimationEnd]);

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
            borderRadius: barWidth / 2,
            backgroundColor: streakColors[i],
            transformOrigin: 'bottom',
            transform: [{ scaleY: progress[i] }],
          }}
        />
      ))}
      {/* La pièce dorée : tombe d'au-dessus et rebondit sur la dernière barre */}
      <Animated.View
        style={{
          position: 'absolute',
          right: (barWidth - coinSize) / 2,
          bottom: size + size * 0.07,
          width: coinSize,
          height: coinSize,
          borderRadius: coinSize / 2,
          backgroundColor: colors.gold,
          opacity: coin.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 1] }),
          transform: [{ translateY: coin.interpolate({ inputRange: [0, 1], outputRange: [-size * 0.8, 0] }) }],
        }}
      />
    </View>
  );
}
