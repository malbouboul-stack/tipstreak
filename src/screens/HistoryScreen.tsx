import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { TipSentIcon } from '../components/Icons';
import { Tip, useData } from '../context/DataContext';
import { useWallet } from '../context/WalletContext';
import { useLanguage } from '../i18n/LanguageContext';

// Nombre de jours entre la date et aujourd'hui (0 = aujourd'hui, 1 = hier…)
function daysAgo(date: Date): number {
  const day = new Date(date).setHours(0, 0, 0, 0);
  const today = new Date().setHours(0, 0, 0, 0);
  return Math.round((today - day) / (24 * 60 * 60 * 1000));
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function HistoryScreen() {
  const { publicKey } = useWallet();
  const { myTips } = useData();
  const { t, locale } = useLanguage();

  // "AUJOURD'HUI", "HIER", sinon "LUN. 15 SEPT." (ou l'équivalent en anglais)
  const dateGroup = (date: Date): string => {
    const diff = daysAgo(date);
    if (diff === 0) return t('history.today');
    if (diff === 1) return t('history.yesterday');
    return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
  };

  // myTips est déjà trié du plus récent au plus ancien : l'ordre des groupes suit
  const groups = new Map<string, Tip[]>();
  for (const tip of myTips) {
    const key = dateGroup(tip.createdAt);
    groups.set(key, [...(groups.get(key) ?? []), tip]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t('history.title')}</Text>

        {myTips.length === 0 && (
          <Text style={styles.empty}>{publicKey ? t('history.emptyConnected') : t('history.emptyDisconnected')}</Text>
        )}

        {[...groups].map(([group, tips]) => (
          <View key={group}>
            <Text style={styles.dateLabel}>{group}</Text>
            {tips.map((item) => (
              <View key={item.signature} style={styles.row}>
                <View style={styles.icon}>
                  <TipSentIcon />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{item.creatorName}</Text>
                    {item.boosted && (
                      <View style={styles.boostTag}>
                        <Text style={styles.boostTagText}>{t('history.boosted')}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.meta} numberOfLines={1}>
                    {t('history.tipAt', { time: formatTime(item.createdAt) })}
                    {item.message ? ` · « ${item.message} »` : ''}
                  </Text>
                </View>
                <Text style={styles.amount}>-{item.amount.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 20, marginBottom: 16 },
  empty: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', marginTop: 32 },
  dateLabel: { color: colors.textFaint, fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.4, marginVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  icon: { width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(153,69,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 13 },
  meta: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 1 },
  amount: { color: colors.text, fontFamily: fonts.monoBold, fontSize: 13 },
  boostTag: {
    backgroundColor: 'rgba(255,184,77,0.12)', borderWidth: 1, borderColor: 'rgba(255,184,77,0.35)',
    borderRadius: 8, paddingVertical: 1, paddingHorizontal: 6,
  },
  boostTagText: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 9 },
});
