import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, gradientStreak, sectionLabel } from '../theme';
import { SearchIcon } from '../components/Icons';
import TierBadge from '../components/TierBadge';
import Avatar from '../components/Avatar';
import StreakMark from '../components/StreakMark';
import { Creator, useData } from '../context/DataContext';
import { useWallet } from '../context/WalletContext';
import { useLanguage } from '../i18n/LanguageContext';
import { weekStart } from '../data/streaks';

const ALL = '__all__'; // filtre "Tout" : libellé traduit à l'affichage
const DAY_MS = 24 * 60 * 60 * 1000;

// "Musique · Producteur" → "Musique" : les créateurs écrivent librement leur catégorie,
// on regroupe sur le premier mot-clé, sans tenir compte des majuscules
function mainCategory(category: string): string {
  const main = category.split('·')[0].trim();
  return main.charAt(0).toUpperCase() + main.slice(1).toLowerCase();
}

// Ligne qui apparaît en glissant, en décalé selon sa position
function RiseIn({ index, children }: { index: number; children: React.ReactNode }) {
  const [value] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(value, {
      toValue: 1,
      duration: 380,
      delay: 120 + index * 70,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [index, value]);
  return (
    <Animated.View
      style={{ opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}
    >
      {children}
    </Animated.View>
  );
}

// Carte "Ta semaine de soutien" : les 7 jours de la semaine, ceux où tu as envoyé un tip sont
// remplis — le même motif que le logo. En dessous, les chiffres de la communauté.
function WeekCard() {
  const { t } = useLanguage();
  const { publicKey } = useWallet();
  const { myTips, mySupport, creators } = useData();

  const start = weekStart(new Date());
  const todayIndex = Math.min(6, Math.floor((new Date().getTime() - start) / DAY_MS));
  const tippedDays = new Set(
    myTips.filter((tip) => tip.createdAt.getTime() >= start).map((tip) => Math.floor((tip.createdAt.getTime() - start) / DAY_MS))
  );
  const bestStreak = mySupport.reduce((max, s) => Math.max(max, s.consecutiveWeeks), 0);
  const totalUsdc = creators.reduce((sum, c) => sum + c.totalReceived, 0);
  const totalFans = creators.reduce((sum, c) => sum + c.supporters, 0);
  const letters = t('discover.weekdays').split(',');

  const message = !publicKey
    ? t('discover.connectHint')
    : bestStreak > 0
      ? t('discover.streakActive', { count: bestStreak })
      : t('discover.streakStart');

  return (
    <LinearGradient
      colors={['rgba(153,69,255,0.22)', 'rgba(25,227,208,0.08)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.weekCard}
    >
      <View style={styles.weekHead}>
        <Text style={[sectionLabel, { marginBottom: 0, color: colors.textDim }]}>{t('discover.weekTitle')}</Text>
        {bestStreak > 0 && <Text style={styles.weekStreak}>🔥 {bestStreak}</Text>}
      </View>

      <View style={styles.days}>
        {letters.map((letter, i) => {
          const tipped = tippedDays.has(i);
          const isToday = i === todayIndex;
          return (
            <View key={i} style={styles.day}>
              <View style={[styles.dayBar, isToday && styles.dayBarToday, i > todayIndex && styles.dayBarFuture]}>
                {tipped && (
                  <LinearGradient colors={gradientStreak} start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }} style={StyleSheet.absoluteFill} />
                )}
              </View>
              <Text style={[styles.dayLetter, isToday && { color: colors.cyan }]}>{letter}</Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.weekMessage}>{message}</Text>

      <View style={styles.stats}>
        <Text style={styles.stat}>
          <Text style={styles.statNumber}>{creators.length}</Text> {t('discover.statCreators')}
        </Text>
        <Text style={styles.statDot}>·</Text>
        <Text style={styles.stat}>
          <Text style={[styles.statNumber, { color: colors.green }]}>{totalUsdc.toFixed(0)}</Text> {t('discover.statUsdc')}
        </Text>
        <Text style={styles.statDot}>·</Text>
        <Text style={styles.stat}>
          <Text style={styles.statNumber}>{totalFans}</Text> {t('discover.statFans')}
        </Text>
      </View>
    </LinearGradient>
  );
}

export default function DiscoverScreen() {
  const navigation = useNavigation();
  const { creators, getSupportRelation, loading, error, refresh } = useData();
  const { t, translateError } = useLanguage();
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

  const renderRow = (creator: Creator, index: number) => {
    const relation = getSupportRelation(creator.id);
    return (
      <RiseIn key={creator.id} index={index}>
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('CreatorProfile', { creatorId: creator.id })}
        >
          <Avatar seed={creator.handle} initial={creator.initial} size={46} />
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {creator.name}
              </Text>
              {relation && <TierBadge weeklyCount={relation.weeklyCount} consecutiveWeeks={relation.consecutiveWeeks} />}
            </View>
            <Text style={styles.cat} numberOfLines={1}>
              {creator.category} · <Text style={styles.handle}>@{creator.handle}</Text>
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.count}>{creator.supporters}</Text>
            <Text style={styles.countLbl}>{t('discover.supportersLower')}</Text>
          </View>
        </TouchableOpacity>
      </RiseIn>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.cyan} />}
      >
        <View style={styles.brandRow}>
          <StreakMark size={22} />
          <Text style={styles.brand}>
            Tip<Text style={{ color: colors.cyan }}>Streak</Text>
          </Text>
        </View>

        <WeekCard />

        <Text style={styles.title}>{t('discover.title')}</Text>

        <View style={styles.searchField}>
          <SearchIcon size={16} color={colors.textFaint} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('discover.search')}
            placeholderTextColor={colors.textFaint}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow} contentContainerStyle={{ gap: 8 }}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.pill, category === cat && styles.pillActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.pillText, category === cat && styles.pillTextActive]}>{cat === ALL ? t('discover.all') : cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading && creators.length === 0 && <ActivityIndicator color={colors.cyan} style={{ marginTop: 24 }} />}
        {error && <Text style={styles.error}>{translateError(error)}</Text>}

        {!loading && filtered.length === 0 && (
          <View style={styles.empty}>
            <View style={{ opacity: 0.35 }}>
              <StreakMark size={40} />
            </View>
            <Text style={styles.emptyText}>{t('discover.noResults')}</Text>
          </View>
        )}

        {trending.length > 0 && (
          <>
            <Text style={sectionLabel}>{t('discover.trending')}</Text>
            {trending.map((c, i) => renderRow(c, i))}
          </>
        )}
        {fresh.length > 0 && (
          <>
            <Text style={[sectionLabel, { marginTop: 14 }]}>{t('discover.new')}</Text>
            {fresh.map((c, i) => renderRow(c, i + trending.length))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, paddingBottom: 32 },
  brandRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 18 },
  brand: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 24, letterSpacing: -0.3 },

  weekCard: { borderRadius: 22, borderWidth: 1, borderColor: 'rgba(153,69,255,0.35)', padding: 16, marginBottom: 22 },
  weekHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  weekStreak: { color: colors.cyan, fontFamily: fonts.monoBold, fontSize: 16 },
  days: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  day: { flex: 1, alignItems: 'center', gap: 6 },
  dayBar: {
    width: '100%', height: 38, borderRadius: 10, overflow: 'hidden',
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
  },
  dayBarToday: { borderColor: colors.cyan, borderWidth: 1.5 },
  dayBarFuture: { opacity: 0.45 },
  dayLetter: { color: colors.textFaint, fontFamily: fonts.mono, fontSize: 11 },
  weekMessage: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 13, marginTop: 14 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 10 },
  stat: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12 },
  statNumber: { color: colors.text, fontFamily: fonts.monoBold, fontSize: 13 },
  statDot: { color: colors.textFaint, fontSize: 12 },

  title: { color: colors.text, fontFamily: fonts.display, fontSize: 22, marginBottom: 14 },
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
  catRow: { flexGrow: 0, marginBottom: 18 },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  pillActive: { backgroundColor: 'rgba(25,227,208,0.12)', borderColor: 'rgba(25,227,208,0.55)' },
  pillText: { color: colors.textDim, fontFamily: fonts.bodySemi, fontSize: 12 },
  pillTextActive: { color: colors.cyan },
  error: { color: '#FF6B6B', fontFamily: fonts.body, fontSize: 12, marginBottom: 12 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 28 },
  emptyText: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 8,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 18,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 14, flexShrink: 1 },
  cat: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 3 },
  handle: { fontFamily: fonts.mono, color: colors.textFaint },
  count: { color: colors.text, fontFamily: fonts.monoBold, fontSize: 15 },
  countLbl: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 10 },
});
