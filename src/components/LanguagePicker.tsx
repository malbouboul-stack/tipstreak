import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts } from '../theme';
import { Language, useLanguage } from '../i18n/LanguageContext';

const OPTIONS: { code: Language; label: string }[] = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
];

// Bouton compact affichant la langue actuelle ("FR ▾") ; un appui ouvre le choix de la langue.
export default function LanguagePicker() {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);

  const choose = (code: Language) => {
    setLanguage(code);
    setOpen(false);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.pill}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('profile.language')}
        hitSlop={8}
      >
        <Text style={styles.globe}>🌐</Text>
        <Text style={styles.code}>{language.toUpperCase()}</Text>
        <Text style={styles.caret}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.title}>{t('profile.language')}</Text>
            {OPTIONS.map((option) => {
              const selected = option.code === language;
              return (
                <TouchableOpacity
                  key={option.code}
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => choose(option.code)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.optionCode, selected && { color: colors.cyan }]}>{option.code.toUpperCase()}</Text>
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  {selected && <Text style={styles.check}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 11,
    borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  globe: { fontSize: 13 },
  code: { color: colors.text, fontFamily: fonts.monoBold, fontSize: 12 },
  caret: { color: colors.textFaint, fontSize: 11 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 32 },
  sheet: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 8 },
  title: { color: colors.textFaint, fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 4 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14,
    backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.borderSoft,
  },
  optionSelected: { borderColor: 'rgba(25,227,208,0.55)', backgroundColor: 'rgba(25,227,208,0.08)' },
  optionCode: { color: colors.textDim, fontFamily: fonts.monoBold, fontSize: 13, width: 26 },
  optionLabel: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 15, flex: 1 },
  check: { color: colors.cyan, fontFamily: fonts.bodyBold, fontSize: 16 },
});
