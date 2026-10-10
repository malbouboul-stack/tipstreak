import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Share, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { avatarColors, colors, fonts, sectionLabel, FAN_ACTIF_WEEKLY_TIPS, LEGEND_WEEKS } from '../theme';
import Avatar from '../components/Avatar';
import { ChevronLeft, ShareIcon, CheckIcon, LockIcon } from '../components/Icons';
import GradientButton from '../components/GradientButton';
import { getCreatorLink, useData } from '../context/DataContext';
import { useWallet } from '../context/WalletContext';
import { useCreatorTips } from '../data/useCreatorTips';
import SupportWall from '../components/SupportWall';
import SocialLinks from '../components/SocialLinks';
import PhotoViewer from '../components/PhotoViewer';
import { useLanguage } from '../i18n/LanguageContext';
import type { RootStackParamList } from '../../App';

export default function CreatorProfileScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'CreatorProfile'>>();
  const { loading, getCreator, getCreatorByHandle, getSupportRelation } = useData();
  const { t } = useLanguage();

  const creator = params.creatorId ? getCreator(params.creatorId) : getCreatorByHandle(params.handle ?? '');
  const relation = creator ? getSupportRelation(creator.id) : undefined;
  const { publicKey } = useWallet();
  const { tips, loading: tipsLoading, fetchedAt } = useCreatorTips(creator?.id);
  const [photoOpen, setPhotoOpen] = useState(false);

  // Ouvert par un lien profond au démarrage : les créateurs sont encore en chargement
  if (!creator && loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={[styles.container, { flex: 1, alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator color={colors.purple} />
        </View>
      </SafeAreaView>
    );
  }

  // Lien profond avec un handle qui n'existe pas
  if (!creator) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={[styles.container, { flex: 1, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={[styles.name, { marginBottom: 8 }]}>{t('creator.notFound')}</Text>
          <Text style={[styles.bio, { marginBottom: 20 }]}>
            {t('creator.notFoundText', { handle: params.handle ?? params.creatorId ?? '' })}
          </Text>
          <GradientButton
            label={t('creator.browse')}
            style={{ width: '100%' }}
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Tabs'))}
          />
        </View>
      </SafeAreaView>
    );
  }

  const link = getCreatorLink(creator);
  const isOwnPage = creator.walletAddress === publicKey;

  // Progression réelle du fan vers chaque badge (mêmes seuils que TierBadge)
  const weeklyCount = relation?.weeklyCount ?? 0;
  const consecutiveWeeks = relation?.consecutiveWeeks ?? 0;
  const loyaltyTiers = [
    {
      title: `💜 ${t('tier.supporter')}`,
      unlocked: !!relation,
      progress: relation ? t('creator.unlocked') : t('creator.supporterLocked'),
    },
    {
      title: `🔥 ${t('tier.fanActif')}`,
      unlocked: weeklyCount >= FAN_ACTIF_WEEKLY_TIPS,
      progress:
        weeklyCount >= FAN_ACTIF_WEEKLY_TIPS
          ? t('creator.unlockedThisWeek')
          : t('creator.fanProgress', { count: weeklyCount, goal: FAN_ACTIF_WEEKLY_TIPS }),
    },
    {
      title: `🏆 ${t('tier.legend')}`,
      unlocked: consecutiveWeeks >= LEGEND_WEEKS,
      progress:
        consecutiveWeeks >= LEGEND_WEEKS
          ? t('creator.unlocked')
          : t('creator.legendProgress', { count: consecutiveWeeks, goal: LEGEND_WEEKS }),
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topNav}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <ChevronLeft />
          </TouchableOpacity>
          <View style={{ width: 34 }} />
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => Share.share({ message: t('creator.shareMessage', { name: creator.name, link }) })}
          >
            <ShareIcon />
          </TouchableOpacity>
        </View>

        {/* Bannière aux couleurs propres au créateur (les mêmes que son avatar) */}
        <LinearGradient
          colors={[...avatarColors(creator.handle), colors.bg]}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cover}
        />

        <View style={styles.head}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={() => setPhotoOpen(true)}
            disabled={!creator.avatarUrl}
            activeOpacity={0.85}
            accessibilityRole="imagebutton"
            accessibilityLabel={creator.name}
          >
            <Avatar seed={creator.handle} initial={creator.initial} uri={creator.avatarUrl} size={72} ring />
          </TouchableOpacity>
          <Text style={styles.name}>{creator.name}</Text>
          <Text style={styles.cat}>{creator.category}</Text>
          <Text style={styles.link}>🔗 {link} · {t('creator.linkShared')}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statN}>{creator.supporters}</Text>
            <Text style={styles.statL}>{t('common.supporters')}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statN}>{creator.totalReceived}</Text>
            <Text style={styles.statL}>{t('creator.usdcReceived')}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statN, { color: colors.green }]}>🔥 {relation?.consecutiveWeeks ?? 0}</Text>
            <Text style={styles.statL}>{t('creator.yourStreak')}</Text>
          </View>
        </View>

        <Text style={styles.bio}>{creator.bio}</Text>
        <SocialLinks links={creator.links} />

        <Text style={styles.sectionLabel}>{t('creator.wall')}</Text>
        <View style={{ marginBottom: 16 }}>
          <SupportWall
            tips={tips}
            loading={tipsLoading}
            now={fetchedAt}
            currentWallet={publicKey}
            emptyText={t('creator.wallEmpty', { name: creator.name })}
          />
        </View>

        {isOwnPage ? (
          <Text style={styles.ownPageNote}>{t('creator.ownPage')}</Text>
        ) : (
          <>
            <Text style={styles.sectionLabel}>{t('creator.tiers')}</Text>
            {loyaltyTiers.map((tier) => (
              <View key={tier.title} style={styles.perkRow}>
                <View style={[styles.lock, tier.unlocked && { backgroundColor: 'rgba(20,241,149,0.12)' }]}>
                  {tier.unlocked ? <CheckIcon color={colors.green} /> : <LockIcon />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.perkTitle}>{tier.title}</Text>
                  <Text style={styles.perkSub}>{tier.progress}</Text>
                </View>
              </View>
            ))}

            <GradientButton
              label={t('creator.sendTip')}
              style={{ marginTop: 20 }}
              onPress={() => navigation.navigate('Tip', { creatorId: creator.id })}
            />
          </>
        )}
      </ScrollView>
      <PhotoViewer uri={photoOpen ? creator.avatarUrl : null} name={creator.name} onClose={() => setPhotoOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, paddingBottom: 40 },
  topNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 11, backgroundColor: colors.surface2,
    borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center',
  },
  cover: { height: 96, borderRadius: 22, marginBottom: -38 },
  head: { alignItems: 'center', paddingBottom: 14 },
  avatarWrap: { marginBottom: 10 },
  name: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 20 },
  cat: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  link: { color: colors.cyan, fontFamily: fonts.mono, fontSize: 11, marginTop: 6 },
  statsRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 22, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft, marginBottom: 14,
  },
  stat: { alignItems: 'center' },
  statN: { color: colors.text, fontFamily: fonts.monoBold, fontSize: 16 },
  statL: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 10 },
  bio: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, textAlign: 'center', marginBottom: 16 },
  sectionLabel,
  perkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 14, padding: 12, marginBottom: 8,
  },
  lock: { width: 26, height: 26, borderRadius: 8, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  perkTitle: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 12 },
  ownPageNote: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', marginTop: 8 },
  perkSub: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 10, marginTop: 1 },
});
