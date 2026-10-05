import React, { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts } from '../theme';
import StreakMark from './StreakMark';
import { useLanguage } from '../i18n/LanguageContext';

const HOLD_AFTER_INTRO_MS = 600; // le temps que l'app se monte derrière, avant le fondu
const MAX_DURATION_MS = 6000; // on n'attend jamais plus, même si le réseau est lent

type Props = {
  ready: boolean; // données chargées : l'écran peut s'effacer
  onIntroPlayed: () => void; // animation terminée : l'app peut se monter derrière
  onDone: () => void; // fondu terminé : l'écran peut disparaître
};

// Écran de lancement : les 7 barres du logo poussent une à une, la pièce dorée tombe sur la
// dernière, puis le nom et le slogan apparaissent. L'animation se joue seule (l'app n'est montée
// qu'après), sinon le montage de l'app la rendrait saccadée ou invisible.
export default function LaunchScreen({ ready, onIntroPlayed, onDone }: Props) {
  const { t } = useLanguage();
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [introPlayed, setIntroPlayed] = useState(false);
  const [holdElapsed, setHoldElapsed] = useState(false);
  const [maxElapsed, setMaxElapsed] = useState(false);
  // Valeurs d'animation créées une seule fois (useState, pas useRef : lisibles pendant le rendu)
  const [wordmark] = useState(() => new Animated.Value(0));
  const [tagline] = useState(() => new Animated.Value(0));
  const [fadeOut] = useState(() => new Animated.Value(1));

  const finishIntro = useCallback(() => {
    setIntroPlayed(true);
    onIntroPlayed();
  }, [onIntroPlayed]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        setReduceMotion(reduce);
        // "Réduire les animations" activé : tout s'affiche directement
        if (reduce) {
          wordmark.setValue(1);
          tagline.setValue(1);
          finishIntro();
        }
      });
    const max = setTimeout(() => setMaxElapsed(true), MAX_DURATION_MS);
    return () => clearTimeout(max);
  }, [finishIntro, wordmark, tagline]);

  // Barres terminées → le nom puis le slogan montent
  const onBarsDone = useCallback(() => {
    Animated.sequence([
      Animated.timing(wordmark, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(tagline, { toValue: 1, duration: 360, useNativeDriver: true }),
    ]).start(() => finishIntro());
  }, [wordmark, tagline, finishIntro]);

  useEffect(() => {
    if (!introPlayed) return;
    const hold = setTimeout(() => setHoldElapsed(true), HOLD_AFTER_INTRO_MS);
    return () => clearTimeout(hold);
  }, [introPlayed]);

  const canLeave = (ready && holdElapsed) || maxElapsed;
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
      {/* On attend de savoir si les animations sont autorisées avant d'afficher le logo */}
      {reduceMotion === null ? (
        <View style={{ height: 84 }} />
      ) : (
        <StreakMark size={84} animate={!reduceMotion} onAnimationEnd={onBarsDone} />
      )}
      <Animated.Text style={[styles.wordmark, rise(wordmark)]}>
        Tip<Text style={styles.wordmarkAccent}>Streak</Text>
      </Animated.Text>
      <Animated.Text style={[styles.tagline, rise(tagline)]}>{t('launch.tagline')}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  wordmark: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 40, marginTop: 26, letterSpacing: -0.5 },
  wordmarkAccent: { color: colors.cyan },
  tagline: { color: colors.textDim, fontFamily: fonts.mono, fontSize: 12, letterSpacing: 2.4, marginTop: 10 },
});
