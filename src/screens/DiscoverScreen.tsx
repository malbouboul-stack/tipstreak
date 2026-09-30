import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, fonts } from '../theme';
import { SearchIcon } from '../components/Icons';
import TierBadge from '../components/TierBadge';
import { Creator, useData } from '../context/DataContext';

const ALL = 'Tout';

// "Musique · Producteur" → "Musique" : les créateurs écrivent librement leur catégorie,
// on regroupe sur le premier mot-clé, sans tenir compte des majuscules
function mainCategory(category: string): string {
  const main = category.split('·')[0].trim();
  return main.charAt(0).toUpperCase() + main.slice(1).toLowerCase();
}

export default function DiscoverScreen() {
  const navigation = useNavigation();
  const { creators, getSupportRelation, loading, error, refresh } = useData();
  const [query, setQuery] = useState('');
  const [selectedCategory, setCategory] = useState(ALL);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  // Filtres générés depuis la base : les plus représentées d'abord
  const counts = new Map<string, number>();
  for (const c of creators) {
    const main = mainCategory(c.category);
    counts.set(main, (counts.get(main) ?? 0) + 1);
  }
  const categories = [ALL, ...[...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name)];
  // La catégorie choisie peut disparaître après un rafraîchissement
  const category = categories.includes(selectedCategory) ? selectedCategory : ALL;

  const search = query.trim().toLowerCase();
  const filtered = creators.filter((c) => {
    const matchesQuery = c.name.toLowerCase().includes(search) || c.handle.includes(search);
    const matchesCategory = category === ALL || mainCategory(c.category) === category;
    return matchesQuery && matchesCategory;
  });

  const trending = filtered.slice(0, 3);
  const fresh = filtered.slice(3);

  const renderRow = (creator: Creator) => {
    const relation = getSupportRelation(creator.id);
    return (
      <TouchableOpacity
        key={creator.id}
        style={styles.row}
        onPress={() => navigation.navigate('CreatorProfile', { creatorId: creator.id })}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{creator.initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{creator.name}</Text>
            {relation && <TierBadge weeklyCount={relation.weeklyCount} consecutiveWeeks={relation.consecutiveWeeks} />}
          </View>
          <Text style={styles.cat}>{creator.category}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.count}>{creator.supporters}</Text>
          <Text style={styles.countLbl}>supporters</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.title}>Découvrir</Text>

        <View style={styles.searchField}>
          <SearchIcon size={16} color={colors.textFaint} />
          <TextInput
            style={styles.searchInput}
            placeholder="Chercher un créateur"
            placeholderTextColor={colors.textFaint}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow} contentContainerStyle={{ gap: 8 }}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.pill, category === cat && styles.pillActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.pillText, category === cat && styles.pillTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purple} />}
        >
          {loading && creators.length === 0 && <ActivityIndicator color={colors.purple} style={{ marginTop: 24 }} />}
          {error && <Text style={styles.error}>{error}</Text>}
          {trending.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Tendances cette semaine</Text>
              {trending.map(renderRow)}
            </>
          )}
          {fresh.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 14 }]}>Nouveaux sur TipStreak</Text>
              {fresh.map(renderRow)}
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, padding: 20 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 22, marginBottom: 16 },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  searchInput: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 14, paddingVertical: 12 },
  catRow: { flexGrow: 0, marginBottom: 16 },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  pillActive: { backgroundColor: 'rgba(153,69,255,0.14)', borderColor: 'rgba(153,69,255,0.5)' },
  pillText: { color: colors.textDim, fontFamily: fonts.bodySemi, fontSize: 12 },
  pillTextActive: { color: colors.text },
  sectionLabel: { color: colors.textFaint, fontFamily: fonts.bodyBold, fontSize: 12, marginBottom: 10 },
  error: { color: '#FF6B6B', fontFamily: fonts.body, fontSize: 12, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.text, fontFamily: fonts.display, fontSize: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 13 },
  cat: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  count: { color: colors.text, fontFamily: fonts.display, fontSize: 13 },
  countLbl: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 10 },
});
