// mobile/src/screens/UserProfileScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AuthService } from '../services/authService';
import { COLORS, SPACING, RADIUS, FONTS } from '../constants/theme';

export default function UserProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const user = await AuthService.getCurrentUser();
      const result = await AuthService.getUserProfile(user?.id);

      if (result.success && result.data) {
        setProfile(result.data);
      } else {
        setError(result.error || 'Failed to load organization credentials');
      }
    } catch (err) {
      setError(err.message || 'Error loading profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  function handleEditProfile() {
    navigation.navigate('Settings', { profile });
  }

  async function handleLogout() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to securely sign out of your enterprise store session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await AuthService.logout();
            if (navigation.replace) {
              navigation.replace('Login');
            }
          },
        },
      ]
    );
  }

  function formatDate(dateString) {
    if (!dateString) return 'Not Configured';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  }

  function getDaysUntilExpiry(dateString) {
    if (!dateString) return null;
    const expiryDate = new Date(dateString);
    if (isNaN(expiryDate.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
  }

  const topPadding = Math.max(insets.top, (StatusBar.currentHeight || 0)) + SPACING.sm;

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: topPadding }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Verifying enterprise credentials...</Text>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.errorContainer}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="shield-outline" size={32} color={COLORS.danger} />
          </View>
          <Text style={styles.errorTitle}>Credentials Unavailable</Text>
          <Text style={styles.errorMessage}>{error || 'Store profile information could not be synchronized.'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadProfile} activeOpacity={0.85}>
            <Text style={styles.retryButtonText}>Retry Verification</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const shopDaysLeft = getDaysUntilExpiry(profile.shop_license_validity);
  const pharmDaysLeft = getDaysUntilExpiry(profile.pharmacist_validity);

  const isShopValid = shopDaysLeft !== null && shopDaysLeft > 0;
  const isPharmValid = pharmDaysLeft !== null && pharmDaysLeft > 0;

  return (
    <View style={[styles.container, { paddingTop: topPadding, paddingBottom: Math.max(insets.bottom, SPACING.md) }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Corporate App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.appBarTitle}>Pharmacy Credentials</Text>
          <Text style={styles.appBarSubtitle}>Store verification & statutory drug licenses</Text>
        </View>
        <View style={styles.verifiedHeaderBadge}>
          <Ionicons name="shield-checkmark" size={13} color={COLORS.paymentGreen} style={{ marginRight: 4 }} />
          <Text style={styles.verifiedHeaderText}>Verified</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Enterprise Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.emblemWrapper}>
              <Ionicons name="business" size={26} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroShopName}>{profile.shop_name || 'Retail Pharmacy'}</Text>
              <Text style={styles.heroSubtitle}>Licensed Retail Chemist & Druggist</Text>
            </View>
          </View>

          <View style={styles.heroPillsRow}>
            <View style={styles.metaPill}>
              <Ionicons name="checkmark-circle" size={12} color={COLORS.paymentGreen} style={{ marginRight: 4 }} />
              <Text style={styles.metaPillText}>Drugs & Cosmetics Act Compliant</Text>
            </View>
            <View style={styles.metaPill}>
              <Ionicons name="server-outline" size={12} color={COLORS.textSecondary} style={{ marginRight: 4 }} />
              <Text style={styles.metaPillText}>Cloud Synchronized</Text>
            </View>
          </View>
        </View>

        {/* Section 1: Store & Statutory Drug Licenses */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>STORE & STATUTORY LICENSES</Text>
          </View>

          <View style={styles.dataCard}>
            <View style={styles.dataRow}>
              <View style={styles.labelCol}>
                <Text style={styles.fieldLabel}>COMMERCIAL ENTITY NAME</Text>
                <Text style={styles.fieldValue}>{profile.shop_name || '—'}</Text>
              </View>
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.dataRow}>
              <View style={styles.labelCol}>
                <Text style={styles.fieldLabel}>DRUG LICENSE NO. (FORM 20-B / 21-B)</Text>
                <View style={styles.codeBadge}>
                  <Text style={styles.codeBadgeText}>{profile.shop_license_number || 'NOT SPECIFIED'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.dataRow}>
              <View style={styles.labelCol}>
                <Text style={styles.fieldLabel}>STATUTORY VALIDITY</Text>
                <Text style={styles.fieldValue}>{formatDate(profile.shop_license_validity)}</Text>
              </View>
              {shopDaysLeft !== null && (
                <View
                  style={[
                    styles.statusChip,
                    isShopValid ? styles.statusChipValid : styles.statusChipExpired,
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: isShopValid ? COLORS.paymentGreen : COLORS.danger },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusChipText,
                      { color: isShopValid ? COLORS.paymentGreen : COLORS.danger },
                    ]}
                  >
                    {isShopValid ? `Valid • ${shopDaysLeft} days left` : 'EXPIRED'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.dataRow}>
              <View style={styles.labelCol}>
                <Text style={styles.fieldLabel}>OFFICIAL CONTACT NUMBER</Text>
                <Text style={styles.fieldValue}>{profile.shop_phone_number || '—'}</Text>
              </View>
              <Ionicons name="call-outline" size={16} color={COLORS.textTertiary} />
            </View>
          </View>
        </View>

        {/* Section 2: Supervising Registered Pharmacist */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-circle-outline" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>REGISTERED SUPERVISING PHARMACIST</Text>
          </View>

          <View style={styles.dataCard}>
            <View style={styles.dataRow}>
              <View style={styles.labelCol}>
                <Text style={styles.fieldLabel}>SUPERVISING PRACTITIONER</Text>
                <Text style={styles.fieldValue}>{profile.pharmacist_name || '—'}</Text>
              </View>
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.dataRow}>
              <View style={styles.labelCol}>
                <Text style={styles.fieldLabel}>PHARMACY COUNCIL REGISTRATION</Text>
                <View style={styles.codeBadge}>
                  <Text style={styles.codeBadgeText}>{profile.pharmacist_license_number || 'NOT SPECIFIED'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.dataRow}>
              <View style={styles.labelCol}>
                <Text style={styles.fieldLabel}>REGISTRATION VALIDITY</Text>
                <Text style={styles.fieldValue}>{formatDate(profile.pharmacist_validity)}</Text>
              </View>
              {pharmDaysLeft !== null && (
                <View
                  style={[
                    styles.statusChip,
                    isPharmValid ? styles.statusChipValid : styles.statusChipExpired,
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: isPharmValid ? COLORS.paymentGreen : COLORS.danger },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusChipText,
                      { color: isPharmValid ? COLORS.paymentGreen : COLORS.danger },
                    ]}
                  >
                    {isPharmValid ? `Valid • ${pharmDaysLeft} days left` : 'EXPIRED'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.dataRow}>
              <View style={styles.labelCol}>
                <Text style={styles.fieldLabel}>PROFESSIONAL PHONE</Text>
                <Text style={styles.fieldValue}>{profile.pharmacist_phone_number || '—'}</Text>
              </View>
              <Ionicons name="call-outline" size={16} color={COLORS.textTertiary} />
            </View>
          </View>
        </View>

        {/* Section 3: Regulatory Compliance Footnote */}
        <View style={styles.complianceNoticeBox}>
          <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.textSecondary} style={{ marginRight: 10, marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.complianceTitle}>Statutory Compliance Assurance</Text>
            <Text style={styles.complianceBody}>
              Retail store records are maintained in conformity with the Drugs and Cosmetics Act, 1940 and Pharmacy Act, 1948.
            </Text>
          </View>
        </View>

        {/* Corporate Action Buttons */}
        <View style={styles.actionButtonGroup}>
          <TouchableOpacity
            style={styles.primaryActionButton}
            onPress={handleEditProfile}
            activeOpacity={0.85}
          >
            <Ionicons name="create-outline" size={18} color={COLORS.textInverted} style={{ marginRight: 8 }} />
            <Text style={styles.primaryActionText}>Update Store Credentials</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryActionButton}
            onPress={handleLogout}
            activeOpacity={0.85}
          >
            <Ionicons name="log-out-outline" size={18} color={COLORS.danger} style={{ marginRight: 8 }} />
            <Text style={styles.secondaryActionText}>Sign Out of Store Session</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: SPACING.xxxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  errorIconWrap: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  errorMessage: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: RADIUS.md,
  },
  retryButtonText: {
    color: COLORS.textInverted,
    fontWeight: '600',
    fontSize: 13,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  appBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  appBarSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  verifiedHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.paymentCardBg,
    borderColor: COLORS.paymentCardBorder,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  verifiedHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.paymentGreen,
  },
  heroCard: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emblemWrapper: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  heroShopName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  heroPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceSubtle,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  metaPillText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  section: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs + 2,
    paddingLeft: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
  },
  dataCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingVertical: 2,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },
  labelCol: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  codeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    marginTop: 2,
  },
  codeBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  cardDivider: {
    height: 1,
    backgroundColor: COLORS.surfaceSubtle,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  statusChipValid: {
    backgroundColor: COLORS.paymentCardBg,
    borderColor: COLORS.paymentCardBorder,
  },
  statusChipExpired: {
    backgroundColor: COLORS.dangerLight,
    borderColor: COLORS.danger + '40',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  complianceNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
    padding: SPACING.md,
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  complianceTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  complianceBody: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  actionButtonGroup: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
    gap: SPACING.md,
  },
  primaryActionButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryActionText: {
    color: COLORS.textInverted,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  secondaryActionButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '600',
  },
});
