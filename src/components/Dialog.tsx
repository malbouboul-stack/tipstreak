import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import GradientButton from './GradientButton';
import { useLanguage } from '../i18n/LanguageContext';

// Fenêtres de message de l'app, au style de TipStreak (à la place des boîtes blanches d'Android) :
// même carte sombre et même apparition que la confirmation d'un tip.

type Tone = 'success' | 'error' | 'warning';
type DialogOptions = { title: string; message?: string; tone?: Tone; onClose?: () => void };

const TONES: Record<Tone, { symbol: string; color: string; background: string }> = {
  success: { symbol: '✓', color: colors.green, background: 'rgba(20,241,149,0.12)' },
  error: { symbol: '✕', color: '#FF6B6B', background: 'rgba(255,107,107,0.12)' },
  warning: { symbol: '!', color: colors.gold, background: 'rgba(255,184,77,0.12)' },
};

const DialogContext = createContext<((options: DialogOptions) => void) | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [dialog, setDialog] = useState<DialogOptions | null>(null);
  const [appear] = useState(() => new Animated.Value(0));

  const show = useCallback((options: DialogOptions) => setDialog(options), []);

  useEffect(() => {
    if (!dialog) return;
    appear.setValue(0);
    Animated.timing(appear, { toValue: 1, duration: 320, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
  }, [dialog, appear]);

  const close = () => {
    const onClose = dialog?.onClose;
    setDialog(null);
    onClose?.();
  };

  const tone = TONES[dialog?.tone ?? 'success'];
  const value = useMemo(() => show, [show]);

  return (
    <DialogContext.Provider value={value}>
      {children}
      <Modal visible={dialog !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
        <View style={styles.backdrop}>
          <Animated.View
            style={[
              styles.card,
              { opacity: appear, transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }] },
            ]}
          >
            <View style={[styles.icon, { backgroundColor: tone.background, borderColor: tone.color }]}>
              <Text style={[styles.symbol, { color: tone.color }]}>{tone.symbol}</Text>
            </View>
            <Text style={styles.title}>{dialog?.title}</Text>
            {!!dialog?.message && <Text style={styles.message}>{dialog.message}</Text>}
            <GradientButton label={t('common.ok')} onPress={close} style={{ alignSelf: 'stretch', marginTop: 8 }} />
          </Animated.View>
        </View>
      </Modal>
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const show = useContext(DialogContext);
  if (!show) throw new Error('useDialog doit être utilisé dans <DialogProvider>');
  return show;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(4,3,10,0.82)', justifyContent: 'center', padding: 28 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    gap: 10,
  },
  icon: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  symbol: { fontFamily: fonts.displayBold, fontSize: 26 },
  title: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 20, textAlign: 'center' },
  message: { color: colors.textDim, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
