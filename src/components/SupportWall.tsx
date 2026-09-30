import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, fonts } from '../theme';
import { CreatorTip } from '../data/useCreatorTips';
import { shortenAddress } from '../context/WalletContext';
import { useLanguage } from '../i18n/LanguageContext';

// Un tip boosté reste épinglé en haut du mur pendant 7 jours
const PIN_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

type Props = {
  tips: CreatorTip[];
  loading: boolean;
  currentWallet?: string | null; // pour afficher "Toi" sur ses propres tips
  emptyText: string;
};

export default function SupportWall({ tips, loading, currentWallet, emptyText }: Props) {
  const { t, locale } = useLanguage();

  const formatRelative = (date: Date): string => {
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return t('wall.justNow');
    if (minutes < 60) return t('wall.minutesAgo', { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('wall.hoursAgo', { count: hours });
    if (hours < 48) return t('wall.yesterday');
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  };

  if (loading && tips.length === 0) {
    return <ActivityIndicator color={colors.purple} style={{ marginVertical: 16 }} />;
  }
  if (tips.length === 0) {
    return <Text style={styles.empty}>{emptyText}</Text>;
  }

  const pinCutoff = Date.now() - PIN_DURATION_MS;
  const pinned = tips.filter((t) => t.boosted && t.createdAt.getTime() >= pinCutoff);
  const others = tips.filter((t) => !pinned.includes(t));

  const renderTip = (tip: CreatorTip, isPinned: boolean) => (
    <View key={tip.signature} style={[styles.row, isPinned && styles.rowPinned]}>
      <View style={{ flex: 1 }}>
        <View style={styles.headLine}>
          <Text style={styles.fan}>{tip.fanWallet === currentWallet ? t('wall.you') : shortenAddress(tip.fanWallet)}</Text>
          {isPinned && <Text style={styles.pinTag}>{t('wall.pinned')}</Text>}
          <Text style={styles.time}>{formatRelative(tip.createdAt)}</Text>
        </View>
        {tip.message && <Text style={styles.message}>« {tip.message} »</Text>}
      </View>
      <Text style={styles.amount}>{tip.amount.toFixed(2)} USDC</Text>
    </View>
  );

  return (
    <View>
      {pinned.map((t) => renderTip(t, true))}
      {others.map((t) => renderTip(t, false))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', marginVertical: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 14, padding: 12, marginBottom: 8,
  },
  rowPinned: { backgroundColor: 'rgba(255,184,77,0.08)', borderColor: 'rgba(255,184,77,0.4)' },
  headLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fan: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 12 },
  pinTag: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 9 },
  time: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 10 },
  message: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12, marginTop: 4 },
  amount: { color: colors.green, fontFamily: fonts.display, fontSize: 13 },
});
