import React, { useEffect, useState } from 'react';
import { Animated, Easing, Image, Modal, Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { colors, fonts } from '../theme';

type Props = { uri: string | null; name: string; onClose: () => void };

// Photo de profil en grand : s'ouvre en fondu avec un léger zoom, un toucher la referme
export default function PhotoViewer({ uri, name, onClose }: Props) {
  const { width } = useWindowDimensions();
  const size = Math.min(width - 48, 440);
  const [appear] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!uri) return;
    appear.setValue(0);
    Animated.timing(appear, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [uri, appear]);

  return (
    <Modal visible={uri !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={name}>
        <Animated.View
          style={{ alignItems: 'center', opacity: appear, transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }}
        >
          {uri && <Image source={{ uri }} style={{ width: size, height: size, borderRadius: 28 }} accessibilityIgnoresInvertColors />}
          <Text style={styles.name}>{name}</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(4,3,10,0.92)', alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 20, marginTop: 18 },
});
