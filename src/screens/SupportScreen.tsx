import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, fonts, getWeeklyTier } from '../theme';
import { SearchIcon } from '../components/Icons';
import TierBadge from '../components/TierBadge';
import { useData } from '../context/DataContext';
import { useWallet } from '../context/WalletContext';

type Filter = 'all' | 'fanActif' | 'supporter';

export default function SupportScreen() {
  const navigation = useNavigation();
  const { publicKey } = useWallet();
  const { mySupport, getCreator } = useData();
  const [filter, setFilter] = useState<Filter>('all');

  const items = mySupport
    .flatMap((relation) => {
      const creator = getCreator(relation.creatorId);
      return creator ? [{ relation, creator }] : [];
    })
    .filter(({ relation }) => filter === 'all' || getWeeklyTier(relation.weeklyCount) === filter);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.topNav}>
          <Text style={styles.title}>Mes soutiens</Text>
          <View style={styles.iconBtn}>
            <SearchIcon size={16} />
          </View>
        </View>

        <View style={styles.filterRow}>
          <TouchableOpacity style={[styles.pill, filter === 'all' && styles.pillActive]} onPress={() => setFilter('all')}>
            <Text style={[styles.pillText, filter === 'all' && styles.pillTextActive]}>Tous ({mySupport.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.pill, filter === 'fanActif' && styles.pillActive]} onPress={() => setFilter('fanActif')}>
            <Text style={[styles.pillText, filter === 'fanActif' && styles.pillTextActive]}>Fan actif</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.pill, filter === 'supporter' && styles.pillActive]} onPress={() => setFilter('supporter')}>
            <Text style={[styles.pillText, filter === 'supporter' && styles.pillTextActive]}>Supporter</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={items}
          keyExtractor={(item) => item.creator.id}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {publicKey ? "Tu n'as encore envoyé aucun tip. Découvre des créateurs à soutenir !" : 'Connecte ton wallet (onglet Profil) pour voir tes soutiens.'}
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('CreatorProfile', { creatorId: item.creator.id })}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.creator.initial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.creator.name}</Text>
                <TierBadge weeklyCount={item.relation.weeklyCount} consecutiveWeeks={item.relation.consecutiveWeeks} />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.weeks}>{item.relation.consecutiveWeeks} sem.</Text>
                <Text style={styles.total}>{item.relation.totalTipped} USDC total</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, padding: 20 },
  topNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 20 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 11, backgroundColor: colors.surface2,
    borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center',
  },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  pill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 30, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.surface },
  pillActive: { backgroundColor: 'rgba(153,69,255,0.14)', borderColor: 'rgba(153,69,255,0.5)' },
  pillText: { color: colors.textDim, fontFamily: fonts.bodySemi, fontSize: 12 },
  pillTextActive: { color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.text, fontFamily: fonts.display, fontSize: 14 },
  name: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 13, marginBottom: 4 },
  weeks: { color: colors.text, fontFamily: fonts.display, fontSize: 14 },
  total: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 10 },
  empty: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', marginTop: 32 },
});
