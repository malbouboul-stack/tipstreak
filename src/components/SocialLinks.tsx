import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts } from '../theme';
import { describeLink } from '../lib/socialLinks';

// Liens publics du créateur : un bouton par réseau, qui ouvre l'app ou le site correspondant
export default function SocialLinks({ links }: { links: string[] }) {
  if (links.length === 0) return null;
  return (
    <View style={styles.row}>
      {links.map((url) => {
        const { label, icon } = describeLink(url);
        return (
          <TouchableOpacity
            key={url}
            style={styles.chip}
            onPress={() => Linking.openURL(url).catch(() => {})}
            accessibilityRole="link"
            accessibilityLabel={label}
          >
            <Text style={styles.icon}>{icon}</Text>
            <Text style={styles.label} numberOfLines={1}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 16 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, maxWidth: 170,
    borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  icon: { fontSize: 13, color: colors.text },
  label: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 12, flexShrink: 1 },
});
