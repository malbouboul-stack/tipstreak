import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Share, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { colors, fonts } from '../theme';
import { ChevronLeft, ShareIcon, CheckIcon, LockIcon } from '../components/Icons';
import GradientButton from '../components/GradientButton';
import { getCreatorLink, useData } from '../context/DataContext';
import { useWallet } from '../context/WalletContext';
import { useCreatorTips } from '../data/useCreatorTips';
import SupportWall from '../components/SupportWall';
import type { RootStackParamList } from '../../App';

export default function CreatorProfileScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'CreatorProfile'>>();
  const { loading, getCreator, getCreatorByHandle, getSupportRelation } = useData();

  const creator = params.creatorId ? getCreator(params.creatorId) : getCreatorByHandle(params.handle ?? '');
  const relation = creator ? getSupportRelation(creator.id) : undefined;
  const { publicKey } = useWallet();
  const { tips, loading: tipsLoading } = useCreatorTips(creator?.id);

  // Ouvert par un lien profond au démarrage : les créateurs sont encore en chargement
  if (!creator && loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={[styles.container, { flex: 1, alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator color={colors.purple} />
        </View>
      </SafeAreaView>
    );
  }

  // Lien profond avec un handle qui n'existe pas
  if (!creator) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={[styles.container, { flex: 1, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={[styles.name, { marginBottom: 8 }]}>Créateur introuvable</Text>
          <Text style={[styles.bio, { marginBottom: 20 }]}>Aucun créateur ne correspond à « {params.handle ?? params.creatorId} ».</Text>
          <GradientButton
            label="Découvrir des créateurs"
            style={{ width: '100%' }}
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Tabs'))}
          />
        </View>
      </SafeAreaView>
    );
  }

  const link = getCreatorLink(creator);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topNav}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <ChevronLeft />
          </TouchableOpacity>
          <View style={{ width: 34 }} />
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => Share.share({ message: `Soutiens ${creator.name} sur TipStreak : ${link}` })}
          >
            <ShareIcon />
          </TouchableOpacity>
        </View>

        <LinearGradient colors={[colors.purple, colors.green]} style={styles.cover} />

        <View style={styles.head}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{creator.initial}</Text>
          </View>
          <Text style={styles.name}>{creator.name}</Text>
          <Text style={styles.cat}>{creator.category}</Text>
          <Text style={styles.link}>🔗 {link} · partagé par le créateur</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statN}>{creator.supporters}</Text>
            <Text style={styles.statL}>Supporters</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statN}>{creator.totalReceived}</Text>
            <Text style={styles.statL}>USDC reçus</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statN, { color: colors.green }]}>🔥 {relation?.consecutiveWeeks ?? 0}</Text>
            <Text style={styles.statL}>Toi : streak</Text>
          </View>
        </View>

        <Text style={styles.bio}>{creator.bio}</Text>

        <Text style={styles.sectionLabel}>Mur des soutiens</Text>
        <View style={{ marginBottom: 16 }}>
          <SupportWall
            tips={tips}
            loading={tipsLoading}
            currentWallet={publicKey}
            emptyText={`Personne n'a encore soutenu ${creator.name}. Sois le premier !`}
          />
        </View>

        <Text style={styles.sectionLabel}>Perks</Text>
        <View style={styles.perkRow}>
          <View style={[styles.lock, { backgroundColor: colors.surface2 }]}>
            <CheckIcon color={colors.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.perkTitle}>Accès Discord privé</Text>
            <Text style={styles.perkSub}>Débloqué — tu es {relation ? 'Supporter' : 'pas encore abonné'}</Text>
          </View>
        </View>
        <View style={styles.perkRow}>
          <View style={styles.lock}>
            <LockIcon />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.perkTitle}>Instru exclusive du mois</Text>
            <Text style={styles.perkSub}>Débloqué à 3 tips/semaine</Text>
          </View>
        </View>

        <GradientButton
          label="Envoyer un tip"
          style={{ marginTop: 20 }}
          onPress={() => navigation.navigate('Tip', { creatorId: creator.id })}
        />
      </ScrollView>
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
  cover: { height: 84, borderRadius: 18, marginBottom: -32 },
  head: { alignItems: 'center', paddingBottom: 14 },
  avatar: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface2,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.bg2, marginBottom: 10,
  },
  avatarText: { color: colors.text, fontFamily: fonts.display, fontSize: 20 },
  name: { color: colors.text, fontFamily: fonts.display, fontSize: 18 },
  cat: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  link: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 10, marginTop: 6 },
  statsRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 22, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft, marginBottom: 14,
  },
  stat: { alignItems: 'center' },
  statN: { color: colors.text, fontFamily: fonts.display, fontSize: 16 },
  statL: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 10 },
  bio: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, textAlign: 'center', marginBottom: 16 },
  sectionLabel: { color: colors.textFaint, fontFamily: fonts.bodyBold, fontSize: 12, marginBottom: 10 },
  perkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 14, padding: 12, marginBottom: 8,
  },
  lock: { width: 26, height: 26, borderRadius: 8, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  perkTitle: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 12 },
  perkSub: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 10, marginTop: 1 },
});
