import React from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { avatarColors, colors, fonts } from '../theme';

type Props = {
  seed: string; // handle du créateur : donne toujours la même couleur
  initial: string;
  size: number;
  ring?: boolean; // liseré sombre (avatar posé sur une bannière)
};

export default function Avatar({ seed, initial, size, ring = false }: Props) {
  const [from, to] = avatarColors(seed);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        padding: ring ? 3 : 0,
        backgroundColor: ring ? colors.bg : 'transparent',
      }}
    >
      <LinearGradient
        colors={[from, to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: colors.bg, fontFamily: fonts.displayBold, fontSize: size * 0.4 }}>{initial}</Text>
      </LinearGradient>
    </View>
  );
}
