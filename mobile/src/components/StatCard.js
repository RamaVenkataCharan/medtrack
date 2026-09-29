import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';

export default function StatCard({ label, value, highlightColor, style, testID }) {
  return (
    <View testID={testID} style={[styles.card, style]} accessible={true}>
      <Text
        style={[styles.value, highlightColor ? { color: highlightColor } : null]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
      >
        {value}
      </Text>
      <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 52,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingVertical: 4,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 64,
  },
  value: {
    ...TYPOGRAPHY.h3,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 1,
  },
  label: {
    ...TYPOGRAPHY.labelSmall,
    color: COLORS.textMuted,
    fontSize: 10,
    textAlign: 'center',
  },
});
