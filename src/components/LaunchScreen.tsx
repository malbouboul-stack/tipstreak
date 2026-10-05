import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts } from '../theme';
import StreakMark from './StreakMark';
import { useLanguage } from '../i18n/LanguageContext';

const MIN_DURATION_MS = 2200; // le temps de voir l'animation (barres, pièce, nom)
const MAX_DURATION_MS = 4000; // on n'attend jamais plus, même si le réseau est lent

type Props = {
  ready: boolean; // données chargées : l'écran peut s'effacer
  onDone: () => void;
};

// Écran de lancement : les 7 barres du logo poussent, puis le nom et le slogan apparaissent,
// pendant que l'app charge ses données en dessous. Il s'efface en fondu.
export default function LaunchScreen({ ready, onDone }: Props) {
  const { t } = useLanguage();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const [maxElapsed, setMaxElapsed] = useState(false);
  // Valeurs d'animation créées une seule fois (useState, pas useRef : lisibles pendant le rendu)
  const [wordmark] = useState(() => new Animated.Value(0));
  const [tagline] = useState(() => new Animated.Value(0));
  const [fadeOut] = useState(() => new Animated.Value(1));

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    Animated.sequence([
      Animated.delay(950), // pendant que la pièce rebondit sur la dernière barre
      Animated.timing(wordmark, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(tagline, { toValue: 1, duration: 360, useNativeDriver: true }),
    ]).start();
    const min = setTimeout(() => setMinElapsed(true), MIN_DURATION_MS);
    const max = setTimeout(() => setMaxElapsed(true), MAX_DURATION_MS);
    return () => {
      clearTimeout(min);
      clearTimeout(max);
    };
  }, [wordmark, tagline]);

  const canLeave = (ready && minElapsed) || maxElapsed;
  useEffect(() => {
    if (!canLeave) return;
    Animated.timing(fadeOut, { toValue: 0, duration: 380, useNativeDriver: true }).start(({ finished }) => {
      if (finished) onDone();
    });
  }, [canLeave, fadeOut, onDone]);

  const rise = (value: Animated.Value) => ({
    opacity: value,
    transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fadeOut }]} accessibilityLabel="TipStreak">
      <LinearGradient
        colors={['rgba(153,69,255,0.20)', 'rgba(8,7,14,0)', 'rgba(25,227,208,0.14)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <StreakMark size={84} animate={!reduceMotion} delay={120} />
      <Animated.Text style={[styles.wordmark, reduceMotion ? null : rise(wordmark)]}>
        Tip<Text style={styles.wordmarkAccent}>Streak</Text>
      </Animated.Text>
      <Animated.Text style={[styles.tagline, reduceMotion ? null : rise(tagline)]}>{t('launch.tagline')}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  wordmark: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 40, marginTop: 26, letterSpacing: -0.5 },
  wordmarkAccent: { color: colors.cyan },
  tagline: { color: colors.textDim, fontFamily: fonts.mono, fontSize: 12, letterSpacing: 2.4, marginTop: 10 },
});
