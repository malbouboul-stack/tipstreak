import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { colors, fonts, sectionLabel } from '../theme';
import { ChevronLeft, BoltIcon } from '../components/Icons';
import GradientButton from '../components/GradientButton';
import Avatar from '../components/Avatar';
import TipSuccessModal, { TipPhase } from '../components/TipSuccessModal';
import { useDialog } from '../components/Dialog';
import { CONTRIBUTION_RATE } from '../constants/platform';
import { useData } from '../context/DataContext';
import { useWallet } from '../context/WalletContext';
import { useLanguage } from '../i18n/LanguageContext';
import type { RootStackParamList } from '../../App';

const QUICK_AMOUNTS = [1, 5, 10, 25];
const BOOST_COST_SKR = 5;
// Frais Solana : ~0,000005 SOL par transaction. Le premier tip vers un créateur ouvre en plus
// son compte USDC (~0,00204 SOL de dépôt), payé par le fan.
const MIN_FEE_SOL = 0.00001;
const FIRST_TIP_SOL = 0.003;

export default function TipScreen() {
  const navigation = useNavigation();
  const { creatorId } = useRoute<RouteProp<RootStackParamList, 'Tip'>>().params;

  const { getCreator, getSupportRelation, recordTip } = useData();
  const creator = getCreator(creatorId);
  const relation = getSupportRelation(creatorId);
  const { publicKey, connecting, connect, sendTip, refreshBalances, usdcBalance, solBalance } = useWallet();
  const { t, translateError } = useLanguage();
  const showDialog = useDialog();

  // Un seul champ texte : les montants rapides le remplissent, et on peut l'effacer entièrement
  const [amountText, setAmountText] = useState('5');
  const [boosted, setBoosted] = useState(false);
  const [contribute, setContribute] = useState(false); // facultatif, désactivé par défaut
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  // Tip confirmé : affiche l'écran de réussite animé (son + vibration)
  const [success, setSuccess] = useState<{ amount: number; boosted: boolean; contributed: boolean; phase: TipPhase } | null>(
    null
  );

  if (!creator) return null;

  if (!publicKey) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={[styles.title, { marginBottom: 10 }]}>{t('tip.connectTitle')}</Text>
          <Text style={{ color: colors.textDim, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', marginBottom: 24 }}>
            {t('tip.connectText', { name: creator.name })}
          </Text>
          {connecting ? (
            <ActivityIndicator color={colors.purple} />
          ) : (
            <GradientButton label={t('tip.connectButton')} onPress={connect} style={{ width: '100%' }} />
          )}
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.textFaint, fontFamily: fonts.body, fontSize: 13 }}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Montant valide : strictement positif, 6 décimales max (précision de l'USDC)
  const parsedAmount = parseFloat(amountText.replace(',', '.'));
  const finalAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? Math.round(parsedAmount * 1e6) / 1e6 : 0;
  // Contribution volontaire à TipStreak, en plus du tip (le créateur reçoit toujours 100 % du tip)
  const contributionOffer = Math.round(finalAmount * CONTRIBUTION_RATE * 100) / 100;
  const contribution = contribute ? contributionOffer : 0;

  // Vérifications avant envoi : sinon le wallet renvoie une erreur peu compréhensible
  const notEnoughUsdc = usdcBalance !== null && finalAmount + contribution > usdcBalance;
  const noSol = solBalance !== null && solBalance < MIN_FEE_SOL;
  const lowSol = !noSol && solBalance !== null && solBalance < FIRST_TIP_SOL;
  const balanceWarning = notEnoughUsdc
    ? t('tip.insufficientUsdc', { balance: usdcBalance.toFixed(2) })
    : noSol
      ? t('tip.noSol', { needed: FIRST_TIP_SOL })
      : lowSol
        ? t('tip.lowSol', { balance: solBalance.toFixed(4), needed: FIRST_TIP_SOL })
        : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.container}>
          <View style={styles.topNav}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
              <ChevronLeft />
            </TouchableOpacity>
            <Text style={styles.title}>{t('tip.title')}</Text>
            <View style={{ width: 34 }} />
          </View>

          <View style={styles.creatorRow}>
            <Avatar seed={creator.handle} initial={creator.initial} uri={creator.avatarUrl} size={36} />
            <View>
              <Text style={styles.creatorName}>{creator.name}</Text>
              <Text style={styles.creatorStreak}>{t('tip.streak', { count: relation?.consecutiveWeeks ?? 0 })}</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>{t('tip.quickAmount')}</Text>
          <View style={styles.chipsRow}>
            {QUICK_AMOUNTS.map((a) => {
              const active = finalAmount === a;
              return (
                <TouchableOpacity key={a} style={[styles.chip, active && styles.chipActive]} onPress={() => setAmountText(String(a))}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{a}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.amountDisplay}>
            <TextInput
              style={styles.amountInput}
              value={amountText}
              onChangeText={(text) => setAmountText(text.replace(/[^0-9.,]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textFaint}
              selectTextOnFocus
            />
            <Text style={styles.currency}>USDC</Text>
          </View>

          <TouchableOpacity style={styles.boostCard} onPress={() => setBoosted(!boosted)} activeOpacity={0.85}>
            <View style={styles.boostIcon}>
              <BoltIcon />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.boostTitle}>{t('tip.boostTitle')}</Text>
              <Text style={styles.boostSub}>{t('tip.boostSub', { cost: BOOST_COST_SKR })}</Text>
            </View>
            <View style={[styles.switch, boosted && styles.switchOn]}>
              <View style={[styles.switchDot, boosted && styles.switchDotOn]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contributeRow}
            onPress={() => setContribute(!contribute)}
            activeOpacity={0.85}
            accessibilityRole="switch"
            accessibilityState={{ checked: contribute }}
          >
            <Text style={styles.contributeText}>
              {t('tip.contributeTitle')}{' '}
              <Text style={styles.contributeSub}>
                {t('tip.contributeSub', { amount: contributionOffer.toFixed(2) })}
              </Text>
            </Text>
            <View style={[styles.switch, contribute && styles.switchOnCyan]}>
              <View style={[styles.switchDot, contribute && styles.switchDotOn]} />
            </View>
          </TouchableOpacity>

          <View style={styles.field}>
            <TextInput
              style={styles.input}
              placeholder={t('tip.messagePlaceholder')}
              placeholderTextColor={colors.textFaint}
              value={message}
              onChangeText={setMessage}
              maxLength={140} // stocké on-chain dans le memo : une transaction Solana est limitée à 1232 octets
            />
          </View>

          {balanceWarning && (
            <Text style={[styles.warning, (notEnoughUsdc || noSol) && styles.warningBlocking]}>{balanceWarning}</Text>
          )}

          <GradientButton
            label={sending ? t('tip.sending') : t('tip.confirm', { amount: finalAmount })}
            style={{ marginTop: 'auto' }}
            disabled={!finalAmount || sending || notEnoughUsdc || noSol}
            onPress={async () => {
              setSending(true);
              try {
                // Tip, boost et contribution éventuels partent dans une seule transaction (une seule signature).
                // Dès le retour du wallet, la carte de confirmation s'ouvre en "envoi en cours".
                const tipSignature = await sendTip(creator.walletAddress, finalAmount, {
                  message,
                  boostSkr: boosted ? BOOST_COST_SKR : 0,
                  contributionUsdc: contribution,
                  onSigned: () => setSuccess({ amount: finalAmount, boosted, contributed: contribution > 0, phase: 'sending' }),
                });
                console.log('Tip signature:', tipSignature);
                // Confirmé on-chain : la pièce tombe (son + vibration), l'argent est arrivé chez le créateur
                setSuccess((s) => s && { ...s, phase: 'confirmed' });
                refreshBalances();

                // Enregistrement en base pendant l'animation : l'Edge Function relit la transaction on-chain
                try {
                  await recordTip({ signature: tipSignature, creatorId: creator.id });
                  setSuccess((s) => s && { ...s, phase: 'recorded' });
                } catch (recordErr: any) {
                  console.error('Record tip error', recordErr, tipSignature);
                  setSuccess(null);
                  showDialog({
                    title: t('tip.notRecordedTitle'),
                    message: t('tip.notRecordedText', { amount: finalAmount, error: translateError(recordErr?.message) }),
                    tone: 'warning',
                    onClose: () => navigation.goBack(),
                  });
                }
              } catch (e: any) {
                console.error('Send tip error', e);
                setSuccess(null);
                showDialog({ title: t('tip.failedTitle'), message: translateError(e?.message, 'tip.failedDefault'), tone: 'error' });
              } finally {
                setSending(false);
              }
            }}
          />
        </View>
      </KeyboardAvoidingView>
      <TipSuccessModal
        visible={success !== null}
        amount={success?.amount ?? 0}
        creatorName={creator.name}
        boosted={success?.boosted ?? false}
        contributed={success?.contributed ?? false}
        phase={success?.phase ?? 'sending'}
        onClose={() => {
          setSuccess(null);
          navigation.goBack();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, padding: 20 },
  topNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 11, backgroundColor: colors.surface2,
    borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center',
  },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 18 },
  warning: { color: colors.gold, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', marginBottom: 10 },
  warningBlocking: { color: '#FF6B6B' },
  creatorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 16, padding: 12, marginBottom: 18,
  },
  creatorName: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 13 },
  creatorStreak: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 10, marginTop: 1 },
  sectionLabel,
  chipsRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  chip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { color: colors.text, fontFamily: fonts.monoBold, fontSize: 14 },
  chipTextActive: { color: colors.bg, fontFamily: fonts.displayBold },
  amountDisplay: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', paddingVertical: 14, marginBottom: 6 },
  amountInput: { color: colors.text, fontFamily: fonts.monoBold, fontSize: 38, minWidth: 60, textAlign: 'right' },
  currency: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 14, marginLeft: 4 },
  boostCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(153,69,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(153,69,255,0.4)', borderRadius: 16, padding: 14, marginBottom: 16,
  },
  boostIcon: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,184,77,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,184,77,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  boostTitle: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 12 },
  boostSub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 10, marginTop: 1 },
  switch: { width: 38, height: 22, borderRadius: 12, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderSoft, padding: 2 },
  switchOn: { backgroundColor: colors.purple, borderColor: colors.purple },
  switchOnCyan: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  contributeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1, borderColor: colors.borderSoft, marginTop: -6, marginBottom: 14,
  },
  contributeText: { flex: 1, color: colors.text, fontFamily: fonts.bodySemi, fontSize: 12 },
  contributeSub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 11 },
  switchDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.textFaint, alignSelf: 'flex-start' },
  switchDotOn: { backgroundColor: colors.bg, alignSelf: 'flex-end' },
  field: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft,
    borderRadius: 16, paddingHorizontal: 16, marginBottom: 12,
  },
  input: { color: colors.text, fontFamily: fonts.body, fontSize: 14, paddingVertical: 14 },
});
