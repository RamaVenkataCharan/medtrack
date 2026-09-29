import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, TOUCH_TARGETS } from '../constants/theme';

export default function BottomNavBar({ currentRoute = 'Home', navigation }) {
  const tabs = [
    {
      name: 'Home',
      label: 'Home',
      icon: 'home',
      outlineIcon: 'home-outline',
      target: 'Home',
    },
    {
      name: 'Customers',
      label: 'Customers',
      icon: 'people',
      outlineIcon: 'people-outline',
      target: 'CustomerSearch',
    },
  ];

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {tabs.map((tab) => {
          const isActive = currentRoute === tab.name;

          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tabButton}
              onPress={() => {
                if (currentRoute !== tab.name) {
                  navigation?.navigate?.(tab.target);
                }
              }}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${tab.label} tab`}
            >
              <Ionicons
                name={isActive ? tab.icon : tab.outlineIcon}
                size={24}
                color={isActive ? COLORS.primary : COLORS.textMuted}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive ? COLORS.primary : COLORS.textMuted,
                    fontWeight: isActive ? '700' : '500',
                  },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingBottom: Platform.OS === 'ios' ? 20 : SPACING.xs,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 56,
    paddingHorizontal: SPACING.xl,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TOUCH_TARGETS.minHeight,
    paddingVertical: 4,
  },
  tabLabel: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 12,
    marginTop: 2,
  },
});
