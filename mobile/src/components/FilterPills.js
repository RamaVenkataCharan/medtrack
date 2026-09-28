import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, TOUCH_TARGETS } from '../constants/theme';

export default function FilterPills({ options = [], selected, onSelect, style }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.container, style]}
    >
      {options.map((opt) => {
        const key = typeof opt === 'string' ? opt : opt.key || opt.id;
        const label = typeof opt === 'string' ? opt : opt.label;
        const count = typeof opt === 'object' && opt.count !== undefined ? opt.count : null;
        const isSelected = selected === key;

        return (
          <TouchableOpacity
            key={key}
            style={[styles.pill, isSelected ? styles.pillSelected : styles.pillUnselected]}
            onPress={() => onSelect(key)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${label}${count !== null ? ` ${count}` : ''}`}
          >
            <Text
              style={[
                styles.pillText,
                isSelected ? styles.pillTextSelected : styles.pillTextUnselected,
              ]}
            >
              {label}
              {count !== null && (
                <Text
                  style={[
                    styles.countBadge,
                    isSelected ? styles.countBadgeSelected : styles.countBadgeUnselected,
                  ]}
                >
                  {' '}
                  ({count})
                </Text>
              )}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  pill: {
    minHeight: TOUCH_TARGETS.minHeight,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
    borderWidth: 1,
  },
  pillSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pillUnselected: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
  },
  pillText: {
    ...TYPOGRAPHY.label,
    fontSize: 15,
  },
  pillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pillTextUnselected: {
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  countBadge: {
    fontSize: 13,
  },
  countBadgeSelected: {
    color: '#FFEFE8',
  },
  countBadgeUnselected: {
    color: COLORS.textMuted,
  },
});
