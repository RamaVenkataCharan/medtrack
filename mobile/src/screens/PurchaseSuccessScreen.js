import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, TOUCH_TARGETS } from '../constants/theme';
import { formatDate } from '../utils/dateUtils';

export default function PurchaseSuccessScreen({ navigation, route }) {
  const {
    entryId,
    customerName = 'Customer',
    medicineCount = 1,
    totalAmount = 0,
    entryDate = new Date().toISOString(),
  } = route.params || {};

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <View style={{ width: 44 }} />
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => navigation.navigate('Home')}
          accessibilityRole="button"
          accessibilityLabel="Close and return to Home"
        >
          <Ionicons name="close" size={24} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Animated Celebration Icon */}
        <View style={styles.celebrationContainer}>
          <View style={styles.outerGlow}>
            <View style={styles.checkCircle}>
              <Ionicons name="checkmark" size={54} color="#FFFFFF" />
            </View>
          </View>
        </View>

        <Text style={styles.successTitle}>Purchase Saved Successfully!</Text>
        <Text style={styles.successSubtitle}>
          {medicineCount} {medicineCount === 1 ? 'medicine' : 'medicines'} recorded for{' '}
          <Text style={{ fontWeight: '700', color: COLORS.text }}>{customerName}</Text>
        </Text>

        {/* Purchase Summary Box */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Amount</Text>
            <Text style={styles.summaryAmount}>₹{parseFloat(totalAmount).toFixed(0)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Recorded Date</Text>
            <Text style={styles.summaryDate}>{formatDate(entryDate)}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              if (entryId) {
                navigation.navigate('PurchaseDetails', { entryId });
              } else {
                navigation.navigate('Home');
              }
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="View Purchase"
          >
            <Text style={styles.primaryBtnText}>View Purchase</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.replace('AddPurchase')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Add Another Purchase"
          >
            <Text style={styles.secondaryBtnText}>Add Another Purchase</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  closeBtn: {
    width: TOUCH_TARGETS.minWidth,
    height: TOUCH_TARGETS.minHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  celebrationContainer: {
    marginBottom: SPACING.lg,
  },
  outerGlow: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 6,
    borderColor: '#F8B4A2',
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    ...TYPOGRAPHY.h2,
    fontSize: 24,
    color: COLORS.text,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  successSubtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  summaryBox: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.xxl,
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  summaryAmount: {
    ...TYPOGRAPHY.h2,
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primary,
  },
  summaryDate: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
  },
  actionContainer: {
    width: '100%',
    gap: SPACING.md,
  },
  primaryBtn: {
    minHeight: TOUCH_TARGETS.minHeight,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnText: {
    ...TYPOGRAPHY.label,
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    minHeight: TOUCH_TARGETS.minHeight,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    ...TYPOGRAPHY.label,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
});
