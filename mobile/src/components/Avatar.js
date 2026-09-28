import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY } from '../constants/theme';

export default function Avatar({ name = '', size = 44, color, textStyle }) {
  const getInitials = (text) => {
    if (!text || typeof text !== 'string') return '?';
    const parts = text.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getBackgroundColor = (str) => {
    if (color) return color;
    const colors = [
      '#C65D35', // Primary Terracotta
      '#4B6B94', // Dusty Blue
      '#437A63', // Sage Teal
      '#9C5B7F', // Plum
      '#D97736', // Warm Amber
      '#5C6B73', // Slate
    ];
    let hash = 0;
    for (let i = 0; i < (str || '').length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const initials = getInitials(name);
  const bgColor = getBackgroundColor(name);
  const fontSize = Math.max(14, Math.floor(size * 0.4));

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
        },
      ]}
      accessible={true}
      accessibilityRole="image"
      accessibilityLabel={`Avatar for ${name}`}
    >
      <Text style={[styles.text, { fontSize }, textStyle]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  text: {
    ...TYPOGRAPHY.label,
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
  },
});
