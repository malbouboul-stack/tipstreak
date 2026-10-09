import React, { useEffect, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import StreakMark from './StreakMark';
import GradientButton from './GradientButton';
import { useLanguage } from '../i18n/LanguageContext';
import { playTipSuccess } from '../lib/feedback';

// Moment où la pièce du logo touche la dernière barre (7 barres décalées de 110 ms + 420 ms, puis la chute)
const COIN_LANDS_MS = 6 * 110 + 420 + 260;

type Props = {
  visible: boolean;
  amount: number;
  creatorName: string;
  boosted: boolean;
  contributed: boolean;
  onClose: () => void;
};

// Confirmation d'un tip : le logo se remplit, la pièce dorée tombe, son et vibration à l'impact
export default function TipSuccessModal({ visible, amount, creatorName, boosted, contributed, onClose }: Props) {
  const { t } = useLanguage();
  const [appear] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) return;
    appear.setValue(0);
    Animated.timing(appear, { toValue: 1, duration: 380, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
    const timer = setTimeout(playTipSuccess, COIN_LANDS_MS);
    return () => clearTimeout(timer);
  }, [visible, appear]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: appear,
              transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
            },
          ]}
        >
          <View style={styles.glow} />
          <View style={styles.mark}>{visible && <StreakMark size={72} animate />}</View>
          <Text style={styles.title}>{t('tip.successTitle')}</Text>
          <Text style={styles.amount}>
            {amount} <Text style={styles.currency}>USDC</Text>
          </Text>
          <Text style={styles.text}>{t('tip.successText', { amount, name: creatorName })}</Text>
          {boosted && (
            <View style={styles.boost}>
              <Text style={styles.boostText}>{t('tip.successBoost').trim()}</Text>
            </View>
          )}
          {contributed && <Text style={styles.thanks}>{t('tip.successContribution')}</Text>}
          <GradientButton label={t('common.ok')} onPress={onClose} style={{ alignSelf: 'stretch', marginTop: 8 }} />
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
  title: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 24 },
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
});
