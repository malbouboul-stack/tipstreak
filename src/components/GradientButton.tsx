import React from 'react';
import { Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, gradient } from '../theme';

type Props = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
};

export default function GradientButton({ label, onPress, disabled, style }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[{ opacity: disabled ? 0.4 : 1 }, style]}
    >
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
        <Text style={styles.text}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  text: { color: colors.bg, fontFamily: fonts.bodyBold, fontSize: 15 },
});
