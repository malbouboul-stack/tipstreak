import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { colors, fonts } from '../theme';
import { ChevronLeft, BoltIcon } from '../components/Icons';
import GradientButton from '../components/GradientButton';
import { useData } from '../context/DataContext';
import { useWallet } from '../context/WalletContext';
import type { RootStackParamList } from '../../App';

const QUICK_AMOUNTS = [1, 5, 10, 25];
const BOOST_COST_SKR = 5;

export default function TipScreen() {
  const navigation = useNavigation();
  const { creatorId } = useRoute<RouteProp<RootStackParamList, 'Tip'>>().params;

  const { getCreator, getSupportRelation, recordTip } = useData();
  const creator = getCreator(creatorId);
  const relation = getSupportRelation(creatorId);
  const { publicKey, connecting, connect, sendTip, sendBoost, refreshBalances } = useWallet();

  const [amount, setAmount] = useState(5);
  const [customAmount, setCustomAmount] = useState('');
  const [boosted, setBoosted] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  if (!creator) return null;

  if (!publicKey) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={[styles.title, { marginBottom: 10 }]}>Connecte ton wallet</Text>
          <Text style={{ color: colors.textDim, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', marginBottom: 24 }}>
            Il faut un wallet connecté pour envoyer un tip à {creator.name}.
          </Text>
          {connecting ? (
            <ActivityIndicator color={colors.purple} />
          ) : (
            <GradientButton label="Connecter mon wallet" onPress={connect} style={{ width: '100%' }} />
          )}
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.textFaint, fontFamily: fonts.body, fontSize: 13 }}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const finalAmount = customAmount ? parseFloat(customAmount.replace(',', '.')) || 0 : amount;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.container}>
          <View style={styles.topNav}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
              <ChevronLeft />
            </TouchableOpacity>
            <Text style={styles.title}>Envoyer un tip</Text>
            <View style={{ width: 34 }} />
          </View>

          <View style={styles.creatorRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{creator.initial}</Text>
            </View>
            <View>
              <Text style={styles.creatorName}>{creator.name}</Text>
              <Text style={styles.creatorStreak}>🔥 Ton streak : {relation?.consecutiveWeeks ?? 0} semaines</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Montant rapide</Text>
          <View style={styles.chipsRow}>
            {QUICK_AMOUNTS.map((a) => (
              <TouchableOpacity
                key={a}
                style={[styles.chip, amount === a && !customAmount && styles.chipActive]}
                onPress={() => {
                  setAmount(a);
                  setCustomAmount('');
                }}
              >
                <Text style={[styles.chipText, amount === a && !customAmount && styles.chipTextActive]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.amountDisplay}>
            <TextInput
              style={styles.amountInput}
              value={customAmount || String(amount)}
              onChangeText={setCustomAmount}
              keyboardType="decimal-pad"
            />
            <Text style={styles.currency}>USDC</Text>
          </View>

          <TouchableOpacity style={styles.boostCard} onPress={() => setBoosted(!boosted)} activeOpacity={0.85}>
            <View style={styles.boostIcon}>
              <BoltIcon />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.boostTitle}>Booster avec SKR</Text>
              <Text style={styles.boostSub}>Ton tip épinglé en haut du profil · {BOOST_COST_SKR} TSKR</Text>
            </View>
            <View style={[styles.switch, boosted && styles.switchOn]}>
              <View style={[styles.switchDot, boosted && styles.switchDotOn]} />
            </View>
          </TouchableOpacity>

          <View style={styles.field}>
            <TextInput
              style={styles.input}
              placeholder="Ajouter un message (optionnel)"
              placeholderTextColor={colors.textFaint}
              value={message}
              onChangeText={setMessage}
              maxLength={140} // stocké on-chain dans le memo : une transaction Solana est limitée à 1232 octets
            />
          </View>

          <GradientButton
            label={sending ? 'Envoi en cours...' : `Confirmer le tip · ${finalAmount || 0} USDC`}
            style={{ marginTop: 'auto' }}
            disabled={!finalAmount || sending}
            onPress={async () => {
              setSending(true);
              try {
                const tipSignature = await sendTip(creator.walletAddress, finalAmount, message);
                console.log('Tip signature:', tipSignature);

                let boostSignature: string | null = null;
                if (boosted) {
                  try {
                    boostSignature = await sendBoost(BOOST_COST_SKR);
                    console.log('Boost signature:', boostSignature);
                  } catch (boostError: any) {
                    console.error('Boost error', boostError);
                    Alert.alert(
                      'Tip envoyé, boost échoué',
                      `Ton tip de ${finalAmount} USDC est bien parti, mais le boost SKR a échoué (${boostError?.message ?? 'solde TSKR insuffisant ?'}).`
                    );
                  }
                }

                // Enregistrement en base : l'Edge Function vérifie la transaction on-chain
                let recordError: string | null = null;
                try {
                  await recordTip({ signature: tipSignature, creatorId: creator.id, boostSignature });
                } catch (recordErr: any) {
                  console.error('Record tip error', recordErr, tipSignature);
                  recordError = recordErr?.message ?? 'erreur inconnue';
                }

                await refreshBalances();

                if (recordError) {
                  Alert.alert(
                    'Tip envoyé, pas enregistré',
                    `Ton tip de ${finalAmount} USDC est bien parti sur la blockchain, mais TipStreak n'a pas pu l'enregistrer (${recordError}). Il n'apparaîtra pas dans ton historique ni ton streak.`,
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                  );
                } else if (!boosted || boostSignature) {
                  Alert.alert(
                    'Tip envoyé !',
                    `${finalAmount} USDC envoyés à ${creator.name}.${boostSignature ? ' Boost activé ⚡' : ''}`,
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                  );
                }
              } catch (e: any) {
                console.error('Send tip error', e);
                Alert.alert('Échec de l\'envoi', e?.message ?? 'La transaction a échoué. Vérifie ton solde USDC.');
              } finally {
                setSending(false);
              }
            }}
          />
        </View>
      </KeyboardAvoidingView>
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
  creatorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 16, padding: 12, marginBottom: 18,
  },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.text, fontFamily: fonts.display, fontSize: 12 },
  creatorName: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 13 },
  creatorStreak: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 10, marginTop: 1 },
  sectionLabel: { color: colors.textFaint, fontFamily: fonts.bodyBold, fontSize: 12, marginBottom: 10 },
  chipsRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  chip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { color: colors.text, fontFamily: fonts.display, fontSize: 14 },
  chipTextActive: { color: colors.bg, fontFamily: fonts.displayBold },
  amountDisplay: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', paddingVertical: 14, marginBottom: 6 },
  amountInput: { color: colors.text, fontFamily: fonts.display, fontSize: 38, minWidth: 60, textAlign: 'right' },
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
  switchDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.textFaint, alignSelf: 'flex-start' },
  switchDotOn: { backgroundColor: colors.bg, alignSelf: 'flex-end' },
  field: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft,
    borderRadius: 16, paddingHorizontal: 16, marginBottom: 12,
  },
  input: { color: colors.text, fontFamily: fonts.body, fontSize: 14, paddingVertical: 14 },
});
