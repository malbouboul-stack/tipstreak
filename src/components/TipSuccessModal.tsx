import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, streakColors } from '../theme';
import GradientButton from './GradientButton';
import { useLanguage } from '../i18n/LanguageContext';
import { playTipSuccess } from '../lib/feedback';
import type { TxStep } from '../context/WalletContext';

// Les 7 barres du logo se remplissent au rythme réel de la transaction ; la pièce dorée tombe
// (son + vibration) quand Solana confirme. Puis le bouton OK s'active une fois le tip enregistré.
export type TipPhase = 'preparing' | TxStep | 'confirmed' | 'recorded';

const MARK_SIZE = 72;
const HEIGHTS = [0.34, 0.44, 0.54, 0.64, 0.75, 0.87, 1]; // mêmes proportions que StreakMark
const COIN_FALL_MS = 650;
const COIN_FIRST_IMPACT = 0.36; // Easing.bounce touche la barre la première fois vers 36 % de la chute

// Barres remplies visées à chaque étape, et durée pour y arriver. Pendant la confirmation, la progression
// avance lentement vers la 6e barre : l'écran n'est jamais figé, même si le réseau prend son temps.
const TARGETS: Record<Exclude<TipPhase, 'confirmed' | 'recorded'>, { bars: number; ms: number }> = {
  preparing: { bars: 1, ms: 350 },
  signing: { bars: 2, ms: 400 },
  sending: { bars: 4, ms: 500 },
  confirming: { bars: 6.4, ms: 5000 },
};

type Props = {
  visible: boolean;
  phase: TipPhase;
  amount: number;
  creatorName: string;
  boosted: boolean;
  contributed: boolean;
  onClose: () => void;
};

function ProgressMark({ phase }: { phase: TipPhase }) {
  const [progress] = useState(() => new Animated.Value(0));
  const [coin] = useState(() => new Animated.Value(0));
  const confirmed = phase === 'confirmed' || phase === 'recorded';

  useEffect(() => {
    if (confirmed) return;
    const { bars, ms } = TARGETS[phase as keyof typeof TARGETS];
    const animation = Animated.timing(progress, { toValue: bars, duration: ms, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [phase, confirmed, progress]);

  // Bouquet final : les dernières barres se remplissent, la pièce tombe, son et vibration à l'impact
  useEffect(() => {
    if (!confirmed) return;
    Animated.sequence([
      Animated.timing(progress, { toValue: HEIGHTS.length, duration: 320, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }),
      Animated.timing(coin, { toValue: 1, duration: COIN_FALL_MS, easing: Easing.bounce, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(playTipSuccess, 320 + COIN_FALL_MS * COIN_FIRST_IMPACT);
    return () => clearTimeout(timer);
  }, [confirmed, progress, coin]);

  const barWidth = MARK_SIZE / 8;
  const coinSize = barWidth * 1.25;
  return (
    <View style={{ height: MARK_SIZE, flexDirection: 'row', alignItems: 'flex-end', gap: barWidth * 0.45 }}>
      {HEIGHTS.map((ratio, i) => (
        <View key={i} style={{ width: barWidth, height: MARK_SIZE * ratio, justifyContent: 'flex-end' }}>
          {/* Emplacement de la barre, visible avant qu'elle se remplisse */}
          <View style={[StyleSheet.absoluteFill, { borderRadius: barWidth / 2, backgroundColor: colors.surface2 }]} />
          <Animated.View
            style={{
              height: '100%',
              borderRadius: barWidth / 2,
              backgroundColor: streakColors[i],
              transformOrigin: 'bottom',
              transform: [{ scaleY: progress.interpolate({ inputRange: [i, i + 1], outputRange: [0, 1], extrapolate: 'clamp' }) }],
            }}
          />
        </View>
      ))}
      <Animated.View
        style={{
          position: 'absolute',
          right: (barWidth - coinSize) / 2,
          bottom: MARK_SIZE * 1.07,
          width: coinSize,
          height: coinSize,
          borderRadius: coinSize / 2,
          backgroundColor: colors.gold,
          opacity: coin.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 1] }),
          transform: [{ translateY: coin.interpolate({ inputRange: [0, 1], outputRange: [-MARK_SIZE * 0.8, 0] }) }],
        }}
      />
    </View>
  );
}

export default function TipSuccessModal({ visible, phase, amount, creatorName, boosted, contributed, onClose }: Props) {
  const { t } = useLanguage();
  const [appear] = useState(() => new Animated.Value(0));
  const done = phase === 'confirmed' || phase === 'recorded';

  useEffect(() => {
    if (!visible) return;
    appear.setValue(0);
    Animated.timing(appear, { toValue: 1, duration: 280, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
  }, [visible, appear]);

  const status =
    phase === 'preparing'
      ? t('tip.phasePreparing')
      : phase === 'signing'
        ? t('tip.phaseWallet')
        : phase === 'sending'
          ? t('tip.phaseSending')
          : phase === 'confirming'
            ? t('tip.phaseNetwork')
            : t('tip.phaseSaving');

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
          {/* Monté à chaque ouverture : la progression repart de zéro pour chaque tip */}
          <View style={styles.mark}>{visible && <ProgressMark phase={phase} />}</View>
          <Text style={styles.title}>{done ? t('tip.successTitle') : t('tip.phaseTitle')}</Text>
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
              <Text style={styles.waitingText}>{status}</Text>
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
