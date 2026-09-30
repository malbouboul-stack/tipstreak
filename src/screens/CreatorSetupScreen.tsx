import React, { useState } from 'react';
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
import { useLanguage } from '../i18n/LanguageContext';

const HANDLE = /^[a-z0-9_]{3,30}$/; // même règle que la base (cf. migration)

export default function CreatorSetupScreen() {
  const navigation = useNavigation();
  const { publicKey, connecting, error, solBalance, usdcBalance, refreshingBalances, connect, disconnect, refreshBalances } = useWallet();
  const { myCreator, publishCreator, refresh } = useData();
  const { tips: receivedTips, loading: tipsLoading, reload: reloadTips, fetchedAt } = useCreatorTips(myCreator?.id);
  const { t, translateError, language, setLanguage } = useLanguage();
  const [isCreator, setIsCreator] = useState(false);
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [category, setCategory] = useState('');
  const [bio, setBio] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const currentWeek = weekStart(new Date());
  const receivedThisWeek = receivedTips
    .filter((tip) => tip.createdAt.getTime() >= currentWeek)
    .reduce((sum, tip) => sum + tip.amount, 0);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), reloadTips(), refreshBalances()]);
    setRefreshing(false);
  };

  // Ouvre / replie le formulaire. Si ce wallet a déjà une page, on le pré-remplit pour la modifier.
  const toggleForm = () => {
    if (!isCreator && myCreator) {
      setHandle(myCreator.handle);
      setDisplayName(myCreator.name);
      setCategory(myCreator.category);
      setBio(myCreator.bio);
    }
    setIsCreator(!isCreator);
  };

  const handleValid = HANDLE.test(handle);

  const onPublish = async () => {
    setPublishing(true);
    try {
      const creator = await publishCreator({ handle, name: displayName, category, bio });
      setIsCreator(false); // la page est en ligne : on replie le formulaire, le tableau de bord prend le relais
      Alert.alert(
        myCreator ? t('profile.updatedTitle') : t('profile.publishedTitle'),
        t('profile.publishedText', { link: getCreatorLink(creator) })
      );
    } catch (e: any) {
      console.error('Publish creator error', e);
      Alert.alert(t('profile.publishFailedTitle'), translateError(e?.message, 'profile.retryLater'));
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
        <View style={styles.titleRow}>
          <Text style={[styles.title, { marginBottom: 0 }]}>
            {myCreator ? t('profile.titleCreator') : t('profile.titleNew')}
          </Text>
          <View style={styles.langToggle} accessibilityRole="radiogroup" accessibilityLabel={t('profile.language')}>
            {(['fr', 'en'] as const).map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[styles.langOption, language === lang && styles.langOptionActive]}
                onPress={() => setLanguage(lang)}
                accessibilityRole="radio"
                accessibilityState={{ selected: language === lang }}
              >
                <Text style={[styles.langText, language === lang && styles.langTextActive]}>{lang.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.walletCard}>
          {publicKey ? (
            <>
              <View style={{ flex: 1 }}>
                <Text style={styles.walletLabel}>{t('profile.walletConnected')}</Text>
                <Text style={styles.walletAddress}>{shortenAddress(publicKey)}</Text>
              </View>
              <TouchableOpacity onPress={disconnect}>
                <Text style={styles.walletAction}>{t('profile.disconnect')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={{ flex: 1 }}>
                <Text style={styles.walletLabel}>{t('profile.noWallet')}</Text>
                <Text style={styles.walletSub}>{t('profile.noWalletSub')}</Text>
              </View>
              {connecting ? (
                <ActivityIndicator color={colors.purple} />
              ) : (
                <TouchableOpacity onPress={connect}>
                  <Text style={styles.walletAction}>{t('profile.connect')}</Text>
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
                <Text style={styles.walletAction}>{t('profile.refresh')}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
        {error && <Text style={styles.walletError}>{translateError(error)}</Text>}

        {myCreator && (
          <View style={styles.dashboard}>
            <Text style={styles.dashTitle}>{t('profile.yourPage', { link: getCreatorLink(myCreator) })}</Text>
            <View style={styles.dashStats}>
              <View style={styles.dashStat}>
                <Text style={styles.dashN}>{myCreator.supporters}</Text>
                <Text style={styles.dashL}>{t('common.supporters')}</Text>
              </View>
              <View style={styles.dashStat}>
                <Text style={[styles.dashN, { color: colors.green }]}>{receivedThisWeek.toFixed(2)}</Text>
                <Text style={styles.dashL}>{t('profile.usdcThisWeek')}</Text>
              </View>
              <View style={styles.dashStat}>
                <Text style={styles.dashN}>{myCreator.totalReceived.toFixed(2)}</Text>
                <Text style={styles.dashL}>{t('profile.usdcTotal')}</Text>
              </View>
            </View>
            <View style={styles.dashActions}>
              <TouchableOpacity
                style={styles.dashBtn}
                onPress={() => navigation.navigate('CreatorProfile', { creatorId: myCreator.id })}
              >
                <Text style={styles.walletAction}>{t('profile.viewPage')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dashBtn}
                onPress={() => Share.share({ message: t('profile.shareMessage', { link: getCreatorLink(myCreator) }) })}
              >
                <Text style={styles.walletAction}>{t('profile.shareLink')}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>{t('profile.latestTips')}</Text>
            <SupportWall tips={receivedTips} loading={tipsLoading} now={fetchedAt} emptyText={t('profile.noTipsYet')} />
          </View>
        )}

        <TouchableOpacity style={styles.toggleRow} onPress={toggleForm} activeOpacity={0.85}>
          <View>
            <Text style={styles.toggleLabel}>{myCreator ? t('profile.editPage') : t('profile.receiveTips')}</Text>
            <Text style={styles.toggleSub}>{myCreator ? t('profile.editPageSub') : t('profile.receiveTipsSub')}</Text>
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
                placeholder={t('profile.namePlaceholder')}
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
                placeholder={t('profile.handlePlaceholder')}
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
              <Text style={styles.fieldHint}>{t('profile.handleHint')}</Text>
            )}
            <View style={styles.field}>
              <TextInput
                style={styles.input}
                placeholder={t('profile.categoryPlaceholder')}
                placeholderTextColor={colors.textFaint}
                value={category}
                onChangeText={setCategory}
                maxLength={50}
              />
            </View>
            <View style={[styles.field, { height: 70, alignItems: 'flex-start', paddingTop: 4 }]}>
              <TextInput
                style={[styles.input, { paddingTop: 10 }]}
                placeholder={t('profile.bioPlaceholder')}
                placeholderTextColor={colors.textFaint}
                value={bio}
                onChangeText={setBio}
                multiline
                maxLength={280}
              />
            </View>

            <GradientButton
              label={publishing ? t('profile.signing') : myCreator ? t('profile.update') : t('profile.publish')}
              style={{ marginTop: 'auto' }}
              disabled={!publicKey || !handleValid || !displayName.trim() || !category.trim() || publishing}
              onPress={onPublish}
            />
            <Text style={styles.previewNote}>
              {!publicKey
                ? t('profile.noteConnect')
                : myCreator
                  ? t('profile.noteOnline', { link: getCreatorLink(myCreator) })
                  : t('profile.noteSign')}
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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  langToggle: {
    flexDirection: 'row', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft,
    borderRadius: 10, padding: 2,
  },
  langOption: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8 },
  langOptionActive: { backgroundColor: colors.purple },
  langText: { color: colors.textFaint, fontFamily: fonts.bodyBold, fontSize: 11 },
  langTextActive: { color: colors.text },
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
