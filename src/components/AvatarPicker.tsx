import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Avatar from './Avatar';
import { useDialog } from './Dialog';
import { colors, fonts } from '../theme';
import { Creator, useData } from '../context/DataContext';
import { useLanguage } from '../i18n/LanguageContext';

const SIZE = 512; // photo envoyée : JPEG 512 × 512

// Galerie → recadrage carré → 512 × 512 JPEG → signature du wallet → upload-avatar
export default function AvatarPicker({ creator }: { creator: Creator }) {
  const { uploadAvatar } = useData();
  const { t, translateError } = useLanguage();
  const showDialog = useDialog();
  const [uploading, setUploading] = useState(false);

  const pick = async () => {
    // Modules natifs chargés à la demande : une development build plus ancienne démarre quand même
    /* eslint-disable @typescript-eslint/no-require-imports */
    const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
    const { ImageManipulator, SaveFormat } = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
    /* eslint-enable @typescript-eslint/no-require-imports */

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    setUploading(true);
    try {
      // Carré centré (au cas où le recadrage n'a pas été appliqué), puis 512 × 512
      const side = Math.min(asset.width, asset.height);
      const context = ImageManipulator.manipulate(asset.uri);
      context.crop({ originX: (asset.width - side) / 2, originY: (asset.height - side) / 2, width: side, height: side });
      context.resize({ width: SIZE, height: SIZE });
      const image = await context.renderAsync();
      const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
      if (!saved.base64) throw new Error('tip.unknownError');

      await uploadAvatar(saved.base64);
      showDialog({ title: t('profile.photoUpdated'), tone: 'success' });
    } catch (e: any) {
      console.error('Avatar upload error', e);
      showDialog({ title: t('profile.photoFailed'), message: translateError(e?.message, 'profile.retryLater'), tone: 'error' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.row}>
      <Avatar seed={creator.handle} initial={creator.initial} uri={creator.avatarUrl} size={56} />
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{t('profile.photo')}</Text>
        <Text style={styles.hint}>{t('profile.photoHint')}</Text>
      </View>
      <TouchableOpacity style={styles.button} onPress={pick} disabled={uploading}>
        {uploading ? (
          <ActivityIndicator size="small" color={colors.purple} />
        ) : (
          <Text style={styles.buttonText}>{creator.avatarUrl ? t('profile.photoChange') : t('profile.photoChoose')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 16, padding: 12, marginBottom: 10,
  },
  label: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 13 },
  hint: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 10, marginTop: 2 },
  button: {
    paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, minWidth: 90, alignItems: 'center',
    backgroundColor: 'rgba(153,69,255,0.1)', borderWidth: 1, borderColor: 'rgba(153,69,255,0.35)',
  },
  buttonText: { color: colors.purple, fontFamily: fonts.bodyBold, fontSize: 12 },
});
