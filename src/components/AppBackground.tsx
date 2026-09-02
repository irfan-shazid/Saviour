import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

/**
 * The layer every frosted pane sits on.
 *
 * Blur only reads as "glass" when there is something varied behind it — over a
 * flat fill a BlurView just returns the same flat fill. So the app paints a
 * base gradient plus three soft aurora blobs, giving each pane something to
 * refract. Purely decorative, so it is hidden from screen readers.
 */
export function AppBackground() {
  const { colors } = useTheme();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <LinearGradient colors={colors.bgGradient} style={StyleSheet.absoluteFill} />
      <View style={[styles.blob, styles.blobA, { backgroundColor: colors.auroraA }]} />
      <View style={[styles.blob, styles.blobB, { backgroundColor: colors.auroraB }]} />
      <View style={[styles.blob, styles.blobC, { backgroundColor: colors.auroraC }]} />
    </View>
  );
}

// Oversized, heavily rounded and pushed partly off-screen so the edges read as
// a diffuse glow rather than as three visible circles.
const styles = StyleSheet.create({
  blob: { position: 'absolute', borderRadius: 9999 },
  blobA: { width: 420, height: 420, top: -160, right: -140 },
  blobB: { width: 380, height: 380, top: '38%', left: -180 },
  blobC: { width: 460, height: 460, bottom: -220, right: -120 },
});
