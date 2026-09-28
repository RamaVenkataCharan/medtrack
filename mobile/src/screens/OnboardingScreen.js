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

export default function OnboardingScreen({ navigation, onFinish }) {
  const handleGetStarted = () => {
    if (onFinish) {
      onFinish();
    } else {
      navigation.replace('Home');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Pill Brand Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.pillIconBadge}>
            <Ionicons name="medical" size={44} color={COLORS.primary} />
          </View>
          <Text style={styles.brandTitle}>MedTrack</Text>
          <Text style={styles.brandSubtitle}>
            Your Customers' Purchase History{'\n'}Always with You
          </Text>
        </View>

        {/* Pharmacist Trust Illustration Card */}
        <View style={styles.illustrationCard}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={54} color={COLORS.primary} />
          </View>
          <Text style={styles.illustrationCaption}>
            Built specifically for pharmacy owners transitioning from paper ledgers to effortless digital records.
          </Text>
        </View>

        {/* 3 Core Value Propositions */}
        <View style={styles.featuresContainer}>
          <View style={styles.featureRow}>
            <View style={styles.checkCircle}>
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.featureText}>
              Find what your customers have purchased anytime
            </Text>
          </View>

          <View style={styles.featureRow}>
            <View style={styles.checkCircle}>
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.featureText}>
              No more searching old ledgers
            </Text>
          </View>

          <View style={styles.featureRow}>
            <View style={styles.checkCircle}>
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.featureText}>
              Safe, secure and easy to use
            </Text>
          </View>
        </View>

        {/* Get Started CTA */}
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={handleGetStarted}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Get Started with MedTrack"
        >
          <Text style={styles.ctaButtonText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" style={styles.ctaArrow} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.xl,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  pillIconBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: '#E8C5B5',
  },
  brandTitle: {
    ...TYPOGRAPHY.h1,
    fontSize: 32,
    color: COLORS.primary,
    fontWeight: '800',
    marginBottom: SPACING.xs,
  },
  brandSubtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  illustrationCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    marginVertical: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  illustrationCaption: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 22,
  },
  featuresContainer: {
    width: '100%',
    marginVertical: SPACING.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  featureText: {
    ...TYPOGRAPHY.body,
    fontSize: 16,
    color: COLORS.text,
    flex: 1,
    fontWeight: '500',
  },
  ctaButton: {
    width: '100%',
    minHeight: TOUCH_TARGETS.minHeight,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  ctaButtonText: {
    ...TYPOGRAPHY.label,
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  ctaArrow: {
    marginLeft: SPACING.sm,
  },
});
