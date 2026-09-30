import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import GradientButton from '../components/GradientButton';
import { useWallet, shortenAddress } from '../context/WalletContext';
import { getCreatorLink, useData } from '../context/DataContext';

const HANDLE = /^[a-z0-9_]{3,30}$/; // même règle que la base (cf. migration)

export default function CreatorSetupScreen() {
  const { publicKey, connecting, error, solBalance, usdcBalance, refreshingBalances, connect, disconnect, refreshBalances } = useWallet();
  const { myCreator, publishCreator } = useData();
  const [isCreator, setIsCreator] = useState(false);
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [category, setCategory] = useState('');
  const [bio, setBio] = useState('');
  const [publishing, setPublishing] = useState(false);

  // Ce wallet a déjà une page : on pré-remplit le formulaire pour la modifier
  useEffect(() => {
    if (!myCreator) return;
    setIsCreator(true);
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
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Devenir créateur</Text>

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

        <TouchableOpacity style={styles.toggleRow} onPress={() => setIsCreator(!isCreator)} activeOpacity={0.85}>
          <View>
            <Text style={styles.toggleLabel}>Recevoir des tips</Text>
            <Text style={styles.toggleSub}>Active ta page publique</Text>
          </View>
          <View style={[styles.switch, isCreator && styles.switchOn]}>
            <View style={[styles.switchDot, isCreator && styles.switchDotOn]} />
          </View>
        </TouchableOpacity>

        {isCreator && (
          <>
            <View style={styles.avatarUpload}>
              <Text style={styles.avatarUploadText}>Photo</Text>
            </View>
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
  avatarUpload: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface2, borderWidth: 1.5,
    borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 20,
  },
  avatarUploadText: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 11 },
  field: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft,
    borderRadius: 16, paddingHorizontal: 16, marginBottom: 12, justifyContent: 'center',
  },
  input: { color: colors.text, fontFamily: fonts.body, fontSize: 14, paddingVertical: 14 },
  previewNote: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 11, textAlign: 'center', marginTop: 10 },
});
