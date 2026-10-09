import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, streakColors } from '../theme';
import StreakMark from './StreakMark';
import GradientButton from './GradientButton';
import { useLanguage } from '../i18n/LanguageContext';
import { playTipSuccess } from '../lib/feedback';

// sending   : retour du wallet, la transaction part sur Solana (barres qui ondulent)
// confirmed : confirmée on-chain, le logo se remplit et la pièce tombe (son + vibration)
// recorded  : enregistrée par TipStreak, le bouton OK s'active
export type TipPhase = 'sending' | 'confirmed' | 'recorded';

const MARK_SIZE = 72;
// Moment où la pièce du logo touche la dernière barre (7 barres décalées de 110 ms + 420 ms, puis la chute)
const COIN_LANDS_MS = 6 * 110 + 420 + 260;

type Props = {
  visible: boolean;
  phase: TipPhase;
  amount: number;
  creatorName: string;
  boosted: boolean;
  contributed: boolean;
  onClose: () => void;
};

// Pendant l'envoi : les 7 barres du logo ondulent doucement, comme un égaliseur
function PendingBars() {
  const [waves] = useState(() => streakColors.map(() => new Animated.Value(0)));
  useEffect(() => {
    const loops = waves.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 90),
          Animated.timing(value, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(value, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.delay((6 - i) * 90),
        ])
      )
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [waves]);

  const barWidth = MARK_SIZE / 8;
  return (
    <View style={{ height: MARK_SIZE, flexDirection: 'row', alignItems: 'flex-end', gap: barWidth * 0.45 }}>
      {waves.map((value, i) => (
        <Animated.View
          key={i}
          style={{
            width: barWidth,
            height: MARK_SIZE * 0.5,
            borderRadius: barWidth / 2,
            backgroundColor: streakColors[i],
            transformOrigin: 'bottom',
            opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
            transform: [{ scaleY: value.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }) }],
          }}
        />
      ))}
    </View>
  );
}

export default function TipSuccessModal({ visible, phase, amount, creatorName, boosted, contributed, onClose }: Props) {
  const { t } = useLanguage();
  const [appear] = useState(() => new Animated.Value(0));
  const done = phase !== 'sending';

  useEffect(() => {
    if (!visible) return;
    appear.setValue(0);
    Animated.timing(appear, { toValue: 1, duration: 320, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
  }, [visible, appear]);

  // Son et vibration au moment où la pièce touche la dernière barre
  useEffect(() => {
    if (!visible || !done) return;
    const timer = setTimeout(playTipSuccess, COIN_LANDS_MS);
    return () => clearTimeout(timer);
  }, [visible, done]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => phase === 'recorded' && onClose()}>
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.card,
            { opacity: appear, transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] },
          ]}
        >
          <View style={styles.glow} />
          <View style={styles.mark}>{done ? <StreakMark size={MARK_SIZE} animate /> : <PendingBars />}</View>
          <Text style={styles.title}>{done ? t('tip.successTitle') : t('tip.phaseSending')}</Text>
          <Text style={styles.amount}>
            {amount} <Text style={styles.currency}>USDC</Text>
          </Text>
          <Text style={styles.text}>{t('tip.successText', { amount, name: creatorName })}</Text>
          {done && boosted && (
            <View style={styles.boost}>
              <Text style={styles.boostText}>{t('tip.successBoost').trim()}</Text>
            </View>
          )}
          {done && contributed && <Text style={styles.thanks}>{t('tip.successContribution')}</Text>}
          {phase === 'recorded' ? (
            <GradientButton label={t('common.ok')} onPress={onClose} style={{ alignSelf: 'stretch', marginTop: 8 }} />
          ) : (
            <View style={styles.waiting}>
              <ActivityIndicator size="small" color={colors.textDim} />
              <Text style={styles.waitingText}>{done ? t('tip.phaseSaving') : t('tip.phaseNetwork')}</Text>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(4,3,10,0.82)', justifyContent: 'center', padding: 28 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 22,
    paddingTop: 34,
    paddingBottom: 22,
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -90,
    width: 260,
    height: 200,
    borderRadius: 130,
    backgroundColor: 'rgba(25,227,208,0.10)',
  },
  mark: { height: 96, justifyContent: 'flex-end', marginBottom: 6 },
  title: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 24, textAlign: 'center' },
  amount: { color: colors.green, fontFamily: fonts.monoBold, fontSize: 34 },
  currency: { color: colors.textDim, fontFamily: fonts.body, fontSize: 15 },
  text: { color: colors.textDim, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
  boost: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,184,77,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,184,77,0.45)',
  },
  boostText: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 13 },
  thanks: { color: colors.cyan, fontFamily: fonts.bodySemi, fontSize: 12, textAlign: 'center' },
  // Même hauteur que le bouton OK : la carte ne "saute" pas quand il apparaît
  waiting: { alignSelf: 'stretch', height: 52, marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  waitingText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13 },
});
