import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, Share, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, fonts } from '../theme';
import GradientButton from '../components/GradientButton';
import SupportWall from '../components/SupportWall';
import { useWallet, shortenAddress } from '../context/WalletContext';
import { getCreatorLink, useData } from '../context/DataContext';
import { useCreatorTips } from '../data/useCreatorTips';
import { weekStart } from '../data/streaks';

const HANDLE = /^[a-z0-9_]{3,30}$/; // même règle que la base (cf. migration)

export default function CreatorSetupScreen() {
  const navigation = useNavigation();
  const { publicKey, connecting, error, solBalance, usdcBalance, refreshingBalances, connect, disconnect, refreshBalances } = useWallet();
  const { myCreator, publishCreator, refresh } = useData();
  const { tips: receivedTips, loading: tipsLoading, reload: reloadTips } = useCreatorTips(myCreator?.id);
  const [isCreator, setIsCreator] = useState(false);
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [category, setCategory] = useState('');
  const [bio, setBio] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const currentWeek = weekStart(new Date());
  const receivedThisWeek = receivedTips
    .filter((t) => t.createdAt.getTime() >= currentWeek)
    .reduce((sum, t) => sum + t.amount, 0);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), reloadTips(), refreshBalances()]);
    setRefreshing(false);
  };

  // Ce wallet a déjà une page : on pré-remplit le formulaire (replié) pour pouvoir la modifier
  useEffect(() => {
    if (!myCreator) return;
    setIsCreator(false);
    setHandle(myCreator.handle);
    setDisplayName(myCreator.name);
    setCategory(myCreator.category);
    setBio(myCreator.bio);
  }, [myCreator]);

  const handleValid = HANDLE.test(handle);

  const onPublish = async () => {
    setPublishing(true);
    try {
      const creator = await publishCreator({ handle, name: displayName, category, bio });
      Alert.alert(
        myCreator ? 'Page mise à jour' : 'Ta page est en ligne 🎉',
        `Elle apparaît dans « Découvrir ». Ton lien : ${getCreatorLink(creator)}`
      );
    } catch (e: any) {
      console.error('Publish creator error', e);
      Alert.alert('Publication impossible', e?.message ?? 'Réessaie dans un instant.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purple} />}
      >
        <Text style={styles.title}>{myCreator ? 'Mon espace créateur' : 'Devenir créateur'}</Text>

        <View style={styles.walletCard}>
          {publicKey ? (
            <>
              <View style={{ flex: 1 }}>
                <Text style={styles.walletLabel}>Wallet connecté</Text>
                <Text style={styles.walletAddress}>{shortenAddress(publicKey)}</Text>
              </View>
              <TouchableOpacity onPress={disconnect}>
                <Text style={styles.walletAction}>Déconnecter</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={{ flex: 1 }}>
                <Text style={styles.walletLabel}>Aucun wallet connecté</Text>
                <Text style={styles.walletSub}>Connecte Phantom ou Solflare pour recevoir des tips</Text>
              </View>
              {connecting ? (
                <ActivityIndicator color={colors.purple} />
              ) : (
                <TouchableOpacity onPress={connect}>
                  <Text style={styles.walletAction}>Connecter</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {publicKey && (
          <View style={styles.balanceRow}>
            <View style={styles.balanceBox}>
              <Text style={styles.balanceLabel}>SOL</Text>
              <Text style={styles.balanceValue}>{solBalance !== null ? solBalance.toFixed(3) : '—'}</Text>
            </View>
            <View style={styles.balanceBox}>
              <Text style={styles.balanceLabel}>USDC</Text>
              <Text style={styles.balanceValue}>{usdcBalance !== null ? usdcBalance.toFixed(2) : '—'}</Text>
            </View>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => refreshBalances()}
              disabled={refreshingBalances}
            >
              {refreshingBalances ? (
                <ActivityIndicator size="small" color={colors.textDim} />
              ) : (
                <Text style={styles.walletAction}>Actualiser</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
        {error && <Text style={styles.walletError}>{error}</Text>}

        {myCreator && (
          <View style={styles.dashboard}>
            <Text style={styles.dashTitle}>Ta page · {getCreatorLink(myCreator)}</Text>
            <View style={styles.dashStats}>
              <View style={styles.dashStat}>
                <Text style={styles.dashN}>{myCreator.supporters}</Text>
                <Text style={styles.dashL}>Supporters</Text>
              </View>
              <View style={styles.dashStat}>
                <Text style={[styles.dashN, { color: colors.green }]}>{receivedThisWeek.toFixed(2)}</Text>
                <Text style={styles.dashL}>USDC cette semaine</Text>
              </View>
              <View style={styles.dashStat}>
                <Text style={styles.dashN}>{myCreator.totalReceived.toFixed(2)}</Text>
                <Text style={styles.dashL}>USDC au total</Text>
              </View>
            </View>
            <View style={styles.dashActions}>
              <TouchableOpacity
                style={styles.dashBtn}
                onPress={() => navigation.navigate('CreatorProfile', { creatorId: myCreator.id })}
              >
                <Text style={styles.walletAction}>Voir ma page</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dashBtn}
                onPress={() => Share.share({ message: `Soutiens-moi sur TipStreak : ${getCreatorLink(myCreator)}` })}
              >
                <Text style={styles.walletAction}>Partager mon lien</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>Derniers tips reçus</Text>
            <SupportWall
              tips={receivedTips}
              loading={tipsLoading}
              emptyText="Aucun tip reçu pour l'instant. Partage ton lien à ta communauté !"
            />
          </View>
        )}

        <TouchableOpacity style={styles.toggleRow} onPress={() => setIsCreator(!isCreator)} activeOpacity={0.85}>
          <View>
            <Text style={styles.toggleLabel}>{myCreator ? 'Modifier ma page' : 'Recevoir des tips'}</Text>
            <Text style={styles.toggleSub}>{myCreator ? 'Nom, handle, catégorie, bio' : 'Active ta page publique'}</Text>
          </View>
          <View style={[styles.switch, isCreator && styles.switchOn]}>
            <View style={[styles.switchDot, isCreator && styles.switchDotOn]} />
          </View>
        </TouchableOpacity>

        {isCreator && (
          <>
            <View style={styles.field}>
              <TextInput
                style={styles.input}
                placeholder="Nom d'affichage"
                placeholderTextColor={colors.textFaint}
                value={displayName}
                onChangeText={setDisplayName}
                maxLength={50}
              />
            </View>
            <View style={[styles.field, styles.handleField]}>
              <Text style={styles.handlePrefix}>tipstreak://</Text>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="ton_handle"
                placeholderTextColor={colors.textFaint}
                value={handle}
                // Uniquement ce que la base accepte : minuscules, chiffres, _
                onChangeText={(text) => setHandle(text.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={30}
              />
            </View>
            {handle.length > 0 && !handleValid && (
              <Text style={styles.fieldHint}>Au moins 3 caractères : lettres minuscules, chiffres ou _</Text>
            )}
            <View style={styles.field}>
              <TextInput
                style={styles.input}
                placeholder="Catégorie (Musique, Dev, Art...)"
                placeholderTextColor={colors.textFaint}
                value={category}
                onChangeText={setCategory}
                maxLength={50}
              />
            </View>
            <View style={[styles.field, { height: 70, alignItems: 'flex-start', paddingTop: 4 }]}>
              <TextInput
                style={[styles.input, { paddingTop: 10 }]}
                placeholder="Courte bio"
                placeholderTextColor={colors.textFaint}
                value={bio}
                onChangeText={setBio}
                multiline
                maxLength={280}
              />
            </View>

            <GradientButton
              label={publishing ? 'Signature en cours...' : myCreator ? 'Mettre à jour ma page' : 'Publier ma page'}
              style={{ marginTop: 'auto' }}
              disabled={!publicKey || !handleValid || !displayName.trim() || !category.trim() || publishing}
              onPress={onPublish}
            />
            <Text style={styles.previewNote}>
              {!publicKey
                ? 'Connecte ton wallet : les tips arriveront directement dessus'
                : myCreator
                  ? `Ta page est en ligne : ${getCreatorLink(myCreator)}`
                  : 'Ton wallet te demandera de signer un message (gratuit) pour prouver qu\'il t\'appartient'}
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flexGrow: 1, padding: 20 },
  handleField: { flexDirection: 'row', alignItems: 'center' },
  dashboard: { marginBottom: 8 },
  dashTitle: { color: colors.textDim, fontFamily: fonts.bodySemi, fontSize: 12, marginBottom: 10 },
  dashStats: {
    flexDirection: 'row', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft,
    borderRadius: 16, paddingVertical: 14, marginBottom: 10,
  },
  dashStat: { flex: 1, alignItems: 'center' },
  dashN: { color: colors.text, fontFamily: fonts.display, fontSize: 18 },
  dashL: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 10, marginTop: 2 },
  dashActions: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  dashBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(153,69,255,0.1)', borderWidth: 1, borderColor: 'rgba(153,69,255,0.35)',
  },
  sectionLabel: { color: colors.textFaint, fontFamily: fonts.bodyBold, fontSize: 12, marginBottom: 10 },
  handlePrefix: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 14 },
  fieldHint: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 11, marginTop: -6, marginBottom: 12, marginLeft: 4 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 20, marginBottom: 16 },
  walletCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 16, padding: 14, marginBottom: 8,
  },
  walletLabel: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 13 },
  walletAddress: { color: colors.green, fontFamily: fonts.display, fontSize: 13, marginTop: 2 },
  walletSub: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  walletAction: { color: colors.purple, fontFamily: fonts.bodyBold, fontSize: 12 },
  walletError: { color: '#FF6B6B', fontFamily: fonts.body, fontSize: 11, marginBottom: 16 },
  balanceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 16, padding: 14, marginBottom: 16,
  },
  balanceBox: { flex: 1 },
  balanceLabel: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 11 },
  balanceValue: { color: colors.text, fontFamily: fonts.display, fontSize: 16, marginTop: 2 },
  refreshBtn: { paddingLeft: 8 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderSoft, marginBottom: 20,
  },
  toggleLabel: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 14 },
  toggleSub: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  switch: { width: 40, height: 24, borderRadius: 14, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderSoft, padding: 2 },
  switchOn: { backgroundColor: colors.purple, borderColor: colors.purple },
  switchDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.textFaint, alignSelf: 'flex-start' },
  switchDotOn: { backgroundColor: colors.bg, alignSelf: 'flex-end' },
  field: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft,
    borderRadius: 16, paddingHorizontal: 16, marginBottom: 12, justifyContent: 'center',
  },
  input: { color: colors.text, fontFamily: fonts.body, fontSize: 14, paddingVertical: 14 },
  previewNote: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 11, textAlign: 'center', marginTop: 10 },
});
